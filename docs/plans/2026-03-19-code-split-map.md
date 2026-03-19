# Code-Split Map Chunk Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the Leaflet/react-leaflet map into a separate chunk using React.lazy, dropping the main bundle from 693 KB to well under 500 KB.

**Architecture:** Replace the static import of `DeploymentMap` in `AidDistributionMap` with `React.lazy(() => import(...))`, wrap it in a `Suspense` boundary with a loading skeleton, and update tests to handle async rendering. Vite automatically code-splits dynamic imports into separate chunks — no manual rollup config needed.

**Tech Stack:** React 19 (lazy/Suspense), Vite 7 (automatic chunk splitting), Vitest + React Testing Library

---

## Baseline Measurements

| Metric | Before |
|--------|--------|
| Main JS chunk | 692.91 KB (208.17 KB gzip) |
| Total precache | 963.60 KB |
| Vite warning | Yes (>500 KB) |

---

### Task 1: Add Map Loading Skeleton

The lazy-loaded map needs a visual placeholder while the chunk downloads. This skeleton matches the existing map container dimensions (`h-[24rem]`) and uses the project's design tokens.

**Files:**
- Create: `src/components/maps/MapSkeleton.tsx`
- Test: `tests/unit/components/maps/MapSkeleton.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/maps/MapSkeleton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapSkeleton from "@/components/maps/MapSkeleton";

describe("MapSkeleton", () => {
  it("renders a loading placeholder with correct dimensions", () => {
    render(<MapSkeleton />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.className).toContain("h-[24rem]");
  });

  it("displays loading text for accessibility", () => {
    render(<MapSkeleton />);
    expect(screen.getByText(/loading map/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/components/maps/MapSkeleton.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/components/maps/MapSkeleton.tsx`:

```tsx
export default function MapSkeleton() {
  return (
    <div
      role="status"
      className="flex h-[24rem] items-center justify-center rounded-lg bg-base/30"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400/20 border-t-primary" />
        <p className="text-sm text-neutral-400/60">Loading map…</p>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/components/maps/MapSkeleton.test.tsx`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/components/maps/MapSkeleton.tsx tests/unit/components/maps/MapSkeleton.test.tsx
git commit -m "feat: add MapSkeleton loading placeholder"
```

---

### Task 2: Lazy-Load DeploymentMap in AidDistributionMap

Replace the static import with `React.lazy` and wrap in `Suspense` with the skeleton fallback.

**Files:**
- Modify: `src/components/AidDistributionMap.tsx`
- Test: `tests/unit/components/AidDistributionMap.test.tsx`

**Step 1: Write the failing test**

The existing `AidDistributionMap.test.tsx` tests basic rendering. We need to verify the Suspense boundary works correctly. Update the test file:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AidDistributionMap from "@/components/AidDistributionMap";

// Mock the lazy-loaded DeploymentMap
vi.mock("@/components/maps/DeploymentMap", () => ({
  default: ({ points }: { points: unknown[] }) => (
    <div data-testid="deployment-map">{points.length} points</div>
  ),
}));

// Mock MapSkeleton
vi.mock("@/components/maps/MapSkeleton", () => ({
  default: () => <div data-testid="map-skeleton">Loading map…</div>,
}));

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockPoints = [
  {
    lat: 16.62,
    lng: 120.35,
    quantity: 100,
    unit: "kg",
    orgName: "Test Org",
    categoryName: "Food",
  },
];

const mockBarangays = [
  { name: "Barangay 1", municipality: "San Fernando", beneficiaries: 500 },
];

describe("AidDistributionMap", () => {
  it("renders the map when deployment points exist", async () => {
    render(
      <AidDistributionMap
        barangays={mockBarangays}
        deploymentPoints={mockPoints}
      />,
    );
    expect(
      await screen.findByTestId("deployment-map"),
    ).toBeInTheDocument();
  });

  it("renders no-data placeholder when no deployment points", () => {
    render(
      <AidDistributionMap barangays={mockBarangays} deploymentPoints={[]} />,
    );
    expect(screen.getByText("Dashboard.noDeploymentData")).toBeInTheDocument();
  });

  it("renders barangay list", () => {
    render(
      <AidDistributionMap
        barangays={mockBarangays}
        deploymentPoints={mockPoints}
      />,
    );
    expect(screen.getByText(/Barangay 1/)).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/components/AidDistributionMap.test.tsx`
Expected: FAIL — tests may fail because the component still uses static import (the async `findByTestId` won't be needed yet, but let's confirm baseline)

**Step 3: Modify AidDistributionMap.tsx**

Replace the static import with lazy + Suspense. The full updated file:

