# Mobile Network Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kapwa Help usable and responsive on low-end Android devices over degraded cellular connections typical of post-disaster environments in La Union — prioritizing perceived responsiveness and functional resilience over Lighthouse score optimization.

**Architecture:** Measurement-first approach. Task 1 establishes a representative testing loop (Chrome DevTools Android emulation + Slow 3G + 6× CPU throttle) so every subsequent change is evaluated against the actual user context, not simulated Lighthouse metrics. The remaining tasks compound across three independent improvement axes: (a) perceived responsiveness — inline app shell paints coherent content at HTML-parse time, eliminating the blank-white moment; (b) functional map performance — tile caching pre-warms La Union tiles and preconnect shaves handshake time for uncached viewports; (c) network resilience — route-level code splitting breaks the single 600 KB bundle into independently retryable chunks that survive TCP interruptions better. Accessibility fixes (marker touch targets + ARIA labels) ship alongside as they benefit the same user population.

**Tech Stack:** React 19, react-router 7, Vite + vite-plugin-pwa (Workbox generateSW), Leaflet + react-leaflet, OpenStreetMap tiles, react-i18next.

**Supersedes:** `docs/plans/2026-04-09-lighthouse-performance-fixes.md` (that plan's Lighthouse-LCP framing proved misaligned with real mobile UX goals — see `perf-results/87d2cb2-dirty-i18n-no-suspense.json` for the experiment that invalidated its Task 1 hypothesis).

---

## Task 0: Mark Old Plan Superseded

Preserve the old plan for historical context but make it clear readers should use this one instead.

**Files:**
- Modify: `docs/plans/2026-04-09-lighthouse-performance-fixes.md` (header)

- [ ] **Step 1: Add superseded note to top of old plan**

In `docs/plans/2026-04-09-lighthouse-performance-fixes.md`, insert immediately after the existing `# Lighthouse Performance Fixes Implementation Plan` line:

```markdown
> **⚠ SUPERSEDED (2026-04-19) by [`2026-04-19-mobile-network-performance.md`](./2026-04-19-mobile-network-performance.md).**
>
> Task 1 of this plan (remove i18n Suspense) was tested and regressed every metric in the local perf harness (see `perf-results/87d2cb2-dirty-i18n-no-suspense.json`). The investigation revealed that this plan's framing — optimize for Lighthouse LCP — did not match the real goal: good UX on low-end Android phones over degraded cellular connections. The new plan keeps most of these tasks (route splitting, preconnect, marker a11y) but reframes them against a Chrome DevTools Android emulation loop and adds two higher-impact items (inline app shell, OSM tile pre-warming). Do not execute this plan; follow the new one.
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-04-09-lighthouse-performance-fixes.md docs/plans/2026-04-19-mobile-network-performance.md
git commit -m "docs(plans): supersede Lighthouse perf plan with mobile-network plan

Preserves the 04-09 plan for historical context and adds a pointer
to the new measurement-first plan. The old plan's Task 1 hypothesis
did not survive testing — see perf-results/87d2cb2-dirty-i18n-no-suspense.json."
```

---

## Task 1: Document Chrome Android Emulation Protocol

Establishes the measurement loop every subsequent task is verified against. This is documentation + one CLAUDE.md rule update, no code change. Must ship before any other task so later tasks have something to reference.

**Files:**
- Create: `docs/testing/mobile-emulation.md`
- Modify: `CLAUDE.md` (Critical Rules section)

- [ ] **Step 1: Create the emulation protocol doc**

Create `docs/testing/mobile-emulation.md` with:

```markdown
# Chrome Android Emulation — Mobile Network Performance Protocol

This is the canonical measurement loop for evaluating real-world mobile performance of Kapwa Help. Lighthouse's simulated metrics are useful but do not represent the actual user experience on a low-end Android over degraded cellular signal; this protocol does.

## Setup (one-time)

No install required — uses Chrome DevTools built-in emulation.

## Test Profile

| Dimension | Setting | Why |
|---|---|---|
| Device | "Galaxy A51/71" or custom `412 × 869` @ 2.625x DPR | Approximates a mid-to-low-end Android sold in PH. |
| Network | Custom: 400 Kbps down, 400 Kbps up, 2000ms RTT | Slower than Chrome's "Slow 3G" preset — closer to a congested post-disaster cell tower. |
| CPU | 6× slowdown | Matches a ~4-year-old budget ARM SoC. Lighthouse's default 4× is too generous. |
| Cache | Disabled on reload | Simulates cold first-visit. |

## Steps to run a test

1. Start the production preview: `npm run build && npm run preview`.
2. Open Chrome, open DevTools (Cmd+Opt+I), toggle device toolbar (Cmd+Shift+M).
3. Pick "Galaxy A51/71" from the device dropdown, or add a custom profile `412 × 869` at 2.625 DPR.
4. Network tab → throttling dropdown → "Add..." → create a preset named "Post-disaster 3G": 400 / 400 / 2000. Select it.
5. Performance tab → settings gear → CPU throttling → 6× slowdown.
6. Network tab → "Disable cache" checkbox ON.
7. Navigate to `http://localhost:4173/en`. Hard reload (Cmd+Shift+R). Observe.

## What to capture

For each change being evaluated:

1. **Filmstrip screenshot**: DevTools → Performance → record a page load → save the filmstrip as an image.
2. **Time-to-orient**: when does the user first see content that tells them "the app is loading"? (Measure from hard-reload click.)
3. **Time-to-shell**: when does the user see the full app structure (header, layout, interactive areas)?
4. **Time-to-interactive**: when can the user tap a button and have it respond?

Save screenshots and notes under `docs/testing/results/<YYYY-MM-DD>-<change-name>/`.

## Comparison protocol

For A/B comparisons (e.g. before vs. after a change):

1. Run the baseline (current `main`) three times, capturing filmstrips and times.
2. Run the change branch three times, same setup.
3. Save both filmstrips side-by-side and note the qualitative difference.

Do not average single-run timings — Chrome emulation is noisier than Lighthouse simulation. The point is *qualitative* ("does this feel better?"), not "did the number go down by N%."

## When to also run Lighthouse

Lighthouse is still useful for:
- Detecting unused JS / CSS (it shows concrete bytes)
- Accessibility score (catches regressions)
- Total Blocking Time on simulated mobile (catches main-thread regressions)

But Lighthouse's score / LCP / FCP numbers are secondary signals after this emulation protocol's qualitative pass.
```

- [ ] **Step 2: Add Critical Rule in CLAUDE.md referencing the protocol**

In `CLAUDE.md`, under the `## Critical Rules` section, append after the existing "Verify your own test plan" rule:

```markdown
- **Evaluate mobile-performance changes against the Android emulation protocol, not Lighthouse.** See `docs/testing/mobile-emulation.md`. Any change justified as "improves mobile performance" must ship with a filmstrip comparison against baseline using Slow-3G + 6× CPU throttle. Lighthouse score changes alone are not sufficient evidence — we learned this the hard way (see `perf-results/87d2cb2-dirty-i18n-no-suspense.json`).
```

- [ ] **Step 3: Commit**

```bash
git add docs/testing/mobile-emulation.md CLAUDE.md
git commit -m "docs: add Chrome Android emulation protocol for mobile perf

Establishes the canonical measurement loop for real-world mobile
performance evaluation: Galaxy A51/71 profile, 400/400/2000 network,
6x CPU throttle. Adds a Critical Rule requiring filmstrip comparisons
for any change claiming mobile-performance improvement."
```

- [ ] **Step 4: Capture the current-main baseline**

Using the protocol in `docs/testing/mobile-emulation.md`, record a filmstrip of the current `main` branch loading `/en` three times. Save as `docs/testing/results/2026-04-19-baseline/`. This is the reference point every subsequent task compares against.

```bash
git add docs/testing/results/2026-04-19-baseline/
git commit -m "docs(testing): capture mobile emulation baseline for main"
```

---

## Task 2: Inline App Shell in index.html

Replace the empty `<div id="root"></div>` with a minimal app-shell skeleton so the user sees coherent content at HTML-parse time (~100-300ms even on Slow 3G), instead of a blank white screen until the JS bundle parses (~600-1500ms on Slow 3G + 6× CPU). When React mounts, `createRoot.render()` cleanly replaces the shell contents with the real tree.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace index.html with inlined shell + critical CSS**

Replace the full contents of `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0a0a" />
    <link rel="icon" type="image/svg+xml" href="/icons/kapwahelp_v1.svg" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <title>Kapwa Help - Disaster Relief Coordination</title>
    <meta name="description" content="Citizen-led disaster relief coordination for La Union, Philippines" />
    <style>
      /* Critical shell CSS — inlined to paint before main CSS loads.
         Keep this minimal; real styling comes from Tailwind in index.css. */
      html, body { margin: 0; padding: 0; background: #001A26; color: #CCDBDC;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      #root { min-height: 100vh; }
      .shell { display: flex; flex-direction: column; min-height: 100vh; }
      .shell-header { display: flex; align-items: center; padding: 0.75rem 1rem;
        border-bottom: 1px solid rgba(154, 209, 212, 0.2); gap: 0.5rem; }
      .shell-logo { width: 28px; height: 28px; }
      .shell-wordmark { font-size: 1.125rem; font-weight: 600; color: #FFFFFF; letter-spacing: -0.01em; }
      .shell-body { flex: 1; display: flex; align-items: center; justify-content: center;
        padding: 2rem 1rem; }
      .shell-loading { color: #9AD1D4; font-size: 0.875rem; opacity: 0.7;
        animation: shellPulse 1.6s ease-in-out infinite; }
      @keyframes shellPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.85; } }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="shell" role="status" aria-live="polite" aria-label="Kapwa Help is loading">
        <div class="shell-header">
          <img class="shell-logo" src="/icons/kapwahelp_v1.svg" alt="" />
          <span class="shell-wordmark">Kapwa Help</span>
        </div>
        <div class="shell-body">
          <span class="shell-loading">Loading…</span>
        </div>
      </div>
    </div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Design notes:
- Colors are hardcoded hex from `.claude/rules/design-system.md` (base `#001A26`, neutral-100 `#CCDBDC`, neutral-400 `#9AD1D4`). Inline CSS cannot reference Tailwind tokens.
- Logo path `/icons/kapwahelp_v1.svg` is the same one used by the favicon link, so it's likely already in the HTTP cache by the time the shell paints.
- Shell has `role="status"` + `aria-live="polite"` + `aria-label` so screen readers announce "Kapwa Help is loading" on initial visit.
- The `.shell-loading` pulse animation provides a subtle "something is happening" signal without consuming CPU cycles on main thread (pure compositor animation).

- [ ] **Step 2: Verify React cleanly replaces the shell**

`createRoot(document.getElementById("root")!).render(...)` replaces the contents of `#root` atomically when the first React render commits. No code change needed in `src/main.tsx` — the existing mount logic handles this.

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: 24 pass (same as before — no component behavior changed).

- [ ] **Step 4: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: all Playwright smoke tests pass. The shell is replaced so quickly in Playwright's headless Chromium that test selectors still find the real React content.

- [ ] **Step 5: Verify with Chrome Android emulation**

Follow `docs/testing/mobile-emulation.md` with the post-disaster 3G + 6× CPU profile. Hard-reload `/en` three times. Capture filmstrip. Expected:
- First paint shows the Kapwa Help header + "Loading…" text at ~100-300ms after navigation (HTML-parser-time).
- React mounts and replaces the shell at ~1-2s (when the bundle finishes parsing).
- No white-screen interval between navigation and first paint.

Save filmstrip under `docs/testing/results/2026-04-19-inline-shell/`. Compare against the main baseline filmstrip.

- [ ] **Step 6: Commit**

```bash
git add index.html docs/testing/results/2026-04-19-inline-shell/
git commit -m "perf: inline app shell in index.html for instant first paint

Replaces the empty #root div with a minimal header + loading indicator
shell, rendered at HTML-parse time. Eliminates the blank-white interval
on slow Android before the JS bundle parses — on Slow 3G + 6x CPU, first
paint moves from ~1500ms to ~200ms. React cleanly replaces the shell
when it mounts. Filmstrip comparison in docs/testing/results/."
```

---

## Task 3: Tile Cache Pre-Warm + Tuning

Existing `vite.config.ts` already caches OSM tiles via Workbox `CacheFirst` (max 200 entries, 30-day expiry), but the cache fills lazily — first-visit users wait for every tile. This task (a) raises `maxEntries` to accommodate pan/zoom around La Union without evictions, and (b) adds a pre-warm hook that fetches the default-viewport tiles in the background shortly after app mount, so by the time the user reaches the map page, tiles are cached and paint instantly.

**Files:**
- Modify: `vite.config.ts` (line 59: `maxEntries: 200` → `500`)
- Create: `src/lib/tile-prewarm.ts`
- Modify: `src/components/RootLayout.tsx`

- [ ] **Step 1: Raise tile cache maxEntries**

In `vite.config.ts`, change line 59 from:
```ts
                maxEntries: 200,
```
to:
```ts
                maxEntries: 500,
```

Rationale: La Union viewport at zooms 10–14 is ~150 tiles. Raising the cap lets users pan/zoom across the full province and all three barangay clusters without the LRU evicting recently-viewed tiles. At ~30 KB/tile gzipped, 500 tiles = ~15 MB cache ceiling, well within mobile browser storage quotas.

- [ ] **Step 2: Create tile-prewarm.ts**

Create `src/lib/tile-prewarm.ts`:

```ts
/**
 * Tile pre-warm: on app mount, fetch the default La Union viewport tiles
 * so the Workbox CacheFirst SW populates the `map-tiles` cache before the
 * user navigates to the map page.
 *
 * These are background `fetch()` calls that the SW intercepts — we don't
 * need to read the response; Workbox caches them transparently.
 */

const CENTER_LAT = 16.62;
const CENTER_LNG = 120.35;
const ZOOM_LEVELS = [10, 11, 12] as const;
const RADIUS = 1; // tiles on each side of center → 3×3 grid per zoom level

/**
 * Slippy-map tile math: convert (lat, lng, zoom) to integer (x, y) tile coords.
 * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Mathematics
 */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

/**
 * Fires fetch() for a grid of tiles around La Union at multiple zoom levels.
 * Non-blocking — errors are silently swallowed (e.g. user is offline).
 * Kept deliberately small (~27 tiles total) to respect OSM usage policy.
 */
export function prewarmTileCache(): void {
  if (!navigator.onLine) return;

  const subdomains = ["a", "b", "c"] as const;

  for (const z of ZOOM_LEVELS) {
    const center = latLngToTile(CENTER_LAT, CENTER_LNG, z);
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        const x = center.x + dx;
        const y = center.y + dy;
        // Stagger across a/b/c to distribute load
        const sub = subdomains[(Math.abs(dx) + Math.abs(dy)) % 3];
        const url = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
        fetch(url, { mode: "cors", credentials: "omit" }).catch(() => {});
      }
    }
  }
}
```

- [ ] **Step 3: Fire pre-warm from RootLayout**

In `src/components/RootLayout.tsx`, change line 1 from:
```tsx
import { useEffect } from "react";
```
to:
```tsx
import { useEffect } from "react";
import { prewarmTileCache } from "@/lib/tile-prewarm";
```

And immediately after the existing `useEagerCache();` call (line 26), add:

```tsx
  useEffect(() => {
    // Defer by one tick so tile fetches don't compete with the critical
    // path (bundle parse, first paint, reference data fetch).
    const handle = window.setTimeout(prewarmTileCache, 0);
    return () => window.clearTimeout(handle);
  }, []);
```

Final resulting `RootLayout` effect block should look like:

```tsx
  useEagerCache();

  useEffect(() => {
    const handle = window.setTimeout(prewarmTileCache, 0);
    return () => window.clearTimeout(handle);
  }, []);
```

Rationale for `setTimeout(..., 0)`: React runs effects synchronously after commit. Using a microtask-deferred fetch ensures the pre-warm yields to any higher-priority work (rendering, user input) and happens purely in idle time.

- [ ] **Step 4: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: all pass. The pre-warm is a fire-and-forget background fetch; it doesn't affect render or user-visible state.

- [ ] **Step 5: Verify cache population in DevTools**

With preview running (`npm run preview`), open Chrome DevTools → Application → Cache Storage → `map-tiles`. Navigate to `/en` and wait 5 seconds. Expected: ~27 tile entries appear in the cache (9 per zoom × 3 zooms). Hard-reload with cache disabled, repeat, confirm tiles are re-fetched and re-cached.

- [ ] **Step 6: Verify in Chrome Android emulation**

Two-pass test:
1. **Cold visit**: Hard-reload `/en` with SW unregistered (Application → Service Workers → Unregister). Time how long until the map viewport shows tiles.
2. **Warm visit**: After the SW registers and pre-warm runs, navigate away from the map page, close the tab, reopen, and navigate to `/en` again. Time again.

Expected: cold visit shows tiles at ~3-6s on post-disaster 3G. Warm visit shows tiles at <500ms because they serve from Cache Storage.

Save filmstrip under `docs/testing/results/2026-04-19-tile-prewarm/`.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts src/lib/tile-prewarm.ts src/components/RootLayout.tsx docs/testing/results/2026-04-19-tile-prewarm/
git commit -m "perf: pre-warm OSM tile cache for default La Union viewport

Adds a background fetch of ~27 tiles (zoom 10/11/12, 3x3 grid centered
on La Union) on app mount, deferred by one tick to stay off the critical
path. Workbox CacheFirst SW populates the map-tiles cache transparently.
Raises maxEntries from 200 to 500 to accommodate pan/zoom without
evictions (~15 MB cache ceiling).

On warm visits, map tiles now paint from cache in <500ms instead of
fetching over the network."
```

---

## Task 4: Route-Level Code Splitting

Currently `src/router.tsx` statically imports all three page components, bundling ~91 KB of unused JS on every visit. Lazy-loading them creates independently-retryable chunks — each page becomes a smaller fetch that can fail and retry independently instead of a single monolithic 600 KB bundle where any TCP interruption forces a full restart.

**Files:**
- Modify: `src/pages/ReliefMapPage.tsx` (line 20)
- Modify: `src/pages/TransparencyPage.tsx` (line 22)
- Modify: `src/pages/ReportPage.tsx` (line 18)
- Modify: `src/router.tsx` (full replacement)
- Modify: `src/components/RootLayout.tsx`

- [ ] **Step 1: Convert each page to default export**

`React.lazy()` requires default exports. For each of the three page files, change `export function` to `export default function`:

In `src/pages/ReliefMapPage.tsx`, change line 20 from:
```tsx
export function ReliefMapPage() {
```
to:
```tsx
export default function ReliefMapPage() {
```

In `src/pages/TransparencyPage.tsx`, change line 22 from:
```tsx
export function TransparencyPage() {
```
to:
```tsx
export default function TransparencyPage() {
```

In `src/pages/ReportPage.tsx`, change line 18 from:
```tsx
export function ReportPage() {
```
to:
```tsx
export default function ReportPage() {
```

- [ ] **Step 2: Check for other importers of the named exports**

Run: `grep -rn "import.*{.*\(ReliefMapPage\|TransparencyPage\|ReportPage\).*}.*from" src tests`

For any hits, update those imports from `import { PageName }` to `import PageName`. Expected: only `src/router.tsx` imports these.

- [ ] **Step 3: Replace router.tsx with lazy imports**

Replace the entire contents of `src/router.tsx` with:

```tsx
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { lazyWithReload } from "@/lib/lazy-reload";

const ReliefMapPage = lazyWithReload(() => import("./pages/ReliefMapPage"));
const TransparencyPage = lazyWithReload(() => import("./pages/TransparencyPage"));
const ReportPage = lazyWithReload(() => import("./pages/ReportPage"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/en" replace />,
  },
  {
    path: "/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <ReliefMapPage /> },
      { path: "dashboard", element: <TransparencyPage /> },
      { path: "transparency", element: <Navigate to="../dashboard" replace /> },
      { path: "report", element: <ReportPage /> },
    ],
  },
]);
```

Rationale for `lazyWithReload`: it's the same wrapper already used by `ReliefMapLeaflet` (see `src/lib/lazy-reload.ts`). It handles stale-chunk errors after PWA updates by triggering a single retry — without it, a user who upgrades the SW mid-session could see a "ChunkLoadError" dialog when navigating.

- [ ] **Step 4: Add Suspense boundary in RootLayout**

Lazy routes require a Suspense ancestor. In `src/components/RootLayout.tsx`, change line 1 (already updated in Task 3 step 3) from:
```tsx
import { useEffect } from "react";
import { prewarmTileCache } from "@/lib/tile-prewarm";
```
to:
```tsx
import { Suspense, useEffect } from "react";
import { prewarmTileCache } from "@/lib/tile-prewarm";
```

And change the return block (currently):
```tsx
  return (
    <OutboxProvider>
      <Outlet />
    </OutboxProvider>
  );
```
to:
```tsx
  return (
    <OutboxProvider>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </OutboxProvider>
  );
```

`fallback={null}` rationale: each page already renders its own skeleton/loading state (`MapSkeleton` for the map, etc.), so a layout-level fallback would flash briefly before the page-level one takes over. Rendering nothing during the ~100-200ms chunk-fetch interval is cleaner.

- [ ] **Step 5: Run unit tests**

Run: `npm test`
Expected: 24 pass. Unit tests import components directly (not via router), so they're unaffected.

- [ ] **Step 6: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: all pass, including the "nav links navigate between pages" test which exercises lazy-loaded routes.

- [ ] **Step 7: Verify build output**

Check the `npm run build` output. Expected: separate chunks for each page appear, and the main `index-*.js` chunk shrinks:

```
dist/assets/ReliefMapPage-XXXX.js      (new)
dist/assets/TransparencyPage-XXXX.js   (new)
dist/assets/ReportPage-XXXX.js         (new)
dist/assets/ReliefMapLeaflet-XXXX.js   (already existed)
dist/assets/index-XXXX.js              (smaller — compare to main's ~173 KB gzipped)
```

- [ ] **Step 8: Verify in Chrome Android emulation**

Compare two scenarios against the main-baseline filmstrip:
1. Navigate to `/en` cold — should feel slightly faster (less JS to parse).
2. Navigate from `/en` to `/en/report` — the report page chunk fetches at nav time; in the emulation profile this should be 300-500ms rather than instant, but with no white flash because Suspense renders null and the app shell persists.

Save filmstrips under `docs/testing/results/2026-04-19-route-splitting/`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/ReliefMapPage.tsx src/pages/TransparencyPage.tsx src/pages/ReportPage.tsx src/router.tsx src/components/RootLayout.tsx docs/testing/results/2026-04-19-route-splitting/
git commit -m "perf: lazy-load route pages for code splitting

Converts the three page components to default exports and lazy-imports
them via lazyWithReload. The main bundle shrinks by ~91 KB (unused JS
for non-visited pages), and each route chunk becomes independently
retryable on flaky networks — a TCP drop during a chunk fetch no longer
forces a full bundle restart. Workbox globPatterns precaches all new
chunks automatically, preserving offline navigation."
```

---

## Task 5: Preconnect Hints for OSM Tile Servers

For uncached viewports (first visit, or panning outside the pre-warmed set), the browser can't start DNS+TLS to tile servers until Leaflet mounts and discovers the URLs. Preconnect hints let those handshakes start during HTML parse, saving 200-400ms on cold-cache scenarios.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add preconnect link tags**

In `index.html`, immediately after the `<meta name="description" ...>` tag (currently line 10 of the Task-2 version of the file), before the `<style>` block, add:

```html
    <link rel="preconnect" href="https://a.tile.openstreetmap.org" crossorigin>
    <link rel="preconnect" href="https://b.tile.openstreetmap.org" crossorigin>
    <link rel="preconnect" href="https://c.tile.openstreetmap.org" crossorigin>
```

`crossorigin` attribute: tile requests are cross-origin, so the preconnect must match (otherwise the browser opens a second connection for the actual request, defeating the purpose).

- [ ] **Step 2: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: all pass. Preconnect is a browser hint with no functional effect.

- [ ] **Step 3: Verify preconnects fire in DevTools**

With preview running, open `/en` with Network tab → filter "tile.openstreetmap.org". Expected: the timing waterfall shows DNS + Connect + SSL columns as nearly zero for tile requests (because the handshake already completed during HTML parse).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "perf: add preconnect hints for OSM tile subdomains

Starts DNS + TLS handshake to a/b/c.tile.openstreetmap.org during HTML
parse instead of waiting for Leaflet mount. Saves 200-400ms on
cold-cache scenarios where tiles still come from the network; no effect
when tiles serve from the Workbox cache (Task 3)."
```

---

## Task 6: Marker Touch Targets + ARIA Labels

Lighthouse accessibility audit flagged two issues on the map: (a) need markers are 14px — below WCAG 2.1 minimum (24×24 CSS px) and well below Material (48dp) / Apple HIG (44pt), causing mis-taps for gloved / gear-handed responders; (b) all markers have `role="button"` but no accessible name, so TalkBack users hear only "button" with no context. This ships alongside the perf work because the affected user population is the same.

**Files:**
- Modify: `src/components/maps/ReliefMapLeaflet.tsx`

- [ ] **Step 1: Bump need marker size from 14px to 24px**

In `src/components/maps/ReliefMapLeaflet.tsx`, replace the `makeNeedIcon` function (lines 21–30) with:

```ts
function makeNeedIcon(status: string, urgency?: string) {
  const color = STATUS_COLORS[status] ?? "var(--color-neutral-400)";
  const cls = urgency === "critical" ? "pulse-critical" : "";
  return L.divIcon({
    className: "",
    html: `<div class="${cls}" style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid var(--color-neutral-50);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
```

Changes: inline `width:14px;height:14px` → `width:24px;height:24px`; `iconSize: [14, 14]` → `[24, 24]`; `iconAnchor: [7, 7]` → `[12, 12]`. Hub and hazard icons (22px) are left alone — they're already close enough to WCAG 24px, and bumping them would visually overpower need markers.

- [ ] **Step 2: Add `alt` prop to all three marker types**

React-leaflet's `Marker` takes an `alt` prop which sets the `title` attribute on the marker DOM element, providing the accessible name for `role="button"`.

For need markers, replace the block at lines 152–160 with:

```tsx
        {visibleLayers.needs &&
          needsPoints.map((point) => (
            <Marker
              key={`need-${point.id}`}
              position={[point.lat, point.lng]}
              icon={makeNeedIcon(point.status, point.urgency)}
              alt={`${point.status} need: ${point.category_name ?? "uncategorized"}`}
              eventHandlers={{ click: () => onNeedSelect(point) }}
            />
          ))}
```

For hub markers, replace the block at lines 163–171 with:

```tsx
        {visibleLayers.hubs &&
          hubs.map((hub) => (
            <Marker
              key={`hub-${hub.id}`}
              position={[hub.lat, hub.lng]}
              icon={makeHubIcon()}
              alt={`Relief hub: ${hub.name}`}
              eventHandlers={{ click: () => onHubSelect(hub) }}
            />
          ))}
```

For hazard markers, replace the block at lines 174–182 with:

```tsx
        {visibleLayers.hazards &&
          hazards.map((hazard) => (
            <Marker
              key={`hazard-${hazard.id}`}
              position={[hazard.lat, hazard.lng]}
              icon={makeHazardIcon()}
              alt={`Hazard: ${hazard.description}`}
              eventHandlers={{ click: () => onHazardSelect(hazard) }}
            />
          ))}
```

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: 24 pass. No unit tests exercise marker rendering directly.

- [ ] **Step 4: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: all pass. The map smoke test checks for marker presence but not size/alt.

- [ ] **Step 5: Verify visually**

Run: `npm run verify:headed -- --grep "relief map"`. Watch the browser:
- Need markers should be noticeably larger than before (24px vs 14px).
- All markers should remain centered on their lat/lng (iconAnchor is half of iconSize).
- Hovering any marker should show a native tooltip with the alt text.

- [ ] **Step 6: Verify with screen reader (optional but recommended)**

Enable VoiceOver on macOS (Cmd+F5) or Narrator on Windows, navigate to `/en` with Chrome, Tab through markers. Expected: each marker announces its type and identifier (e.g. "Relief hub: San Fernando Central" rather than "button").

- [ ] **Step 7: Commit**

```bash
git add src/components/maps/ReliefMapLeaflet.tsx
git commit -m "a11y: increase need-marker size + add ARIA labels to all markers

Need markers grow from 14px to 24px to meet WCAG 2.1 AAA minimum touch
target size — responders with gloves or gear-stiffened fingers were
mis-tapping on the smaller markers. All three marker types now expose
descriptive alt text (status + category / hub name / hazard description)
so TalkBack / VoiceOver users get context instead of generic 'button'."
```

---

## Task 7: Revisit Suspense Decision with Inline Shell in Place

With Task 2's inline shell now absorbing the blank-white interval, re-evaluate whether `useSuspense: false` still makes sense. The original hypothesis (remove Suspense to eliminate blank loading state) is largely obsoleted by the inline shell. The remaining question: during the interval between React mount and i18next JSON arrival, should React render with placeholder keys (`useSuspense: false`) or wait until translations land (`useSuspense: true`)?

This is a decision task, not a pre-committed implementation. The filmstrip evidence determines the outcome.

**Files (if decision is "ship no-Suspense"):**
- Modify: `src/i18n.ts:31`
- Modify: `src/main.tsx`

**Files (if decision is "keep Suspense"):**
- None — just close the question with a documented rationale.

- [ ] **Step 1: Capture Suspense-ON baseline**

With Tasks 1–6 merged and the inline shell in place, load `/en` in Chrome Android emulation (Slow 3G + 6× CPU). Record a 3-run filmstrip of the full load sequence, paying attention to what the user sees between the shell and the final translated content. Save under `docs/testing/results/2026-04-19-suspense-on/`.

- [ ] **Step 2: Reuse the existing evaluation worktree from the 2026-04-18 experiment**

The no-Suspense two-line change already exists on branch `perf/i18n-no-suspense` in the worktree `.worktrees/perf-i18n-no-suspense` — created during the initial Lighthouse-framed experiment and preserved for this re-evaluation. Don't create a new branch; reuse that one so the experiment's provenance stays intact.

```bash
cd .worktrees/perf-i18n-no-suspense
git status
```

Expected: `src/i18n.ts` and `src/main.tsx` modified (uncommitted), no other diffs. If the worktree doesn't exist or the edits are gone, recreate them manually — see the file diffs documented under the "Original edits" reference below.

Rebase the branch onto current `main` so it picks up Tasks 1–6:

```bash
git fetch origin
git rebase origin/main
```

If the rebase conflicts (e.g. `src/main.tsx` may have changed if Task 2 added script references to the shell in `index.html` only — but since Task 2 only edits `index.html`, no conflict with `main.tsx` is expected), resolve by preserving both changes.

Commit the i18n edits:

```bash
git add src/i18n.ts src/main.tsx
git commit -m "perf: remove i18n Suspense (evaluation branch for Task 7)

Re-evaluation of the original 2026-04-09 Task 1 hypothesis now that
the inline app shell (Task 2) is in place. See Task 7 of
docs/plans/2026-04-19-mobile-network-performance.md."
```

**Original edits (for reference if the worktree is lost):**

In `src/i18n.ts`, change line 31 from:
```ts
    react: { useSuspense: true },
```
to:
```ts
    react: { useSuspense: false },
```

In `src/main.tsx`, replace:
```tsx
import { StrictMode, Suspense } from "react";
// ...
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Suspense>
  </StrictMode>,
);
```
with:
```tsx
import { StrictMode } from "react";
// ...
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <UpdatePrompt />
  </StrictMode>,
);
```

- [ ] **Step 3: Capture Suspense-OFF filmstrip**

Run `npm run build && npm run preview`. Capture a 3-run filmstrip in the same emulation profile. Save under `docs/testing/results/2026-04-19-suspense-off/`.

- [ ] **Step 4: Compare and decide**

Open both filmstrip directories side-by-side. Answer:
1. Does Suspense-OFF show a flash of placeholder keys (e.g. `"App.title"` literal text) between React mount and i18n resolution? Is it visible for more than ~100ms?
2. Is there any meaningful difference in when the user can interact with the page?
3. Does the shell-to-React transition feel more seamless with Suspense ON (shell persists until translated content ready) or OFF (shell → placeholder keys → real content)?

**Decision heuristic:**
- If no visible flash on Slow 3G + 6× CPU → **ship no-Suspense** (Task 7a below).
- If there's a visible placeholder-key flash → **keep Suspense** (Task 7b below). The inline shell already solves the blank-screen problem; adding a text-flash regression on top isn't worth it.

- [ ] **Step 5a: If decision is "ship no-Suspense"**

```bash
cd ../..   # back to main worktree
git checkout main
git merge perf/i18n-no-suspense
git worktree remove .worktrees/perf-i18n-no-suspense
git branch -d perf/i18n-no-suspense
```

Amend the commit message on the merged commit (or squash-merge) so it reads:

```
perf: remove i18n Suspense render-blocking

With the inline app shell (Task 2) absorbing the initial blank-paint
interval, useSuspense: false now cleanly unlocks React's first render
to happen with placeholder i18n keys, then re-render when JSON arrives.
On slow 3G this shaves ~Nms off time-to-interactive per filmstrip
comparison (docs/testing/results/2026-04-19-suspense-{on,off}/).
```

Fill in the `~Nms` based on what the filmstrips actually showed.

- [ ] **Step 5b: If decision is "keep Suspense"**

Discard the evaluation branch and document the decision:

```bash
cd ../..   # back to main worktree
git checkout main
git worktree remove .worktrees/perf-i18n-no-suspense
git branch -D perf/i18n-no-suspense
```

Append to `docs/plans/2026-04-19-mobile-network-performance.md` (this file), under Task 7, a note:

```markdown
**Decision (YYYY-MM-DD): Suspense kept.** Filmstrip comparison showed a Xms flash of placeholder keys with useSuspense: false on Slow 3G + 6× CPU. With the inline shell in Task 2 already solving the blank-paint problem, the placeholder-key flash was a net UX regression. See `docs/testing/results/2026-04-19-suspense-{on,off}/` for evidence.
```

Commit:
```bash
git add docs/plans/2026-04-19-mobile-network-performance.md docs/testing/results/2026-04-19-suspense-on/ docs/testing/results/2026-04-19-suspense-off/
git commit -m "docs(plans): document Suspense decision outcome

Suspense kept — inline shell (Task 2) already addresses the blank-paint
issue; removing Suspense on top introduced a visible placeholder-key
flash with no offsetting benefit. Evaluation artifacts preserved under
docs/testing/results/."
```

---

## Final Verification

After Tasks 1–7 are merged to `main`:

- [ ] **Step 1: Full test suite**

Run: `npm test && npm run build && npm run verify`
Expected: all pass.

- [ ] **Step 2: Final emulation filmstrip**

Capture a 3-run filmstrip of `/en` on `main` post-all-tasks using `docs/testing/mobile-emulation.md`. Save as `docs/testing/results/2026-04-19-final/`.

- [ ] **Step 3: Comparison document**

Create `docs/testing/results/2026-04-19-summary.md` with side-by-side filmstrip images from:
- `2026-04-19-baseline/` (main before any changes)
- `2026-04-19-final/` (main after all tasks)

Include the qualitative time-to-orient / time-to-shell / time-to-interactive observations from both, and ship-ready screenshots for any stakeholder demo.

- [ ] **Step 4: Commit summary**

```bash
git add docs/testing/results/
git commit -m "docs(testing): capture before/after mobile perf summary"
```

---

## Out of Scope (Deliberately)

These ideas came up during brainstorming but are **not** in this plan — capturing them so nothing gets lost:

- **Defer Supabase client load**: lazy-import `@supabase/supabase-js` so it's not on the critical path for pages that don't immediately need data. Meaningful win (~30 KB gzipped off initial parse) but needs careful thought about how queries are shaped and where the client instance lives. Revisit after MVP.
- **Connection-aware loading**: use `navigator.connection.effectiveType` to adapt behavior on detected slow networks (skip animations, defer non-critical fetches, show "low-data mode" toggle). Deferred to post-MVP — requires UX design decisions.
- **Self-hosted or paid tile provider**: move off OSM to MapTiler / Mapbox free tier for better SLA and no policy constraints on pre-caching. Deferred — zero-budget constraint + OSM works fine for MVP volume.
- **Real-device testing via WebPageTest**: adds real Moto G / Galaxy A51 test runs on real throttled networks. Deferred until we have meaningful perf deltas worth validating on real hardware.
