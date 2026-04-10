# Lighthouse Performance Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce LCP from 4.1s to under 2.5s on simulated mobile by breaking the render-blocking dependency chain, splitting route bundles, and improving map marker accessibility.

**Architecture:** Four independent fixes that compound: (1) remove i18n Suspense render-blocking, (2) lazy-load route pages so only the visited page's JS is parsed on navigation, (3) add preconnect hints for OSM tile servers so DNS/TLS starts during JS parse, (4) add aria-labels and increase touch targets on map markers. All fixes preserve offline-first behavior — the Workbox `globPatterns` precache catches all split chunks automatically.

**Tech Stack:** React 19, react-router 7, i18next, Leaflet, react-leaflet, Vite + vite-plugin-pwa (Workbox)

---

## Task 1: Remove i18n Render-Blocking Suspense

The i18n config uses `useSuspense: true`, which blocks the entire React render tree until translation JSON is fetched over the network. This adds ~500ms-1s to LCP on mobile. Switching to async mode lets React render immediately with English fallback keys while translations load in the background.

**Files:**
- Modify: `src/i18n.ts:30`
- Modify: `src/main.tsx:11`

**Step 1: Update i18n config to disable Suspense**

In `src/i18n.ts`, change line 30 from:
```ts
react: { useSuspense: true },
```
to:
```ts
react: { useSuspense: false },
```

**Step 2: Remove the Suspense wrapper from main.tsx**

In `src/main.tsx`, the `<Suspense>` wrapper around `<RouterProvider>` was there primarily for i18n. Remove it:

Change:
```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Suspense>
  </StrictMode>,
);
```
to:
```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <UpdatePrompt />
  </StrictMode>,
);
```

Also remove the unused `Suspense` import:
```ts
import { StrictMode } from "react";
```

**Step 3: Run unit tests**

Run: `npm test`
Expected: All existing tests pass (no tests depend on i18n Suspense behavior).

**Step 4: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: All Playwright smoke tests pass. Pages still render with correct translations (the HTTP backend loads fast enough that by the time Playwright checks, translations are present).

**Step 5: Commit**

```bash
git add src/i18n.ts src/main.tsx
git commit -m "perf: remove i18n Suspense render-blocking

Switches react-i18next to async mode (useSuspense: false) so the
React tree renders immediately instead of waiting for translation
JSON to arrive over the network. Reduces LCP by ~500ms on mobile."
```

---

## Task 2: Route-Level Code Splitting

All three page components (ReliefMapPage, TransparencyPage, ReportPage) are statically imported in `router.tsx`, bundling ~91 KB of unused JS on every page visit. Lazy-loading them creates separate chunks that are only parsed when navigated to. The Workbox `globPatterns: ["**/*.{js,...}"]` precache automatically picks up all new chunks, so offline navigation still works.

**Files:**
- Modify: `src/router.tsx`

**Step 1: Convert static imports to lazy imports**

Replace the entire contents of `src/router.tsx` with:

```tsx
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { lazyWithReload } from "@/lib/lazy-reload";

const ReliefMapPage = lazyWithReload(
  () => import("./pages/ReliefMapPage")
);
const TransparencyPage = lazyWithReload(
  () => import("./pages/TransparencyPage")
);
const ReportPage = lazyWithReload(
  () => import("./pages/ReportPage")
);

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
      { path: "report", element: <ReportPage /> },
    ],
  },
]);
```

This reuses `lazyWithReload` from `src/lib/lazy-reload.ts` (already used for `ReliefMapLeaflet`) which provides single-retry on stale chunk errors after PWA deploys.

**Step 2: Verify pages export default**

Each page must have a `default` export for `React.lazy()` to work. Verify:
- `src/pages/ReliefMapPage.tsx` — uses `export function ReliefMapPage`. Needs changing to `export default function ReliefMapPage`.
- `src/pages/TransparencyPage.tsx` — uses `export function TransparencyPage`. Needs changing to `export default function TransparencyPage`.
- `src/pages/ReportPage.tsx` — uses `export function ReportPage`. Needs changing to `export default function ReportPage`.

In each file, change `export function` to `export default function`. Remove any named re-exports if present.

**Step 3: Add Suspense boundary in RootLayout**

Lazy-loaded routes need a Suspense boundary. Add one in `RootLayout` around the `<Outlet />`:

In `src/components/RootLayout.tsx`, change:
```tsx
import { useEffect } from "react";
```
to:
```tsx
import { Suspense, useEffect } from "react";
```

And change:
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

Using `fallback={null}` because each page already has its own loading states (MapSkeleton for the map, etc.), so a layout-level fallback would flash unnecessarily.

**Step 4: Run unit tests**

Run: `npm test`
Expected: All pass. Unit tests import components directly, not through the router.

**Step 5: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: All Playwright smoke tests pass. Verify that navigation between pages works (the "nav links navigate between pages" test covers this).

**Step 6: Verify build output shows separate chunks**

Run: `npm run build`
Expected: Build output shows separate chunks for each page:
```
dist/assets/ReliefMapPage-XXXX.js
dist/assets/TransparencyPage-XXXX.js
dist/assets/ReportPage-XXXX.js
dist/assets/ReliefMapLeaflet-XXXX.js  (already existed)
dist/assets/index-XXXX.js             (smaller than before)
```