```tsx
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";

const DeploymentMap = lazy(() => import("@/components/maps/DeploymentMap"));

type DeploymentPoint = {
  lat: number;
  lng: number;
  quantity: number | null;
  unit: string | null;
  orgName: string;
  categoryName: string;
};

type Props = {
  barangays: { name: string; municipality: string; beneficiaries: number }[];
  deploymentPoints: DeploymentPoint[];
};

export default function AidDistributionMap({
  barangays,
  deploymentPoints,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-neutral-400/20 bg-secondary p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-50">
          {t("Dashboard.aidDistributionMap")}
        </h3>
        <span className="rounded-full bg-success/20 px-3 py-1 text-xs font-medium text-success">
          {t("Dashboard.liveMap")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {deploymentPoints.length > 0 ? (
          <Suspense fallback={<MapSkeleton />}>
            <DeploymentMap points={deploymentPoints} />
          </Suspense>
        ) : (
          <div className="flex h-[24rem] items-center justify-center rounded-lg bg-base/30">
            <p className="text-sm text-neutral-400/60">
              {t("Dashboard.noDeploymentData")}
            </p>
          </div>
        )}

        <div className="divide-y divide-neutral-400/20 overflow-y-auto lg:max-h-[24rem]">
          {barangays.map((brgy) => (
            <div
              key={`${brgy.name}-${brgy.municipality}`}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 shrink-0 text-error"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-neutral-400">
                  {t("Dashboard.barangayPrefix")} {brgy.name},{" "}
                  {brgy.municipality}
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-error">
                  {brgy.beneficiaries.toLocaleString()}
                </span>
                <span className="ml-1 text-xs text-neutral-400/60">
                  {t("Dashboard.beneficiaries")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/components/AidDistributionMap.test.tsx`
Expected: PASS (3 tests)

**Step 5: Run full test suite**

Run: `npm test`
Expected: All 29+ tests pass. DashboardPage tests should still pass because they already mock DeploymentMap at the module level.

**Step 6: Commit**

```bash
git add src/components/AidDistributionMap.tsx tests/unit/components/AidDistributionMap.test.tsx
git commit -m "perf: lazy-load DeploymentMap with React.lazy + Suspense"
```

---

### Task 3: Verify Build Output and Bundle Reduction

Confirm the code-split produces separate chunks and the main bundle drops below 500 KB.

**Files:**
- None modified — verification only

**Step 1: Run production build**

Run: `npm run build`
Expected output should show:
- `dist/assets/index-*.js` — main chunk **under 500 KB**
- `dist/assets/DeploymentMap-*.js` — new lazy chunk (Leaflet + react-leaflet)
- No "chunks are larger than 500 kB" warning

**Step 2: Compare before/after**

Document the results:

| Metric | Before | After |
|--------|--------|-------|
| Main JS chunk | 692.91 KB (208 KB gzip) | Target: <500 KB |
| Map chunk | N/A | ~150-200 KB (new) |
| Vite warning | Yes | No |

**Step 3: Run preview server for manual smoke test**

Run: `npm run preview`
Verify: Dashboard loads, map appears after brief skeleton, PWA service worker precaches both chunks.

**Step 4: Commit (docs update if needed)**

No code changes, but if the build reveals unexpected issues, address them here.

---

### Task 4: Update Documentation

Update docs to reflect the new architecture.

**Files:**
- Modify: `docs/architecture.md` (add code-splitting section if not present)
- Modify: `CLAUDE.md` (update Project Structure to mention MapSkeleton)

**Step 1: Update CLAUDE.md Project Structure**

Add `MapSkeleton.tsx` under `maps/` in the structure tree:

```
    maps/             # Map components (DeploymentMap.tsx, MapSkeleton.tsx)
```

**Step 2: Update docs/architecture.md**

Add a brief note about code-splitting under the frontend architecture section:

```markdown
### Code Splitting

The DeploymentMap component (Leaflet + react-leaflet) is lazy-loaded via `React.lazy` to keep the main bundle under 500 KB. A `MapSkeleton` loading state displays while the map chunk downloads. The PWA service worker precaches all chunks, so this primarily improves first-visit performance.
```

**Step 3: Commit**

```bash
git add CLAUDE.md docs/architecture.md
git commit -m "docs: document map code-splitting architecture"
```

---

## Summary

| Task | Description | Estimated Changes |
|------|-------------|-------------------|
| 1 | MapSkeleton component + test | 2 new files |
| 2 | Lazy-load DeploymentMap + update test | 2 modified files |
| 3 | Build verification | 0 files (verification) |
| 4 | Documentation updates | 2 modified files |

**Total:** 2 new files, 4 modified files, 4 commits
