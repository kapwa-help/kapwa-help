# Full-Screen Needs Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Needs page from a constrained card layout to a full-viewport map with overlaid controls.

**Architecture:** The map fills all space between Header and StatusFooter. Status counts and the needs list float as absolutely-positioned overlays on top of the map. On mobile, the needs list is accessed via a floating button that opens a bottom sheet. No new components or dependencies — this is a layout refactor.

**Tech Stack:** React, Tailwind CSS, Leaflet/react-leaflet (unchanged)

**Design doc:** `docs/plans/2026-04-06-fullscreen-map-redesign.md`

---

### Task 1: Update NeedsMap to fill its container

The map currently has a fixed `h-[28rem]`. It needs to fill whatever container it's in.

**Files:**
- Modify: `src/components/maps/NeedsMap.tsx:51`
- Test: `tests/unit/components/maps/NeedsMap.test.tsx` (no changes needed — test mocks react-leaflet)

**Step 1: Change the map container height**

In `src/components/maps/NeedsMap.tsx`, line 51, change:
```tsx
<div className="relative h-[28rem] overflow-hidden rounded-lg">
```
to:
```tsx
<div className="relative h-full w-full overflow-hidden">
```

Remove `rounded-lg` because the map is now edge-to-edge (no card wrapper).

**Step 2: Add Leaflet container height rule to CSS**

In `src/index.css`, after the `.leaflet-popup-content-wrapper` rule (line 42), add:
```css
.leaflet-container {
  height: 100%;
}
```

**Step 3: Run unit tests**

