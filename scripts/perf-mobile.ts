/**
 * Mobile-emulation perf capture: Playwright-based proxy for the
 * Chrome DevTools filmstrip documented in docs/testing/mobile-emulation.md.
 *
 * For each run:
 *   - Spawns (or reuses) `vite preview` on :4273
 *   - Launches Chromium with Galaxy-A51-ish viewport (412 × 869 @ 2.625 DPR)
 *   - Applies CDP throttling: 400 Kbps down/up, 2000ms RTT, 6x CPU slowdown
 *   - Unregisters SW + clears all caches for cold-visit semantics
 *   - Navigates to --url and captures PNG screenshots every 150ms for 8s
 *   - Captures a Chrome trace.json (openable in DevTools → Performance)
 *   - Reads window.performance.getEntriesByType("paint" | "navigation")
 *
 * Writes everything to docs/testing/results/<label>/run-<n>/.
 *
 * Usage:
 *   npm run perf:mobile -- --label=baseline
 *   npm run perf:mobile -- --label=inline-shell --runs=3
 *   npm run perf:mobile -- --label=x --skip-build --url=/en/report
 *   npm run perf:mobile -- --label=y --warm   # skip SW clear; reuse HTTP cache
 */

import { spawn, type ChildProcess, execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import { chromium, type CDPSession, type Page } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RESULTS_ROOT = resolve(ROOT, "docs/testing/results");
const PREVIEW_PORT = 4273;

// ── CLI ──────────────────────────────────────────────────

type Args = {
  label: string;
  runs: number;
  skipBuild: boolean;
  url: string;
  warm: boolean;
  captureMs: number;
  intervalMs: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    label: "",
    runs: 3,
    skipBuild: false,
    url: "/en",
    warm: false,
    captureMs: 8000,
    intervalMs: 150,
  };
  for (const a of argv) {
    if (a.startsWith("--label=")) args.label = a.slice("--label=".length);
    else if (a.startsWith("--runs=")) args.runs = parseInt(a.slice("--runs=".length), 10);
    else if (a === "--skip-build") args.skipBuild = true;
    else if (a.startsWith("--url=")) args.url = a.slice("--url=".length);
    else if (a === "--warm") args.warm = true;
    else if (a.startsWith("--capture-ms=")) args.captureMs = parseInt(a.slice("--capture-ms=".length), 10);
    else if (a.startsWith("--interval-ms=")) args.intervalMs = parseInt(a.slice("--interval-ms=".length), 10);
  }
  if (!args.label) {
    console.error("Error: --label=<string> is required");
    process.exit(1);
  }
  return args;
}

// ── Preview server ───────────────────────────────────────

function waitForPort(port: number, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      const sock = createConnection({ port, host: "localhost" });
      sock.on("connect", () => {
        sock.end();
        resolvePromise();
      });
      sock.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          rejectPromise(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 100);
        }
      });
    };
    attempt();
  });
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const sock = createConnection({ port, host: "localhost" });
    sock.on("connect", () => {
      sock.end();
      resolvePromise(true);
    });
    sock.on("error", () => resolvePromise(false));
  });
}

// ── Throttling profile ───────────────────────────────────

const NETWORK_PROFILE = {
  offline: false,
  downloadThroughput: (400 * 1024) / 8, // 400 Kbps
  uploadThroughput: (400 * 1024) / 8,
  latency: 2000, // 2000ms RTT
};
const CPU_SLOWDOWN = 6;
const VIEWPORT = { width: 412, height: 869 };
const DEVICE_SCALE_FACTOR = 2.625;

async function applyThrottling(cdp: CDPSession): Promise<void> {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: NETWORK_PROFILE.offline,
    downloadThroughput: NETWORK_PROFILE.downloadThroughput,
    uploadThroughput: NETWORK_PROFILE.uploadThroughput,
    latency: NETWORK_PROFILE.latency,
    connectionType: "cellular3g",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}

async function clearForColdVisit(cdp: CDPSession, page: Page): Promise<void> {
  // Unregister any SW from previous runs, clear Cache Storage, IndexedDB.
  await page.context().clearCookies();
  try {
    await cdp.send("Storage.clearDataForOrigin", {
      origin: `http://localhost:${PREVIEW_PORT}`,
      storageTypes: "service_workers,cache_storage,indexeddb,local_storage,websql",
    });
  } catch {
    // Best-effort — clearDataForOrigin is only available after a navigation in some CDP versions.
  }
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Network.clearBrowserCookies");
}

// ── One run ──────────────────────────────────────────────

type RunMetrics = {
  navigationStart: number;
  firstPaint: number | null;
  firstContentfulPaint: number | null;
  domContentLoaded: number;
  loadEvent: number;
  screenshotCount: number;
};