The main `index-XXXX.js` chunk should be noticeably smaller (was 172 KB gzipped).

**Step 7: Commit**

```bash
git add src/router.tsx src/pages/ReliefMapPage.tsx src/pages/TransparencyPage.tsx src/pages/ReportPage.tsx src/components/RootLayout.tsx
git commit -m "perf: lazy-load route pages for code splitting

Converts ReliefMapPage, TransparencyPage, and ReportPage to lazy
imports via lazyWithReload. Reduces initial JS parse by ~91 KB of
unused code per page. Workbox globPatterns precache picks up all
new chunks automatically, preserving offline navigation."
```

---

## Task 3: Add Preconnect Hints for OSM Tile Servers

The browser can't discover map tile URLs until Leaflet mounts and calculates the viewport. Adding preconnect hints lets the browser start DNS lookup + TCP + TLS handshake to the tile servers immediately during HTML parse, saving 200-400ms on real mobile networks.

**Files:**
- Modify: `index.html:5` (inside `<head>`)

**Step 1: Add preconnect link tags**

In `index.html`, add these lines after the viewport meta tag (line 5):

```html
    <link rel="preconnect" href="https://a.tile.openstreetmap.org" crossorigin>
    <link rel="preconnect" href="https://b.tile.openstreetmap.org" crossorigin>
    <link rel="preconnect" href="https://c.tile.openstreetmap.org" crossorigin>
```

The `crossorigin` attribute is needed because tile fetches are cross-origin requests.

**Step 2: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: All pass. Preconnect is purely a browser hint — no functional change.

**Step 3: Commit**

```bash
git add index.html
git commit -m "perf: add preconnect hints for OSM tile servers

Lets the browser start DNS/TLS handshake to tile servers during
HTML parse, before Leaflet mounts. Saves 200-400ms on real mobile
networks where DNS+TLS is the bottleneck."
```

---

## Task 4: Improve Map Marker Accessibility and Touch Targets

Lighthouse flagged two accessibility issues: (1) map markers have `role="button"` but no accessible name (screen readers can't describe them), and (2) need markers are 14x14px, below the 24x24px minimum touch target size. Both issues affect usability on small phone screens during disaster response.

**Files:**
- Modify: `src/components/maps/ReliefMapLeaflet.tsx:20-28` (need icon), `31-39` (hub icon), `42-52` (hazard icon), `150-158` (need markers), `161-168` (hub markers), `172-179` (hazard markers)

**Step 1: Increase need marker size from 14px to 24px**

In `src/components/maps/ReliefMapLeaflet.tsx`, update `makeNeedIcon`:

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

Changes: `14px` → `24px` for width/height, `iconSize: [14, 14]` → `[24, 24]`, `iconAnchor: [7, 7]` → `[12, 12]`.

**Step 2: Add aria-labels to all markers**

Leaflet's `Marker` component doesn't support `aria-label` directly. We need to use the `alt` property on the icon (for image-based markers) or set attributes via `eventHandlers`. The cleanest approach is to use Marker's built-in `alt` prop which sets `aria-label` on the marker element.

Update need markers (around line 152):
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

Update hub markers (around line 163):
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

Update hazard markers (around line 174):
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

Note: `alt` on react-leaflet `Marker` sets `title` on the marker element. For `divIcon` markers, Leaflet applies `role="button"` and `title` attributes, which provides the accessible name. Verify this works correctly in step 3.

**Step 3: Run smoke tests**

Run: `npm run build && npm run verify`
Expected: All pass. Markers render the same visually, just larger and with accessible names.

**Step 4: Manual verification with Playwright CLI**

Run: `npx playwright test --grep "relief map" --headed`

Visually verify:
- Need markers are noticeably larger (24px vs 14px)
- Markers are still properly positioned (anchored at center)
- Hovering a marker shows the alt text as a tooltip

**Step 5: Commit**

```bash
git add src/components/maps/ReliefMapLeaflet.tsx
git commit -m "a11y: increase map marker touch targets and add aria labels

Need markers increased from 14px to 24px diameter to meet WCAG
minimum touch target size. All markers now have descriptive alt
text for screen readers. Fixes Lighthouse accessibility audit
failures for aria-command-name and target-size."
```

---

## Task 5: Final Verification — Lighthouse Re-Run

After all four fixes are in place, rebuild and re-run Lighthouse to measure the improvement.

**Step 1: Build production**

Run: `npm run build`

Verify the build output. The main `index-XXXX.js` chunk should be smaller. You should see separate page chunks.

**Step 2: Run full test suite**

Run: `npm test && npm run verify`
Expected: All unit and smoke tests pass.

**Step 3: Re-run Lighthouse**

Run: `npm run preview`

Open `http://localhost:4173/en` in Chrome Incognito. Run Lighthouse with Mobile + Navigation + all categories.

**Expected improvements:**
- LCP: < 2.5s (was 4.1s) — i18n no longer blocks render, preconnect saves DNS/TLS time
- Unused JS: reduced from 91 KB — route splitting removes non-visited page code
- Accessibility score: higher — markers have names and meet touch target size
- TBT: should remain 0ms

Save the report for comparison.

**Step 4: Commit any final adjustments if needed**

If Lighthouse reveals issues from the changes, fix and commit.
