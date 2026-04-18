# Perf Measurement Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two measurement tools — a Lighthouse harness script and in-app `performance.mark()` instrumentation — so future perf experiments can attribute LCP/FCP deltas to specific code changes with noise-aware confidence.

**Architecture:** Two decoupled pieces. (1) `scripts/perf.ts` spawns `vite preview`, runs Lighthouse N times, computes median±stddev, writes JSON to `perf-results/<sha>-<label>.json`, and prints deltas vs. a prior baseline. (2) `src/lib/perf-log.ts` installs a `PerformanceObserver` for LCP and exposes a deduplicating `mark()` helper wired into four chain points (JS-executed, i18n-ready, cache-checked, leaflet-ready); a `?perf=1` URL param activates console logging.

**Tech Stack:** TypeScript strict mode · Vitest for unit tests · `lighthouse` + `chrome-launcher` (new devDeps) · native `PerformanceObserver` / `performance.mark()` APIs · `tsx` for running `.ts` scripts (already installed) · react-leaflet's `MapContainer.whenReady` prop.

**Reference:** `docs/superpowers/specs/2026-04-18-perf-measurement-infra-design.md`

---

## Task 1: Install Lighthouse devDependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-generated)

- [ ] **Step 1: Install `lighthouse` and `chrome-launcher` as devDependencies**

Run:
```bash
npm install --save-dev lighthouse chrome-launcher
```

Expected: both packages added under `devDependencies` in `package.json`. No changes to `dependencies`.

- [ ] **Step 2: Verify install succeeded and typecheck still passes**

Run:
```bash
npm run build
```

Expected: build completes with no TypeScript errors. The `dist/` directory is regenerated but we don't commit it.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lighthouse and chrome-launcher as devDeps"
```

---

## Task 2: Create `perf-log.ts` with deduplicating `mark()` helper (TDD)

**Files:**
- Create: `src/lib/perf-log.ts`
- Create: `src/lib/perf-log.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/perf-log.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mark } from "./perf-log";

