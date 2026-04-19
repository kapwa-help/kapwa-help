/**
 * Perf harness: spawns `vite preview`, runs Lighthouse N times,
 * writes results to perf-results/<sha>-<label>.json, and prints
 * a delta table vs. a prior baseline.
 *
 * Usage:
 *   npm run perf -- --label=baseline
 *   npm run perf -- --label=hero --runs=9
 *   npm run perf -- --label=quick --skip-build
 *   npm run perf -- --label=x --compare-to=abc1234-baseline
 */

import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RESULTS_DIR = resolve(ROOT, "perf-results");
const PREVIEW_PORT = 4273;

// ── Stats helpers ────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

type Summary = { median: number; min: number; max: number; stddev: number };

function summarize(values: number[]): Summary {
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    stddev: stddev(values),
  };
}

// ── Types ────────────────────────────────────────────────

type Args = {
  label: string;
  runs: number;
  skipBuild: boolean;
  compareTo: string | null;
  url: string;
};

type RunMetrics = {
  performance: number;
  lcp: number;
  fcp: number;
  tbt: number;
  speedIndex: number;
};

type ResultFile = {
  timestamp: string;
  commitSha: string;
  branch: string;
  label: string;
  url: string;
  runs: number;
  throttling: string;
  metrics: Record<keyof RunMetrics, Summary>;
  raw: RunMetrics[];
};

// ── CLI + git ────────────────────────────────────────────

function parseArgs(argv: string[]): Args {
  const args: Args = {
    label: "",
    runs: 5,
    skipBuild: false,
    compareTo: null,
    url: "/en",
  };
  for (const a of argv) {
    if (a.startsWith("--label=")) args.label = a.slice("--label=".length);
    else if (a.startsWith("--runs=")) args.runs = parseInt(a.slice("--runs=".length), 10);
    else if (a === "--skip-build") args.skipBuild = true;
    else if (a.startsWith("--compare-to=")) args.compareTo = a.slice("--compare-to=".length);
    else if (a.startsWith("--url=")) args.url = a.slice("--url=".length);
  }
  if (!args.label) {
    console.error("Error: --label=<string> is required");
    process.exit(1);
  }
  return args;
}

function getGitInfo(): { sha: string; branch: string; dirty: boolean } {
  const sha = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT }).toString().trim();
  const dirty = execSync("git status --porcelain", { cwd: ROOT }).toString().trim().length > 0;
  return { sha, branch, dirty };
}

// ── Lighthouse orchestration ─────────────────────────────

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

async function runLighthouseOnce(url: string, port: number): Promise<RunMetrics> {
  const result = await lighthouse(
    url,
    {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance"],
    },
    undefined,
  );
  if (!result) throw new Error("Lighthouse returned no result");
  const audits = result.lhr.audits;
  return {
    performance: Math.round((result.lhr.categories.performance.score ?? 0) * 100),
    lcp: Math.round(audits["largest-contentful-paint"].numericValue ?? 0),
    fcp: Math.round(audits["first-contentful-paint"].numericValue ?? 0),
    tbt: Math.round(audits["total-blocking-time"].numericValue ?? 0),
    speedIndex: Math.round(audits["speed-index"].numericValue ?? 0),
  };
}

// ── Compare target resolution ────────────────────────────