Run: `npm test -- --run`
Expected: All NeedsMap tests pass (they mock react-leaflet, so height changes don't affect them).

**Step 4: Commit**

```bash
git add src/components/maps/NeedsMap.tsx src/index.css
git commit -m "refactor: make NeedsMap fill its container instead of fixed height"
```

---

### Task 2: Update StatusFooter to accept event name and timestamp

StatusFooter needs to display the active event name and the "Last Updated" timestamp that currently lives in the hero section.

**Files:**
- Modify: `src/components/StatusFooter.tsx`
- Test: `tests/unit/components/StatusFooter.test.tsx`

**Step 1: Write the failing tests**

Add to `tests/unit/components/StatusFooter.test.tsx`:
```tsx
it("renders event name when provided", () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  render(<StatusFooter eventName="Typhoon Emong" />);
  expect(screen.getByText("Typhoon Emong")).toBeInTheDocument();
});

it("renders updatedAt timestamp when provided", () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const date = new Date("2026-04-06T12:51:00Z");
  render(<StatusFooter updatedAt={date} />);
  // Should show formatted timestamp instead of current time
  expect(screen.getByText(/Dashboard\.lastUpdated/)).toBeInTheDocument();
});

it("renders without optional props", () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  render(<StatusFooter />);
  expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
  expect(screen.getByText(/Dashboard\.lastUpdated/)).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/components/StatusFooter.test.tsx`
Expected: New tests fail (StatusFooter doesn't accept props yet).

**Step 3: Update StatusFooter to accept optional props**

Replace `src/components/StatusFooter.tsx` with:
```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  eventName?: string;
  updatedAt?: Date | null;
};

export default function StatusFooter({ eventName, updatedAt }: Props) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const displayTime = (updatedAt ?? new Date()).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <footer className="flex items-center gap-6 bg-secondary px-6 py-3 text-sm text-neutral-400 shadow-[0_-1px_3px_rgba(0,0,0,0.3)]">
      <span className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`} />
        </span>
        {isOnline ? t("Dashboard.online") : t("Dashboard.offline")}
      </span>
      {eventName && (
        <span className="flex items-center gap-2">
          {eventName}
        </span>
      )}
      <span className="flex items-center gap-2">
        {t("Dashboard.lastUpdated")}: {displayTime}
      </span>
    </footer>
  );
}
```

Key changes from current:
- Accept optional `eventName` and `updatedAt` props
- Use `updatedAt` for timestamp if provided, else current time (backwards compatible)
- Remove `mt-6` and `rounded-2xl` — footer is now flush at page bottom
- Remove heavy shadow, add top-only shadow `shadow-[0_-1px_3px_rgba(0,0,0,0.3)]`
- Reduce padding from `py-4` to `py-3`

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/components/StatusFooter.test.tsx`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/components/StatusFooter.tsx tests/unit/components/StatusFooter.test.tsx
git commit -m "feat: StatusFooter accepts event name and last-updated timestamp"
```

---

### Task 3: Refactor NeedsCoordinationMap to overlay layout

This is the biggest change. The component goes from a card with a grid layout to a full-height positioning container with absolutely-positioned overlays.

**Files:**
- Modify: `src/components/NeedsCoordinationMap.tsx`
- Test: `tests/unit/components/NeedsCoordinationMap.test.tsx`

**Step 1: Update the test expectations**

The tests need to reflect the new layout. Key changes:
- "Dashboard.needsMap" heading is removed (no card header)
- The needs list, status counts, and map are still rendered
- Mobile list button is new
- The test for PinDetailSheet still works the same way

Replace the test in `tests/unit/components/NeedsCoordinationMap.test.tsx`:

Update the first test ("renders the map, legend with counts, and needs list"):
```tsx
it("renders the map, status bar with counts, and needs list", async () => {
  const { default: NeedsCoordinationMap } = await import(
    "@/components/NeedsCoordinationMap"
  );
  render(<NeedsCoordinationMap needsPoints={mockPoints} />);

  // Map renders
  expect(await screen.findByTestId("needs-map")).toBeInTheDocument();

  // Status counts present
  expect(screen.getAllByText(/Dashboard.statusPending/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Dashboard.statusVerified/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Dashboard.statusInTransit/).length).toBeGreaterThan(0);

  // Needs list items present
  expect(screen.getByText("Urbiztondo")).toBeInTheDocument();
  expect(screen.getByText("Bacnotan")).toBeInTheDocument();
});
```

Add a test for the mobile list button:
```tsx
it("renders a mobile list toggle button", async () => {
  const { default: NeedsCoordinationMap } = await import(
    "@/components/NeedsCoordinationMap"
  );
  render(<NeedsCoordinationMap needsPoints={mockPoints} />);
  await screen.findByTestId("needs-map");

  const listButton = screen.getByLabelText("Dashboard.showNeedsList");
  expect(listButton).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/components/NeedsCoordinationMap.test.tsx`
Expected: New/changed tests fail.

**Step 3: Rewrite NeedsCoordinationMap layout**

Replace the return JSX in `src/components/NeedsCoordinationMap.tsx` (lines 97-195) with the new overlay layout:

```tsx
return (
  <div className="relative flex h-full w-full flex-col">
    {/* Map fills entire container */}
    {allPoints.length > 0 ? (
      <Suspense fallback={<MapSkeleton />}>
        <NeedsMap points={allPoints} onPinSelect={setSelectedPoint} />
      </Suspense>
    ) : (
      <div className="flex h-full items-center justify-center bg-base/30">
        <p className="text-sm text-neutral-400/60">
          {t("Dashboard.noNeedsData")}
        </p>
      </div>
    )}

    {/* Status bar overlay — top */}
    <div className="absolute left-4 right-4 top-4 z-[500] lg:right-[340px]">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-secondary/85 px-4 py-2 backdrop-blur-sm">
        {STATUS_CONFIG.map((item) => (
          <div key={item.status} className="flex items-center gap-1.5 rounded-full bg-base/30 px-3 py-1">
            <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
            <span className="text-xs text-neutral-400 lg:text-sm">
              {counts[item.status]} {t(item.label)}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Sidebar overlay — right (desktop only) */}
    <div className="absolute bottom-4 right-4 top-4 z-[500] hidden w-[320px] flex-col overflow-hidden rounded-xl bg-secondary/90 backdrop-blur-sm lg:flex">
      {selectedPoint ? (
        <div className="flex-1 overflow-y-auto p-4">
          <PinDetailSheet
            point={selectedPoint}
            onClose={() => setSelectedPoint(null)}
            onStatusChange={handleStatusChange}
            variant="panel"
          />
        </div>
      ) : (
        <div className="flex-1 divide-y divide-neutral-400/20 overflow-y-auto">
          {sortedPoints.map((need) => (
            <button
              key={need.id}
              onClick={() => setSelectedPoint(need)}
              className="flex w-full items-start justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-400/10"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_MAP[need.status]?.dot ?? "bg-neutral-400"}`}
                  aria-hidden="true"
                />
                <span className="sr-only">{t(STATUS_MAP[need.status]?.label ?? "Dashboard.statusPending")}</span>
                <div>
                  <p className={`text-sm ${need.status === "completed" ? "text-neutral-400" : "text-neutral-50"}`}>
                    {need.barangayName}
                  </p>
                  <p className={`text-xs ${need.status === "completed" ? "text-neutral-400/60" : "text-neutral-400"}`}>
                    {need.gapCategory ?? t("Dashboard.unset")}
                    {need.accessStatus && ACCESS_KEYS[need.accessStatus] && ` \u00b7 ${t(ACCESS_KEYS[need.accessStatus])}`}
                  </p>
                </div>
              </div>
              {need.urgency && need.urgency in URGENCY_STYLES && (
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[need.urgency] ?? URGENCY_STYLES.low}`}>
                  {t(`Dashboard.urgency${need.urgency.charAt(0).toUpperCase()}${need.urgency.slice(1)}`)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Mobile: list toggle button — bottom left */}
    <button
      onClick={() => setListOpen(true)}
      aria-label={t("Dashboard.showNeedsList")}
      className="absolute bottom-4 left-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-neutral-50 shadow-lg lg:hidden"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
      {allPoints.length > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-neutral-50">
          {allPoints.length}
        </span>
      )}
    </button>

    {/* Mobile: needs list bottom sheet */}
    {listOpen && (
      <div className="lg:hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[999]"
          onClick={() => setListOpen(false)}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-label={t("Dashboard.needsList")}
          className="fixed inset-x-0 bottom-0 z-[1000] max-h-[60vh] animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
          </div>
          {/* Header with close */}
          <div className="flex items-center justify-between px-5 pb-3">
            <h3 className="text-sm font-semibold text-neutral-50">{t("Dashboard.needsMap")}</h3>
            <button
              onClick={() => setListOpen(false)}
              aria-label={t("PinDetail.close")}
              className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {/* Scrollable list */}
          <div className="divide-y divide-neutral-400/20 overflow-y-auto px-5 pb-5" style={{ maxHeight: "calc(60vh - 4rem)" }}>
            {sortedPoints.map((need) => (
              <button
                key={need.id}
                onClick={() => { setListOpen(false); setSelectedPoint(need); }}
                className="flex w-full items-start justify-between py-3 text-left transition-colors hover:bg-neutral-400/10"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_MAP[need.status]?.dot ?? "bg-neutral-400"}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className={`text-sm ${need.status === "completed" ? "text-neutral-400" : "text-neutral-50"}`}>
                      {need.barangayName}
                    </p>
                    <p className={`text-xs ${need.status === "completed" ? "text-neutral-400/60" : "text-neutral-400"}`}>
                      {need.gapCategory ?? t("Dashboard.unset")}
                      {need.accessStatus && ACCESS_KEYS[need.accessStatus] && ` \u00b7 ${t(ACCESS_KEYS[need.accessStatus])}`}
                    </p>
                  </div>
                </div>
                {need.urgency && need.urgency in URGENCY_STYLES && (
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[need.urgency] ?? URGENCY_STYLES.low}`}>
                    {t(`Dashboard.urgency${need.urgency.charAt(0).toUpperCase()}${need.urgency.slice(1)}`)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Mobile: pin detail bottom sheet (existing behavior) */}
    {selectedPoint && (
      <div className="lg:hidden">
        <PinDetailSheet
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          onStatusChange={handleStatusChange}
        />
      </div>
    )}
  </div>
);
```

Also add the `listOpen` state near the other state declarations (after line 57):
```tsx
const [listOpen, setListOpen] = useState(false);
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/components/NeedsCoordinationMap.test.tsx`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/components/NeedsCoordinationMap.tsx tests/unit/components/NeedsCoordinationMap.test.tsx
git commit -m "refactor: NeedsCoordinationMap to overlay layout with full-screen map"
```

---

### Task 4: Update NeedsPage — remove hero, full-viewport layout

**Files:**
- Modify: `src/pages/NeedsPage.tsx:105-149`
- Test: `tests/unit/pages/NeedsPage.test.tsx`

**Step 1: Update test expectations**

The tests currently assert on "Dashboard.hero" and "Dashboard.subtitle" — these are being removed. Update:

In `tests/unit/pages/NeedsPage.test.tsx`:

Change the test "renders hero and map after data loads" (lines 64-74):
```tsx
it("renders map and footer after data loads", async () => {
  render(<NeedsPage />);

  await waitFor(() => {
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
  });

  expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
});
```

Update any test that waits for "Dashboard.hero" to instead wait for "Dashboard.online" or "Dashboard.needsMap" (the status bar heading). Specifically:
- Line 68: `screen.getByText("Dashboard.hero")` → `screen.getByText("Dashboard.online")`
- Line 71: Remove `expect(screen.getByText("Dashboard.subtitle"))` assertion
- Line 81: `screen.getByText("Dashboard.hero")` → `screen.getByText("Dashboard.online")`
- Line 114: `screen.getByText("Dashboard.hero")` → `screen.getByText("Dashboard.online")`
- Line 117: Remove `expect(screen.getAllByText(/Dashboard.lastUpdated/))` (timestamp is now in footer, still present but structure changed)
- Line 144: `screen.getByText("Dashboard.hero")` → `screen.getByText("Dashboard.online")`

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/pages/NeedsPage.test.tsx`
Expected: Tests fail because hero is still rendered.

**Step 3: Update NeedsPage layout**

Replace lines 105-149 of `src/pages/NeedsPage.tsx` with:
```tsx
return (
  <div className="flex h-screen flex-col bg-base">
    <Header />
    <main className="relative flex-1 overflow-hidden">
      {data.needsPoints && <NeedsCoordinationMap needsPoints={data.needsPoints} />}
    </main>
    <StatusFooter
      eventName={data.activeEvent?.name}
      updatedAt={updatedAt}
    />
  </div>
);
```

Key changes:
- `min-h-screen` → `h-screen flex flex-col` (viewport-locked, no scroll)
- `<main>` gets `relative flex-1 overflow-hidden` (fills remaining space)
- Hero section entirely removed
- `max-w-7xl`, `space-y-6`, `px-6 py-8` all removed
- StatusFooter receives `eventName` and `updatedAt` props
- Remove `isOffline` state variable and its event listeners (StatusFooter handles its own online/offline)

Also remove the `isOffline` state and its effect from the component since StatusFooter manages that independently. Remove:
- Line 22: `const [isOffline, setIsOffline] = useState(!navigator.onLine);`
- Lines 68-81: The online/offline effect (StatusFooter already has its own)

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/pages/NeedsPage.test.tsx`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/pages/NeedsPage.tsx tests/unit/pages/NeedsPage.test.tsx
git commit -m "refactor: NeedsPage removes hero, uses full-viewport map layout"
```

---

### Task 5: Update smoke tests

The Playwright smoke test for the needs page checks for `h1` — which was the hero heading. The page no longer has an `h1`. Update the e2e test.

**Files:**
- Modify: `tests/e2e/smoke.spec.ts:6-31`

**Step 1: Update the needs page smoke test**

In `tests/e2e/smoke.spec.ts`, the needs page test (lines 8-31) checks `await expect(page.locator("h1")).toBeVisible()`. Replace the `h1` check with a check for the map container or status bar:

```typescript
for (const locale of LOCALES) {
  test(`needs page renders in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);

    // Header brand
    await expect(page.locator("text=Kapwa Help")).toBeVisible();

    // Navigation links
    await expect(page.locator("nav")).toBeVisible();

    // Locale switcher shows correct value
    const select = page.locator("header select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(locale);

    // Map is visible (full-screen layout)
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/needs-${locale}.png`,
      fullPage: true,
    });
  });
}
```

**Step 2: Run smoke tests**

Run: `npm run verify`
Expected: All smoke tests pass.

**Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test: update needs page smoke test for full-screen map layout"
```

---

### Task 6: Add i18n key for mobile list button

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

**Step 1: Add keys**

Add to the Dashboard section of each locale file:

**English** (`en/translation.json`):
```json
"Dashboard.showNeedsList": "Show needs list",
"Dashboard.needsList": "Needs list"
```

**Filipino** (`fil/translation.json`):
```json
"Dashboard.showNeedsList": "Ipakita ang listahan ng pangangailangan",
"Dashboard.needsList": "Listahan ng pangangailangan"
```

**Ilocano** (`ilo/translation.json`):
```json
"Dashboard.showNeedsList": "Ipakita ti listaan dagiti kasapulan",
"Dashboard.needsList": "Listaan dagiti kasapulan"
```

**Step 2: Commit**

```bash
git add public/locales/
git commit -m "i18n: add mobile needs list button labels"
```

---

### Task 7: Visual verification with Playwright

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All unit tests pass.

**Step 2: Run smoke tests**

Run: `npm run verify`
Expected: All e2e tests pass, screenshots updated.

**Step 3: Manual visual check with Playwright CLI**

Run these to verify the layout visually:

```bash
# Desktop view
npx playwright screenshot --viewport-size=1440,900 http://localhost:5173/en tests/e2e/screenshots/fullscreen-map-desktop.png

# Mobile view
npx playwright screenshot --viewport-size=375,667 http://localhost:5173/en tests/e2e/screenshots/fullscreen-map-mobile.png
```

Review screenshots to confirm:
- Map fills viewport between header and footer
- Status bar overlay visible at top
- Sidebar visible on desktop (right edge)
- Mobile shows floating list button (bottom-left)
- Footer shows online status + timestamp

**Step 4: Commit screenshots**

```bash
git add tests/e2e/screenshots/
git commit -m "test: add visual verification screenshots for full-screen map"
```

---

### Task 8: Final cleanup and build check

**Step 1: Type check + production build**

Run: `npm run build`
Expected: No TypeScript errors, build succeeds.

**Step 2: Preview production build**

Run: `npm run preview`
Open http://localhost:4173/en in browser. Verify:
- Map loads and fills viewport
- Status bar overlay appears
- Sidebar scrolls on desktop
- Footer shows at bottom

**Step 3: Final commit if any tweaks needed**

Any adjustments from visual review get committed here.