describe("mark()", () => {
  beforeEach(() => {
    performance.clearMarks();
  });

  it("fires a performance mark the first time a name is used", () => {
    mark("test:alpha");
    const entries = performance.getEntriesByName("test:alpha");
    expect(entries.length).toBe(1);
  });

  it("deduplicates repeated calls with the same name", () => {
    mark("test:beta");
    mark("test:beta");
    mark("test:beta");
    const entries = performance.getEntriesByName("test:beta");
    expect(entries.length).toBe(1);
  });

  it("allows distinct names to each fire once", () => {
    mark("test:gamma");
    mark("test:delta");
    expect(performance.getEntriesByName("test:gamma").length).toBe(1);
    expect(performance.getEntriesByName("test:delta").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/lib/perf-log.test.ts
```

Expected: FAIL — "Cannot find module './perf-log'".

- [ ] **Step 3: Create `src/lib/perf-log.ts` with the minimal module**

```ts
/**
 * Performance instrumentation for the app critical chain.
 *
 * `mark()` records a performance.mark entry once per name per page load.
 * `installPerfLogging()` sets up the LCP observer and optional console
 * output (gated by `?perf=1` in the URL). Called from main.tsx; not
 * triggered during unit tests.
 */

type LCPEntry = PerformanceEntry & {
  element?: Element | null;
  renderTime?: number;
  loadTime?: number;
};

let lcpEntry: LCPEntry | null = null;

export function mark(name: string): void {
  if (typeof performance === "undefined") return;
  if (performance.getEntriesByName(name).length > 0) return;
  performance.mark(name);
}

export function installPerfLogging(): void {
  if (typeof window === "undefined") return;

  if (typeof PerformanceObserver !== "undefined") {
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        lcpEntry = entries[entries.length - 1] as LCPEntry;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Browser does not support LCP observer; marks still work.
    }
  }

  const active =
    new URLSearchParams(window.location.search).get("perf") === "1";
  if (!active) return;

  window.addEventListener("load", () => {
    setTimeout(logTimeline, 500);
  });
}

function logTimeline(): void {
  const marks = performance
    .getEntriesByType("mark")
    .filter((m) => m.name.startsWith("app:"))
    .sort((a, b) => a.startTime - b.startTime);

  type Row = { step: string; t: string; delta: string };
  const rows: Row[] = [{ step: "navigationStart", t: "T+0ms", delta: "—" }];

  let prev = 0;
  for (const m of marks) {
    rows.push({
      step: m.name,
      t: `T+${Math.round(m.startTime)}ms`,
      delta: `+${Math.round(m.startTime - prev)}ms`,
    });
    prev = m.startTime;
  }

  if (lcpEntry) {
    const tag = lcpEntry.element?.tagName ?? "?";
    rows.push({
      step: `LCP (${tag})`,
      t: `T+${Math.round(lcpEntry.startTime)}ms`,
      delta: `+${Math.round(lcpEntry.startTime - prev)}ms`,
    });
  }

  // eslint-disable-next-line no-console
  console.group("[perf] Kapwa Help timeline");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.groupEnd();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- src/lib/perf-log.test.ts
```

Expected: PASS — all three `mark()` tests green.

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run:
```bash
npm test
```

Expected: all pre-existing tests still pass; new `perf-log` tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perf-log.ts src/lib/perf-log.test.ts
git commit -m "feat: add perf-log module with deduplicating mark helper and LCP observer"
```

---

## Task 3: Wire marks into the four chain points

**Files:**
- Modify: `src/main.tsx` (add import + first mark)
- Modify: `src/i18n.ts` (add mark on 'loaded' event)
- Modify: `src/pages/ReliefMapPage.tsx:60` (add mark after cache read)
- Modify: `src/components/maps/ReliefMapLeaflet.tsx` (add `whenReady` prop)

- [ ] **Step 1: Wire `app:js-executed` mark and install logging in `src/main.tsx`**

Current content of `src/main.tsx`:

```tsx
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";
import UpdatePrompt from "./components/UpdatePrompt";
import "./i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Suspense>
  </StrictMode>,
);
```

Replace with:

```tsx
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { installPerfLogging, mark } from "./lib/perf-log";
import { router } from "./router";
import UpdatePrompt from "./components/UpdatePrompt";
import "./i18n";
import "./index.css";

installPerfLogging();
mark("app:js-executed");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Suspense>
  </StrictMode>,
);
```

- [ ] **Step 2: Wire `app:i18n-ready` mark in `src/i18n.ts`**

Current content of `src/i18n.ts`:

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

export const supportedLocales = ["en", "fil", "ilo"] as const;
export type Locale = (typeof supportedLocales)[number];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: supportedLocales,
    defaultNS: "translation",

    interpolation: { escapeValue: false },

    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },

    detection: {
      order: ["path"],
      lookupFromPathIndex: 0,
      caches: [],
    },

    react: { useSuspense: true },
  });

export default i18n;
```

Replace with:

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { mark } from "./lib/perf-log";

export const supportedLocales = ["en", "fil", "ilo"] as const;
export type Locale = (typeof supportedLocales)[number];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: supportedLocales,
    defaultNS: "translation",

    interpolation: { escapeValue: false },

    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },

    detection: {
      order: ["path"],
      lookupFromPathIndex: 0,
      caches: [],
    },

    react: { useSuspense: true },
  });

// Fires the first time any namespace resolves; `mark()` dedupes on
// subsequent locale switches so only the cold-load timing is captured.
i18n.on("loaded", () => {
  mark("app:i18n-ready");
});

export default i18n;
```

- [ ] **Step 3: Wire `app:cache-checked` mark in `src/pages/ReliefMapPage.tsx`**

Find this block (starts around line 58):

```tsx
  useEffect(() => {
    async function init() {
      const cached = await getCachedReliefMap();
      if (cached) {
        setData(cached.data);
        setUpdatedAt(new Date(cached.updatedAt));
        setLoading(false);
        hasDataRef.current = true;
      }
      fetchData();
    }
    init();
  }, [fetchData]);
```

Replace with:

```tsx
  useEffect(() => {
    async function init() {
      const cached = await getCachedReliefMap();
      mark("app:cache-checked");
      if (cached) {
        setData(cached.data);
        setUpdatedAt(new Date(cached.updatedAt));
        setLoading(false);
        hasDataRef.current = true;
      }
      fetchData();
    }
    init();
  }, [fetchData]);
```

And add the import near the top of the file — find this block:

```tsx
import {
  getCachedReliefMap,
  setCachedReliefMap,
  type ReliefMapData,
} from "@/lib/cache";
```

Add a new import line right after it:

```tsx
import { mark } from "@/lib/perf-log";
```

- [ ] **Step 4: Wire `app:leaflet-ready` mark in `src/components/maps/ReliefMapLeaflet.tsx`**

Find this block (around line 131):

```tsx
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
```

Replace with:

```tsx
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        whenReady={() => mark("app:leaflet-ready")}
      >
```

And add the import at the top of the file — find this block:

```tsx
import L from "leaflet";
import type { NeedPoint, HubPoint, HazardPoint } from "@/lib/queries";
```

Add right after it:

```tsx
import { mark } from "@/lib/perf-log";
```

- [ ] **Step 5: Run typecheck to confirm no type errors**

Run:
```bash
npm run build
```

Expected: build succeeds. No TypeScript errors. The output mentions that `dist/` was regenerated — don't commit it.

- [ ] **Step 6: Manual verification in dev server**

Run:
```bash
npm run dev
```

Then in a browser open `http://localhost:5173/en?perf=1` and open the DevTools console.

Expected: After the page loads and ~500ms pass, a console group titled `[perf] Kapwa Help timeline` appears with a table containing these rows in order:

- `navigationStart` (T+0ms)
- `app:js-executed`
- `app:i18n-ready`
- `app:cache-checked`
- `app:leaflet-ready`
- `LCP (IMG)` (or similar — whatever the LCP element was)

Values monotonically increase, deltas are positive.

Then open `http://localhost:5173/en` (no `?perf=1`). Expected: no `[perf]` output in console.

Stop the dev server with Ctrl+C.

- [ ] **Step 7: Run the smoke tests to confirm no regressions**

Run:
```bash
npm run verify
```

Expected: all Playwright smoke tests pass. No visual regressions — we only added instrumentation.

- [ ] **Step 8: Commit**

```bash
git add src/main.tsx src/i18n.ts src/pages/ReliefMapPage.tsx src/components/maps/ReliefMapLeaflet.tsx
git commit -m "feat: instrument critical-chain marks for perf diagnostics"
```

---

## Task 4: Create `perf-stats.ts` helpers with TDD

**Files:**
- Create: `scripts/perf-stats.ts`
- Create: `scripts/perf-stats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/perf-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { median, stddev, summarize } from "./perf-stats";

describe("median", () => {
  it("returns the middle value of an odd-length sorted list", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it("returns the average of the two middle values for even-length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("does not require input to be pre-sorted", () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
  });

  it("handles a single-element array", () => {
    expect(median([42])).toBe(42);
  });
});

describe("stddev", () => {
  it("returns 0 for a constant list", () => {
    expect(stddev([5, 5, 5, 5])).toBe(0);
  });

  it("returns the population stddev for a known list", () => {
    // values: 2, 4, 4, 4, 5, 5, 7, 9 → mean 5, variance 4, stddev 2
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it("returns 0 for a single-element array (no variance)", () => {
    expect(stddev([10])).toBe(0);
  });
});

describe("summarize", () => {
  it("returns median, min, max, and stddev for a list", () => {
    const result = summarize([10, 20, 30, 40, 50]);
    expect(result.median).toBe(30);
    expect(result.min).toBe(10);
    expect(result.max).toBe(50);
    expect(result.stddev).toBeCloseTo(14.142, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- scripts/perf-stats.test.ts
```

Expected: FAIL — "Cannot find module './perf-stats'".

- [ ] **Step 3: Create `scripts/perf-stats.ts`**

```ts
/** Pure statistical helpers for the perf harness. */

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export type Summary = {
  median: number;
  min: number;
  max: number;
  stddev: number;
};

export function summarize(values: number[]): Summary {
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    stddev: stddev(values),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- scripts/perf-stats.test.ts
```

Expected: PASS — all stats tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/perf-stats.ts scripts/perf-stats.test.ts
git commit -m "feat: add perf-stats helpers (median, stddev, summarize)"
```

---

## Task 5: Create `scripts/perf.ts` Lighthouse harness

**Files:**
- Create: `scripts/perf.ts`

- [ ] **Step 1: Create `scripts/perf.ts` with the harness**

```ts
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
import { summarize, type Summary } from "./perf-stats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RESULTS_DIR = resolve(ROOT, "perf-results");
const PREVIEW_PORT = 4173;

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

function waitForPort(port: number, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      const sock = createConnection({ port, host: "127.0.0.1" });
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
```

- [ ] **Step 2: Verify the script typechecks**

Run:
```bash
npx tsc --noEmit scripts/perf.ts
```

Expected: no TypeScript errors. If `tsc` reports errors about missing types for `lighthouse` or `chrome-launcher`, the `npm install` from Task 1 should have included type declarations — reinstall if needed.

- [ ] **Step 3: Commit**

```bash
git add scripts/perf.ts
git commit -m "feat: add perf harness script"
```

---

## Task 6: Wire npm script and create `perf-results/` directory

**Files:**
- Modify: `package.json` (add `perf` script)
- Create: `perf-results/.gitkeep`

- [ ] **Step 1: Add `perf` script to `package.json`**

Find the `scripts` block:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "translate": "tsx scripts/translate.ts",
    "verify": "npx playwright test",
    "verify:headed": "npx playwright test --headed"
  },
```

Replace with:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "translate": "tsx scripts/translate.ts",
    "perf": "tsx scripts/perf.ts",
    "verify": "npx playwright test",
    "verify:headed": "npx playwright test --headed"
  },
```

- [ ] **Step 2: Create `perf-results/.gitkeep`**

Run:
```bash
mkdir -p perf-results && touch perf-results/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add package.json perf-results/.gitkeep
git commit -m "chore: add perf npm script and perf-results directory"
```

---

## Task 7: Capture baseline measurement

**Files:**
- Create: `perf-results/<sha>-baseline.json` (auto-generated by the script)

- [ ] **Step 1: Run the baseline measurement**

Run:
```bash
npm run perf -- --label=baseline
```

Expected behavior:
- Prints "Building...", completes in ~10s
- Prints "Starting preview on :4173...", "Preview ready."
- Prints five "Run X/5: Perf ##, LCP ####ms, FCP ####ms" lines
- Prints summary block with median ± stddev for each metric
- Prints "(First run — no baseline to compare.)"
- Writes `perf-results/<short-sha>-baseline.json`

- [ ] **Step 2: Verify the baseline file exists and has expected shape**

Run:
```bash
ls perf-results/
cat perf-results/*-baseline.json | head -30
```

Expected: one file matching `<sha>-baseline.json` exists. The JSON includes `timestamp`, `commitSha`, `branch`, `metrics` (with `performance`, `lcp`, `fcp`, `tbt`, `speedIndex` each having `median`, `min`, `max`, `stddev`), and a `raw` array of 5 runs.

- [ ] **Step 3: Sanity-check the numbers against the findings doc**

The current findings doc (`docs/loading-performance-findings.md`) records:
- Performance: 86
- LCP: 4.1s (4100ms)
- FCP: 1.9s (1900ms)
- TBT: 0ms

Your baseline median should be within ~10% of these values. If numbers are dramatically different (e.g., LCP 10s or Performance 30), something is wrong — debug before committing. Rerun with `--runs=9` if stddev on LCP exceeds 300ms to get a tighter read.

- [ ] **Step 4: Commit the baseline**

```bash
git add perf-results/
git commit -m "perf: capture baseline measurement for future experiments"
```

- [ ] **Step 5: Run the full test suite one more time**

Run:
```bash
npm test && npm run verify
```

Expected: all unit tests and Playwright smoke tests pass.

---

## Post-implementation: verification checklist

Before opening the PR, confirm:

- [ ] `npm test` passes (includes new `perf-log` and `perf-stats` tests)
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm run verify` passes all Playwright smoke tests
- [ ] `npm run dev` → `http://localhost:5173/en?perf=1` shows `[perf] Kapwa Help timeline` in console
- [ ] `npm run dev` → `http://localhost:5173/en` (no query param) shows no `[perf]` output
- [ ] `npm run perf -- --label=test-rerun` produces a delta table against the committed baseline (deltas should be ~0 since no app code changed since baseline)
- [ ] `perf-results/<sha>-baseline.json` committed and matches findings-doc numbers within ~10%
