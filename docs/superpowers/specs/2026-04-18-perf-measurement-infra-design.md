# Perf Measurement Infrastructure — Design

**Date:** 2026-04-18
**Status:** Design approved, ready for implementation plan
**Related:** [Issue #89](https://github.com/kapwa-help/kapwa-help/issues/89) · `docs/loading-performance-findings.md` · PR #88 (preserved, unmerged)

## Problem

Performance work on `perf/lighthouse-fixes` (PR #88) stacked five changes on a single branch and ran a single Lighthouse pass at the end. The result: we couldn't tell which commit helped, which hurt, or which was swamped by Lighthouse's run-to-run variance (~±10-15% on LCP). The final conclusion — "no perf improvement" — could have masked real wins that were cancelled by a simultaneous regression.

Before attempting any further optimization work (hero element, killing the i18n Suspense gate, etc. per `docs/loading-performance-findings.md`), we need measurement discipline that can attribute specific LCP / FCP / TBT deltas to specific code changes, distinguish signal from noise, and surface per-step diagnostic information.

## Goal

Establish two complementary measurement tools that together let us run one-change-at-a-time perf experiments with high confidence, and that provide per-step diagnostics usable on real devices (not just localhost).

### Non-goals

- **Not making the app faster.** Baseline measurements after this PR should match current Lighthouse results (Performance 86, LCP 4.1s).
- **Not setting up CI/Vercel Lighthouse integration.** Deferred (see `docs/loading-performance-findings.md` Priority 4).
- **No changes to application behavior.** No routes, components, or logic modified — only new files and marker additions.

## Architecture

Two independent pieces:

```
┌──────────────────────────────────────────────────────────────┐
│  Part A: Dev-only Lighthouse harness                         │
│    scripts/perf.ts                                            │
│    └─ Spawns vite preview → runs Lighthouse N times           │
│       → writes perf-results/<sha>-<label>.json                │
│       → prints delta vs prior baseline                        │
│    package.json: "perf": "tsx scripts/perf.ts"                │
│    Dev deps: lighthouse, chrome-launcher                      │
│                                                               │
│  Part B: Browser-side instrumentation (ships to prod)         │
│    src/lib/perf-log.ts    ← LCP PerformanceObserver + logger  │
│    src/main.tsx           ← import + mark('app:js-executed')  │
│    src/i18n.ts            ← mark('app:i18n-ready')            │
│    src/pages/ReliefMapPage.tsx  ← mark('app:cache-checked')   │
│    src/components/maps/ReliefMapLeaflet.tsx                   │
│                           ← whenReady={mark('app:leaflet-ready')}│
│                                                               │
│  Results storage                                              │
│    perf-results/*.json (git-tracked)                          │
└──────────────────────────────────────────────────────────────┘
```

Part A and Part B are fully decoupled. A does not read marks from B (end-to-end Lighthouse only). B does not need A. They serve distinct purposes:

| Part | Measures | Where it runs | Primary use |
|------|----------|---------------|-------------|
| A | End-to-end Lighthouse metrics | Localhost, dev machine | Fast iteration: "did this change move the score?" |
| B | Per-step timings in the critical chain | Any browser, any device | Diagnosis: "which step got faster?" + real-device debugging via `?perf=1` |

## Part A: `scripts/perf.ts`

### CLI interface

```bash
npm run perf -- --label=baseline                       # standard run
npm run perf -- --label=hero-experiment --runs=9       # tighter confidence
npm run perf -- --label=quick --skip-build             # reuse existing dist/
npm run perf -- --label=x --compare-to=abc1234-baseline  # custom compare target
```

Required: `--label=<string>`. Optional: `--runs=<N>` (default 5), `--skip-build`, `--compare-to=<filename-stem>`, `--url=<path>` (default `/en`).

### Flow

1. Parse + validate args
2. Unless `--skip-build`: run `npm run build`
3. Spawn `vite preview` on port 4173 (child process)
4. Poll port every 100ms, fail if not responsive within 10s
5. Launch headless Chrome via `chrome-launcher`
6. Run Lighthouse N times against the preview URL
7. Extract per-run metrics: `performance`, `lcp`, `fcp`, `tbt`, `speedIndex`
8. Compute median, min, max, stddev per metric
9. Read git SHA + branch via `git rev-parse`
10. Write JSON to `perf-results/<sha>-<label>.json` (or `<sha>-dirty-<label>.json` if working tree is dirty)
11. Locate compare-to target (default: most recent `label=baseline` file) and compute deltas
12. Print summary + delta table
13. Clean up: kill Chrome, kill preview server (handle SIGINT)

### Lighthouse config

- **Preset:** `mobile` (4× CPU throttle, Slow 4G network — Lighthouse default)
- **Categories:** `['performance']` only (~3× faster per run than full audit)
- **Output:** JSON
- **Runs:** 5 default; no warmup discard (median is robust to outliers)

### Dev dependencies

| Package | Purpose |
|---------|---------|
| `lighthouse` | Node API for programmatic runs |
| `chrome-launcher` | Spawns clean headless Chrome |
| `tsx` | Only if not already present — runs `.ts` scripts directly. Check first; `scripts/translate.ts` may already require it. |

No new runtime dependencies.

### Error handling

| Situation | Behavior |
|-----------|----------|
| Uncommitted working tree changes | Filename becomes `<sha>-dirty-<label>.json`; warning at top of output |
| `dist/` missing and `--skip-build` set | Exit 1 with clear message |
| Preview port fails to open within 10s | Exit 1, kill any child process |
| Individual Lighthouse run throws | Drop that run, note in summary, continue with remaining runs |
| All runs fail | Exit 1, no file written |
| No prior baseline found | Skip delta table, print `first run — no baseline to compare` |
| SIGINT (Ctrl+C) | Clean up preview server + Chrome before exiting |

### Example output

```
Kapwa Help Perf Run
-------------------
Label:      after-kill-loading-gate
Commit:     abc1234 (perf/experiment-2)
URL:        http://localhost:4173/en
Runs:       5

Building... ✓ (8.2s)
Starting preview on :4173... ✓
Running Lighthouse (5 runs)...
  Run 1/5: Perf 88, LCP 3847ms, FCP 1850ms
  Run 2/5: Perf 87, LCP 3920ms
  Run 3/5: Perf 89, LCP 3780ms
  Run 4/5: Perf 86, LCP 4010ms
  Run 5/5: Perf 88, LCP 3880ms

Summary (median ± stddev):
  Performance:  88 ± 1.0
  LCP:       3880ms ± 87ms
  FCP:       1840ms ± 18ms
  TBT:          0ms ± 0ms

Compare to perf-results/5a56495-baseline.json:
  Performance:  +2  (86 → 88)
  LCP:       -240ms  (4120 → 3880)   ⬇ 5.8%
  FCP:        -80ms  (1920 → 1840)   ⬇ 4.2%

Wrote perf-results/abc1234-after-kill-loading-gate.json
```

## Part B: Browser-side instrumentation

### Marks to install

| Mark | Fires when | Location |
|------|-----------|----------|
| `app:js-executed` | Main bundle parsed + executing | `src/main.tsx`, top (after imports) |
| `app:i18n-ready` | First locale translation JSON loaded | `src/i18n.ts`, via `i18n.on('loaded', ...)` — deduplicated so locale switches don't re-trigger |
| `app:cache-checked` | IndexedDB read for relief-map cache resolves (hit or miss) | `src/pages/ReliefMapPage.tsx:60`, immediately after `const cached = await getCachedReliefMap()` |
| `app:leaflet-ready` | Leaflet's `MapContainer.whenReady` callback fires | `src/components/maps/ReliefMapLeaflet.tsx`, `whenReady` prop |
| LCP | Browser fires `largest-contentful-paint` PerformanceObserver entry | Captured by observer in `perf-log.ts`; not a manual mark |

All marks use a shared `mark()` helper exported from `perf-log.ts` that deduplicates by name — only the first occurrence fires per page load.

### `src/lib/perf-log.ts` behavior

On module import (imported from `src/main.tsx` as a side-effect):

1. Guard on `typeof window !== 'undefined'` (SSR-safety)
2. Install `PerformanceObserver` for `type: 'largest-contentful-paint'`, `buffered: true`
   - Wrapped in `try/catch` — silent no-op on browsers that don't support it
   - Keep reference to the latest LCP entry
3. Check `new URLSearchParams(location.search).get('perf') === '1'`
4. If active: on `window.load` event + 500ms delay, print a `console.table` of all `app:*` marks plus the final LCP entry
5. Export a `mark(name: string): void` helper that wraps `performance.mark` with dedupe

### Type handling

`LargestContentfulPaint` interface isn't consistently in TS's DOM lib. Inline a minimal local type in `perf-log.ts`:

```ts
type LCPEntry = PerformanceEntry & {
  element?: Element | null;
  renderTime?: number;
  loadTime?: number;
};
```

No new `@types/*` deps.

### Example console output (with `?perf=1`)

```
[perf] Kapwa Help timeline
┌─────────┬───────────────────────┬─────────────┬──────────┐
│ (index) │ step                  │ t           │ delta    │
├─────────┼───────────────────────┼─────────────┼──────────┤
│ 0       │ 'navigationStart'     │ 'T+0ms'     │ '—'      │
│ 1       │ 'app:js-executed'     │ 'T+620ms'   │ '+620ms' │
│ 2       │ 'app:i18n-ready'      │ 'T+1040ms'  │ '+420ms' │
│ 3       │ 'app:cache-checked'   │ 'T+1180ms'  │ '+140ms' │
│ 4       │ 'app:leaflet-ready'   │ 'T+2240ms'  │ '+1060ms'│
│ 5       │ 'LCP (IMG tile)'      │ 'T+4120ms'  │ '+1880ms'│
└─────────┴───────────────────────┴─────────────┴──────────┘
```

### Production behavior

| Request | Behavior | Cost |
|---------|----------|------|
| `kapwahelp.org/en` | Marks fire silently, LCP observer runs, no console output | ~5µs total |
| `kapwahelp.org/en?perf=1` | Same + `console.table` after `load` + 500ms | ~5µs + ~1ms table render |
| DevTools Performance recording in prod | Marks visible in Timings track of the flame chart | Unchanged |
| Remote-debugging a real Android via USB | Same marks + LCP visible in desktop DevTools | Unchanged |

Marks fire in production (not stripped). This enables real-device diagnosis of the slow-older-phones question noted in `docs/loading-performance-findings.md` — testers can open `?perf=1` and paste console output, or a developer can USB-debug a real phone.

## Results storage

### File naming

```
perf-results/
  .gitkeep
  <commit-sha>-<label>.json            # clean working tree
  <commit-sha>-dirty-<label>.json      # dirty working tree (warn + allow)
```

Examples:
```
perf-results/a9bd7ad-baseline.json
perf-results/a9bd7ad-baseline-rerun.json
perf-results/abc1234-hero-element.json
perf-results/def5678-kill-loading-gate.json
```

### JSON shape

```json
{
  "timestamp": "2026-04-18T14:32:11.000Z",
  "commitSha": "abc1234",
  "branch": "perf/measurement-infra",
  "label": "baseline",
  "url": "http://localhost:4173/en",
  "runs": 5,
  "throttling": "mobile-default",
  "metrics": {
    "performance":  { "median": 86,   "min": 84,   "max": 89,   "stddev": 1.8 },
    "lcp":          { "median": 4120, "min": 3900, "max": 4350, "stddev": 170 },
    "fcp":          { "median": 1920, "min": 1800, "max": 2050, "stddev": 90  },
    "tbt":          { "median": 0,    "min": 0,    "max": 0,    "stddev": 0   },
    "speedIndex":   { "median": 2800, "min": 2600, "max": 3000, "stddev": 150 }
  },
  "raw": [
    { "performance": 86, "lcp": 4120, "fcp": 1920, "tbt": 0, "speedIndex": 2800 }
  ]
}
```

### Why git-tracked

- Files are ~2KB each; 100 experiments = 200KB total
- Enforces the discipline "measure before you change" — baseline must be committed
- Makes performance history auditable via `git log perf-results/`

## Workflow this infrastructure unlocks

```bash
# One-time: refresh baseline on main
git checkout main && git pull
npm run perf -- --label=baseline
git add perf-results/ && git commit -m "perf: refresh baseline"

# Per experiment:
git checkout -b perf/experiment-<hypothesis>
# ... make ONE change ...
npm run perf -- --label=<hypothesis>
# Read the delta table. Decide.

# If wins:
git commit -am "perf: <what changed>" && gh pr create

# If loses:
git checkout main && git branch -D perf/experiment-<hypothesis>
# No cleanup needed — infra stays on main.
```

### Noise floor discipline

Every delta in the script output is accompanied by the baseline's stddev. **Rule of thumb: a delta smaller than ~2× the baseline stddev is noise.**

If baseline stddev is high (>200ms on LCP), bump to `--runs=9` for tighter confidence intervals (~3 min vs 90 s).

This is the core protection against the PR #88 failure mode: distinguishing "didn't help" from "too noisy to tell."

## Testing the infrastructure

### Part A manual verification

1. Run on current `main` → inspect JSON output, confirm format and metric ranges
2. Add a known regression (e.g., a synchronous 500KB import in `main.tsx`) → confirm LCP gets meaningfully worse
3. Revert → confirm deltas return to ~0

### Part B manual verification

1. `npm run dev`, open `http://localhost:5173/en?perf=1` → confirm `[perf]` console table appears after load
2. All 5 rows present (`navigationStart`, 4 marks, LCP), values monotonically increasing
3. Open `/en` without `?perf=1` → no console output
4. Open DevTools Performance panel on any URL → marks visible in Timings track

### No new Playwright tests

The measurement infrastructure is developer tooling, not user-facing behavior. Regressions surface immediately on the next experiment — e2e coverage adds maintenance overhead for little gain.

## Design decisions (all resolved)

| Decision | Answer |
|----------|--------|
| Activation mechanism (Part B) | `?perf=1` URL query param only — no localStorage |
| Results storage | Git-tracked at `perf-results/<sha>-<label>.json` |
| Default run count | 5 |
| Default URL path for script | `/en` |
| Default script behavior | Build + measure (opt out with `--skip-build`) |
| Strip marks in prod builds | No — marks fire silently in prod |
| Strip LCP observer in prod | No — observer runs silently in prod |
| New Playwright smoke tests | None |

## Scope

### In scope

- `scripts/perf.ts` (~100-150 lines)
- `src/lib/perf-log.ts` (~50 lines)
- 4 `mark()` call-sites across existing files (one line each)
- `perf-results/.gitkeep` + initial baseline JSON committed
- `package.json` script entry + up to 3 new devDependencies

### Out of scope

- Any change to app behavior, routes, or components (beyond adding `mark()` call-sites and a `whenReady` prop)
- CI/CD or Vercel integration
- Production runtime dependencies
- New e2e/smoke tests
- Any perf *optimization* — that's follow-up experiment PRs

## Implementation order

Part A and Part B are independent; either can be built first. Suggested order (to be finalized in the implementation plan):

1. Part B (instrumentation) — smaller surface, stands alone, immediately useful in dev via `?perf=1`
2. Part A (script) — requires working preview + Lighthouse harness; slightly more setup
3. Capture baseline, commit result JSON
4. Manual verification of both parts
