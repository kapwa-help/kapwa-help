# Offline Map Tile Caching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cache OpenStreetMap tiles for offline use and show a fallback overlay when tiles are unavailable.

**Architecture:** Add a Workbox CacheFirst runtime caching entry for OSM tile requests in `vite.config.ts`. Enhance `DeploymentMap` to detect tile load failures via Leaflet's `tileerror`/`tileload` events and render a semi-transparent overlay when tiles are unavailable. All user-facing text uses i18n keys.

**Tech Stack:** Workbox (via vite-plugin-pwa), react-leaflet v5 `eventHandlers` prop, react-i18next, Vitest + RTL

**Issue:** #37

---

### Task 1: Add Workbox runtime caching for OSM tiles

**Files:**
- Modify: `vite.config.ts:41-50` (inside `runtimeCaching` array)

**Step 1: Add the CacheFirst entry for OSM tiles**

In `vite.config.ts`, add a second entry to the `runtimeCaching` array, after the existing Supabase entry:

```ts
{
  urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
  handler: "CacheFirst",
  options: {
    cacheName: "map-tiles",
    expiration: {
      maxEntries: 200,
      maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
    },
  },
},
```

**Step 2: Verify the build still works**

Run: `npm run build`
Expected: Clean build, no errors. The generated `dist/sw.js` will include the new caching rule.

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add Workbox CacheFirst caching for OSM map tiles"
```

---

### Task 2: Add i18n keys for tile fallback message

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

**Step 1: Add the translation key to all three locale files**

Add `"mapTilesUnavailable"` inside the `"Dashboard"` object in each file:

English (`en/translation.json`):
```json
"mapTilesUnavailable": "Map tiles unavailable offline"
```

Filipino (`fil/translation.json`):
```json
"mapTilesUnavailable": "Hindi available ang map tiles kapag offline"
```

Ilocano (`ilo/translation.json`):
```json
"mapTilesUnavailable": "Saan a magun-od dagiti map tiles no offline"
```

Place each key after the existing `"acrossDeployments"` line in the `"Dashboard"` block.

**Step 2: Verify JSON is valid**

Run: `node -e "require('./public/locales/en/translation.json'); require('./public/locales/fil/translation.json'); require('./public/locales/ilo/translation.json'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add public/locales/en/translation.json public/locales/fil/translation.json public/locales/ilo/translation.json
git commit -m "feat: add i18n keys for map tile fallback message"
```

---

### Task 3: Write failing tests for tile fallback UI

**Files:**
- Modify: `tests/unit/components/maps/DeploymentMap.test.tsx`

**Step 1: Update test mocks and add tile fallback test suite**

The TileLayer mock needs to capture `eventHandlers` so tests can simulate tile errors/loads. Also add a `react-i18next` mock since the component will use `useTranslation`.

Replace the entire TileLayer mock line (`TileLayer: () => <div data-testid="tile-layer" />,`) with a version that captures `eventHandlers`:

```tsx
let tileLayerEventHandlers: Record<string, (...args: unknown[]) => void> = {};
```

Add this variable declaration above the `vi.mock("react-leaflet", ...)` block. Then update the TileLayer mock inside the factory:

```tsx
TileLayer: ({
  eventHandlers,
}: {
  eventHandlers?: Record<string, (...args: unknown[]) => void>;
  [key: string]: unknown;
}) => {
  tileLayerEventHandlers = eventHandlers ?? {};
  return <div data-testid="tile-layer" />;
},
```

Add a mock for `react-i18next` after the existing `leaflet` mock:

```tsx
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
```

Add `beforeEach` and `act` import. Update the import line:

```tsx
import { render, screen, act } from "@testing-library/react";
```

Add a `beforeEach` inside the top-level `describe`:

```tsx
beforeEach(() => {
  tileLayerEventHandlers = {};
});
```

Add the new test suite inside the existing `describe("DeploymentMap", ...)`:

```tsx
describe("tile fallback", () => {
  it("shows fallback after 3 tile errors", () => {
    render(<DeploymentMap points={mockPoints} />);
    expect(
      screen.queryByText("Dashboard.mapTilesUnavailable"),
    ).not.toBeInTheDocument();

    act(() => {
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
    });

    expect(
      screen.getByText("Dashboard.mapTilesUnavailable"),
    ).toBeInTheDocument();
  });

  it("does not show fallback after fewer than 3 tile errors", () => {
    render(<DeploymentMap points={mockPoints} />);

    act(() => {
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
    });

    expect(
      screen.queryByText("Dashboard.mapTilesUnavailable"),
    ).not.toBeInTheDocument();
  });

  it("clears fallback when a tile loads successfully", () => {
    render(<DeploymentMap points={mockPoints} />);

    act(() => {
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
    });

    expect(
      screen.getByText("Dashboard.mapTilesUnavailable"),
    ).toBeInTheDocument();

    act(() => {
      tileLayerEventHandlers.tileload?.();
    });

    expect(
      screen.queryByText("Dashboard.mapTilesUnavailable"),
    ).not.toBeInTheDocument();
  });

  it("still renders markers when fallback is visible", () => {
    render(<DeploymentMap points={mockPoints} />);

    act(() => {
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
      tileLayerEventHandlers.tileerror?.();
    });

    expect(
      screen.getByText("Dashboard.mapTilesUnavailable"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("map-marker")).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/components/maps/DeploymentMap.test.tsx`
Expected: The 4 new tile fallback tests FAIL (component doesn't have fallback UI yet). The 5 existing tests should still PASS.

---

### Task 4: Implement tile fallback UI in DeploymentMap

**Files:**
- Modify: `src/components/maps/DeploymentMap.tsx`

**Step 1: Add imports and constants**

Add to the existing imports at the top of the file:

```tsx
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
```

Add below `DEFAULT_ZOOM`:

```tsx
const TILE_ERROR_THRESHOLD = 3;
```

**Step 2: Add state, ref, and event handlers inside the component**

At the top of the `DeploymentMap` function body, add:

```tsx
const { t } = useTranslation();
const [tilesUnavailable, setTilesUnavailable] = useState(false);
const errorCount = useRef(0);

const handleTileError = useCallback(() => {
  errorCount.current += 1;
  if (errorCount.current >= TILE_ERROR_THRESHOLD) {
    setTilesUnavailable(true);
  }
}, []);

const handleTileLoad = useCallback(() => {
  errorCount.current = 0;
  setTilesUnavailable(false);
}, []);
```

**Step 3: Wire event handlers to TileLayer**

Add the `eventHandlers` prop to the existing `<TileLayer>`:

```tsx
<TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  eventHandlers={{
    tileerror: handleTileError,
    tileload: handleTileLoad,
  }}
/>
```

**Step 4: Add `relative` to the wrapper div and render the overlay**

Change the wrapper div class from `"h-[24rem] overflow-hidden rounded-lg"` to `"relative h-[24rem] overflow-hidden rounded-lg"`.

Add the overlay after the closing `</MapContainer>` tag, inside the wrapper div:

```tsx
{tilesUnavailable && (
  <div className="absolute inset-0 flex items-center justify-center bg-base/80">
    <p className="text-neutral-400 text-sm">
      {t("Dashboard.mapTilesUnavailable")}
    </p>
  </div>
)}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/unit/components/maps/DeploymentMap.test.tsx`
Expected: All 9 tests PASS (5 existing + 4 new).

**Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass. No regressions.

**Step 7: Run lint**

Run: `npm run lint`
Expected: No lint errors.

**Step 8: Commit**

```bash
git add src/components/maps/DeploymentMap.tsx tests/unit/components/maps/DeploymentMap.test.tsx
git commit -m "feat: add tile error fallback UI to DeploymentMap

Detects tile load failures via Leaflet tileerror events (threshold: 3).
Shows semi-transparent overlay with i18n message. Self-heals on tileload."
```

---

### Task 5: Update architecture docs

**Files:**
- Modify: `docs/architecture.md:88-96` (Offline Caching section)

**Step 1: Add map tile caching info to the Offline Caching section**

Add a new bullet after the existing "Auto-refresh" bullet (line 95):

```markdown
- **Map tiles** (`vite.config.ts` runtimeCaching): OSM tiles use CacheFirst strategy (cache name: `map-tiles`, max 200 tiles, 30-day expiry). When tiles fail to load, `DeploymentMap` shows a fallback overlay after 3 consecutive `tileerror` events; the overlay clears automatically when tiles load again.
```

**Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add map tile caching to architecture overview"
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `vite.config.ts` | Add `runtimeCaching` entry for OSM tiles (CacheFirst, 200 max, 30-day) |
| `src/components/maps/DeploymentMap.tsx` | Add tile error detection + fallback overlay |
| `public/locales/en/translation.json` | Add `Dashboard.mapTilesUnavailable` |
| `public/locales/fil/translation.json` | Add `Dashboard.mapTilesUnavailable` |
| `public/locales/ilo/translation.json` | Add `Dashboard.mapTilesUnavailable` |
| `tests/unit/components/maps/DeploymentMap.test.tsx` | Add fallback UI tests (4 new tests) |
| `docs/architecture.md` | Update offline caching section |