function findBaselineFile(): string | null {
  if (!existsSync(RESULTS_DIR)) return null;
  const files = readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith("-baseline.json"))
    .map((f) => ({ f, mtime: statSync(resolve(RESULTS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].f.replace(/\.json$/, "") : null;
}

function loadCompareTarget(stem: string): ResultFile | null {
  const p = resolve(RESULTS_DIR, `${stem}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as ResultFile;
}

function printDeltaTable(current: ResultFile, baseline: ResultFile): void {
  console.log(`\nCompare to perf-results/${baseline.commitSha}-${baseline.label}.json:`);
  const keys: Array<keyof RunMetrics> = ["performance", "lcp", "fcp", "tbt", "speedIndex"];
  for (const k of keys) {
    const b = baseline.metrics[k].median;
    const c = current.metrics[k].median;
    const delta = c - b;
    const sign = delta >= 0 ? "+" : "";
    const pct = b !== 0 ? ` (${sign}${((delta / b) * 100).toFixed(1)}%)` : "";
    console.log(`  ${k.padEnd(13)} ${sign}${delta}  (${b} → ${c})${pct}`);
  }
}

// ── Main ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { sha, branch, dirty } = getGitInfo();

  console.log("Kapwa Help Perf Run");
  console.log("-------------------");
  console.log(`Label:      ${args.label}`);
  console.log(`Commit:     ${sha} (${branch})${dirty ? " [dirty]" : ""}`);
  console.log(`URL:        http://localhost:${PREVIEW_PORT}${args.url}`);
  console.log(`Runs:       ${args.runs}`);
  console.log("");

  if (!args.skipBuild) {
    console.log("Building...");
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
    console.log("");
  } else if (!existsSync(resolve(ROOT, "dist"))) {
    console.error("Error: dist/ missing and --skip-build was set");
    process.exit(1);
  }

  console.log(`Starting preview on :${PREVIEW_PORT}...`);
  const preview: ChildProcess = spawn("npm", ["run", "preview", "--", "--port", String(PREVIEW_PORT)], {
    cwd: ROOT,
    stdio: "pipe",
  });

  const cleanup = () => {
    if (preview.pid && !preview.killed) preview.kill("SIGTERM");
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await waitForPort(PREVIEW_PORT);
    console.log("Preview ready.\n");

    const chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
    });

    try {
      console.log(`Running Lighthouse (${args.runs} runs)...`);
      const raw: RunMetrics[] = [];
      for (let i = 0; i < args.runs; i++) {
        try {
          const m = await runLighthouseOnce(
            `http://localhost:${PREVIEW_PORT}${args.url}`,
            chrome.port,
          );
          raw.push(m);
          console.log(
            `  Run ${i + 1}/${args.runs}: Perf ${m.performance}, LCP ${m.lcp}ms, FCP ${m.fcp}ms`,
          );
        } catch (err) {
          console.warn(`  Run ${i + 1}/${args.runs}: FAILED (${(err as Error).message}) — skipping`);
        }
      }

      if (raw.length === 0) {
        console.error("\nAll runs failed. No file written.");
        process.exit(1);
      }

      const result: ResultFile = {
        timestamp: new Date().toISOString(),
        commitSha: sha,
        branch,
        label: args.label,
        url: `http://localhost:${PREVIEW_PORT}${args.url}`,
        runs: raw.length,
        throttling: "mobile-default",
        metrics: {
          performance: summarize(raw.map((r) => r.performance)),
          lcp: summarize(raw.map((r) => r.lcp)),
          fcp: summarize(raw.map((r) => r.fcp)),
          tbt: summarize(raw.map((r) => r.tbt)),
          speedIndex: summarize(raw.map((r) => r.speedIndex)),
        },
        raw,
      };

      console.log("\nSummary (median ± stddev):");
      for (const k of Object.keys(result.metrics) as Array<keyof typeof result.metrics>) {
        const s = result.metrics[k];
        console.log(`  ${k.padEnd(13)} ${s.median} ± ${s.stddev.toFixed(1)}`);
      }

      if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
      const fileStem = `${sha}${dirty ? "-dirty" : ""}-${args.label}`;
      const outPath = resolve(RESULTS_DIR, `${fileStem}.json`);
      writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
      console.log(`\nWrote perf-results/${fileStem}.json`);

      const compareStem = args.compareTo ?? findBaselineFile();
      if (compareStem && compareStem !== fileStem) {
        const baseline = loadCompareTarget(compareStem);
        if (baseline) printDeltaTable(result, baseline);
        else console.log(`\n(No file matching ${compareStem}.json — skipping delta.)`);
      } else if (!compareStem) {
        console.log("\n(First run — no baseline to compare.)");
      }
    } finally {
      await chrome.kill();
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