async function captureRun(
  runIndex: number,
  args: Args,
  runDir: string,
): Promise<RunMetrics> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    userAgent:
      "Mozilla/5.0 (Linux; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  if (!args.warm) {
    // Open about:blank first so clearDataForOrigin has a page context.
    await page.goto("about:blank");
    await clearForColdVisit(cdp, page);
  }

  await applyThrottling(cdp);

  const url = `http://localhost:${PREVIEW_PORT}${args.url}`;

  // Start trace
  await cdp.send("Tracing.start", {
    categories:
      "-*,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.screenshot,loading,navigation,v8.execute",
    transferMode: "ReportEvents",
  });
  const traceEvents: unknown[] = [];
  cdp.on("Tracing.dataCollected", (evt: { value: unknown[] }) => {
    for (const e of evt.value) traceEvents.push(e);
  });
  const tracingComplete = new Promise<void>((resolvePromise) => {
    cdp.once("Tracing.tracingComplete", () => resolvePromise());
  });

  const navStartWall = Date.now();

  // Kick off navigation but don't await — we want to screenshot in parallel.
  const navPromise = page.goto(url, { waitUntil: "load", timeout: args.captureMs + 5000 }).catch((err) => {
    console.warn(`  Run ${runIndex} nav error (may be fine): ${err.message}`);
  });

  // CDP screencast — what DevTools filmstrip uses. Non-blocking; pushes JPEG
  // frames as the compositor paints them, so we never miss early paints.
  const framesDir = resolve(runDir, "frames");
  mkdirSync(framesDir, { recursive: true });
  const frames: { tMs: number; path: string }[] = [];

  const onFrame = async (params: {
    data: string;
    metadata?: { timestamp?: number };
    sessionId: number;
  }) => {
    const tMs = Date.now() - navStartWall;
    const idx = frames.length;
    const name = `frame-${String(idx).padStart(3, "0")}-${String(tMs).padStart(5, "0")}ms.jpg`;
    const path = resolve(framesDir, name);
    writeFileSync(path, Buffer.from(params.data, "base64"));
    frames.push({ tMs, path });
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId });
    } catch {
      // session may have ended
    }
  };
  cdp.on("Page.screencastFrame", onFrame);

  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 70,
    everyNthFrame: 1,
  });

  await new Promise((r) => setTimeout(r, args.captureMs));

  try {
    await cdp.send("Page.stopScreencast");
  } catch {
    // ok
  }
  cdp.off("Page.screencastFrame", onFrame);

  await navPromise;

  // Read perf timing
  const timing = await page
    .evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const paints = performance.getEntriesByType("paint") as PerformanceEntry[];
      const fp = paints.find((p) => p.name === "first-paint");
      const fcp = paints.find((p) => p.name === "first-contentful-paint");
      return {
        firstPaint: fp ? fp.startTime : null,
        firstContentfulPaint: fcp ? fcp.startTime : null,
        domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
        loadEvent: nav?.loadEventEnd ?? 0,
      };
    })
    .catch(() => ({
      firstPaint: null,
      firstContentfulPaint: null,
      domContentLoaded: 0,
      loadEvent: 0,
    }));

  // Stop trace
  await cdp.send("Tracing.end");
  await tracingComplete;
  writeFileSync(
    resolve(runDir, "trace.json"),
    JSON.stringify({ traceEvents }) + "\n",
    "utf-8",
  );

  await browser.close();

  return {
    navigationStart: 0,
    firstPaint: timing.firstPaint,
    firstContentfulPaint: timing.firstContentfulPaint,
    domContentLoaded: timing.domContentLoaded,
    loadEvent: timing.loadEvent,
    screenshotCount: frames.length,
  };
}

// ── Main ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log("Kapwa Help Mobile Perf Capture");
  console.log("------------------------------");
  console.log(`Label:      ${args.label}`);
  console.log(`URL:        http://localhost:${PREVIEW_PORT}${args.url}`);
  console.log(`Runs:       ${args.runs}`);
  console.log(`Profile:    400/400 Kbps, 2000ms RTT, 6x CPU, 412x869 @ 2.625 DPR`);
  console.log(`Cache:      ${args.warm ? "warm (keep)" : "cold (clear SW/caches/cookies)"}`);
  console.log("");

  if (!args.skipBuild) {
    console.log("Building...");
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
    console.log("");
  } else if (!existsSync(resolve(ROOT, "dist"))) {
    console.error("Error: dist/ missing and --skip-build was set");
    process.exit(1);
  }

  const alreadyRunning = await isPortOpen(PREVIEW_PORT);
  let preview: ChildProcess | null = null;
  if (!alreadyRunning) {
    console.log(`Starting preview on :${PREVIEW_PORT}...`);
    preview = spawn(
      "npm",
      ["run", "preview", "--", "--port", String(PREVIEW_PORT)],
      { cwd: ROOT, stdio: "pipe" },
    );
    await waitForPort(PREVIEW_PORT);
    console.log("Preview ready.\n");
  } else {
    console.log(`Preview already running on :${PREVIEW_PORT}.\n`);
  }

  const cleanup = () => {
    if (preview?.pid && !preview.killed) preview.kill("SIGTERM");
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  const outDir = resolve(RESULTS_ROOT, args.label);
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const allMetrics: RunMetrics[] = [];
  try {
    for (let i = 1; i <= args.runs; i++) {
      console.log(`Run ${i}/${args.runs}...`);
      const runDir = resolve(outDir, `run-${i}`);
      mkdirSync(runDir, { recursive: true });
      const m = await captureRun(i, args, runDir);
      allMetrics.push(m);
      console.log(
        `  FP ${m.firstPaint != null ? Math.round(m.firstPaint) + "ms" : "—"}, ` +
          `FCP ${m.firstContentfulPaint != null ? Math.round(m.firstContentfulPaint) + "ms" : "—"}, ` +
          `DCL ${Math.round(m.domContentLoaded)}ms, ` +
          `load ${Math.round(m.loadEvent)}ms, ` +
          `${m.screenshotCount} frames`,
      );
    }
  } finally {
    cleanup();
  }

  const summary = {
    label: args.label,
    url: `http://localhost:${PREVIEW_PORT}${args.url}`,
    runs: args.runs,
    profile: {
      network: NETWORK_PROFILE,
      cpuSlowdown: CPU_SLOWDOWN,
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    },
    cache: args.warm ? "warm" : "cold",
    capturedAt: new Date().toISOString(),
    runs_data: allMetrics,
  };
  writeFileSync(
    resolve(outDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf-8",
  );
  console.log(`\nWrote docs/testing/results/${args.label}/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
