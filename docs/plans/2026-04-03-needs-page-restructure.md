# Needs Page Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Needs page so the coordination map is the hero — remove summary cards and access filters, add actionable pin colors, sorted sidebar with urgency badges, and an inline legend with counts.

**Architecture:** Remove the `NeedsSummaryCards` layer and `getNeedsSummary` query entirely. Modify `getNeedsMapPoints` to fetch all four active statuses (pending, verified, in_transit, completed). Split points client-side: pending/verified/in_transit go to the map, all four go to the sidebar sorted by status priority then urgency. Inline legend row with live counts replaces both the filter bar and sidebar legend.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase queries, react-i18next, Vitest + RTL

---

### Task 1: Update query to include pending and completed

**Files:**
- Modify: `src/lib/queries.ts:128-157` (getNeedsMapPoints)
- Modify: `src/lib/queries.ts:168-198` (remove getNeedsSummary)
- Modify: `tests/unit/lib/queries.test.ts:93-132`

**Step 1: Update `getNeedsMapPoints` to fetch all four active statuses**

In `src/lib/queries.ts`, change the `.in("status", ...)` filter:

```typescript
// Before:
.in("status", ["verified", "in_transit", "completed"])

// After:
.in("status", ["pending", "verified", "in_transit", "completed"])
```

**Step 2: Delete `getNeedsSummary` function**

Remove the entire `getNeedsSummary` function (lines 168-198) from `src/lib/queries.ts`.

**Step 3: Update the query test**

In `tests/unit/lib/queries.test.ts`, the mock chain for `getNeedsMapPoints` doesn't assert the status filter values, so the test should still pass. Verify by running:

```bash
npm test -- tests/unit/lib/queries.test.ts
```

Expected: All tests pass. No test references `getNeedsSummary` in this file.

**Step 4: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: expand needs query to include pending status, remove getNeedsSummary"
```

---

### Task 2: Update cache type and NeedsPage loader

**Files:**
- Modify: `src/lib/cache.ts:8-32` (NeedsData type)
- Modify: `src/pages/NeedsPage.tsx`
- Modify: `tests/unit/pages/NeedsPage.test.tsx`
- Modify: `tests/unit/lib/cache.test.ts` (if it references needsSummary)

**Step 1: Remove `needsSummary` from `NeedsData` type**

In `src/lib/cache.ts`, change the `NeedsData` type:

```typescript
export type NeedsData = {
  activeEvent: { id: string; name: string; slug: string; description: string | null; region: string; started_at: string } | null;
  needsPoints: {
    id: string;
    lat: number;
    lng: number;
    status: string;
    gapCategory: string | null;
    accessStatus: string | null;
    urgency: string | null;
    quantityNeeded: number | null;
    notes: string | null;
    contactName: string;
    barangayName: string;
    municipality: string;
    createdAt: string;
  }[];
};
```

**Step 2: Remove NeedsSummaryCards from NeedsPage**

In `src/pages/NeedsPage.tsx`:

1. Remove the `NeedsSummaryCards` import (line 4)
2. Remove the `getNeedsSummary` import (line 14)
3. Remove `getNeedsSummary()` from the `Promise.all` call (line 35) — only fetch `getNeedsMapPoints()` and `getActiveEvent()`
4. Remove `needsSummary` from the `freshData` object (line 41)
5. Remove the `{data.needsSummary && <NeedsSummaryCards ... />}` JSX (line 153)

The `fetchData` callback becomes:

```typescript
const fetchData = useCallback(async () => {
  try {
    const [needsPoints, activeEvent] = await Promise.all([
      getNeedsMapPoints(),
      getActiveEvent(),
    ]);

    const freshData: NeedsData = {
      needsPoints,
      activeEvent,
    };

    setData(freshData);
    setUpdatedAt(new Date());
    setError(null);
    hasDataRef.current = true;
    setCachedNeeds(freshData);
  } catch (e) {
    if (!hasDataRef.current) {
      setError(e instanceof Error ? e.message : "Failed to load needs data");
    }
    if (!navigator.onLine) {
      setIsOffline(true);
    }
  } finally {
    setLoading(false);
  }
}, []);
```

Remove the unused import of `getNeedsSummary` from the imports block.

**Step 3: Update NeedsPage tests**

In `tests/unit/pages/NeedsPage.test.tsx`:

1. Remove `getNeedsSummary` from the mock and imports
2. Remove `emptyNeedsSummary` constant
3. Update `mockQueries` to only mock `getNeedsMapPoints` and `getActiveEvent`
4. Remove all assertions that check for summary card text (`Dashboard.activeNeeds`, `Dashboard.inTransit`, `Dashboard.pinStatus`, specific number counts from summary)
5. Update the "renders hero and needs components after data loads" test to check for `Dashboard.needsMap` (the map heading) instead of summary card labels
6. Update cache tests to remove `needsSummary` from cached data objects

Updated test file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NeedsPage } from "@/pages/NeedsPage";

vi.mock("@/lib/cache", () => ({
  getCachedNeeds: vi.fn(),
  setCachedNeeds: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  getNeedsMapPoints: vi.fn(),
  getActiveEvent: vi.fn(),
}));

vi.mock("@/components/maps/NeedsMap", () => ({
  default: () => <div data-testid="needs-map" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/en", search: "", hash: "", state: null, key: "default" }),
  Link: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>{children}</a>
  ),
  NavLink: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string | Function }) => (
    <a href={props.to} className={typeof props.className === "function" ? "" : props.className}>{children}</a>
  ),
}));

import { getNeedsMapPoints, getActiveEvent } from "@/lib/queries";
import { getCachedNeeds, setCachedNeeds } from "@/lib/cache";

const mockQueries = () => {
  vi.mocked(getNeedsMapPoints).mockResolvedValue([]);
  vi.mocked(getActiveEvent).mockResolvedValue(null);
};

describe("NeedsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
    vi.mocked(getCachedNeeds).mockResolvedValue(null);
    vi.mocked(setCachedNeeds).mockResolvedValue(undefined);
  });

  it("shows loading state initially", () => {
    render(<NeedsPage />);
    expect(screen.getByText("App.loading")).toBeInTheDocument();
  });

  it("renders hero and map after data loads", async () => {
    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    expect(screen.getByText("Dashboard.subtitle")).toBeInTheDocument();
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
  });

  it("only calls needs-related queries", async () => {
    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    expect(getNeedsMapPoints).toHaveBeenCalled();
    expect(getActiveEvent).toHaveBeenCalled();
  });

  it("renders error state with retry button on fetch failure", async () => {
    vi.mocked(getNeedsMapPoints).mockRejectedValue(new Error("Network error"));

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("App.loadError")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "App.retry" })).toBeInTheDocument();
  });

  it("shows cached data when cache exists", async () => {
    vi.mocked(getNeedsMapPoints).mockReturnValue(new Promise(() => {}));
    vi.mocked(getActiveEvent).mockReturnValue(new Promise(() => {}));

    vi.mocked(getCachedNeeds).mockResolvedValue({
      data: {
        activeEvent: null,
        needsPoints: [],
      },
      updatedAt: Date.now(),
    });

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Dashboard.lastUpdated/).length).toBeGreaterThan(0);
  });

  it("shows cached data when fetch fails but cache exists", async () => {
    vi.mocked(getCachedNeeds).mockResolvedValue({
      data: {
        activeEvent: null,
        needsPoints: [
          {
            id: "1", lat: 16.67, lng: 120.32, status: "verified",
            gapCategory: "sustenance", accessStatus: "truck", urgency: "high",
            quantityNeeded: 80, notes: null, contactName: "Maria",
            barangayName: "Urbiztondo", municipality: "San Juan",
            createdAt: "2026-04-01T10:00:00Z",
          },
        ],
      },
      updatedAt: Date.now(),
    });

    const networkError = new Error("Network error");
    vi.mocked(getNeedsMapPoints).mockRejectedValue(networkError);
    vi.mocked(getActiveEvent).mockRejectedValue(networkError);

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    expect(screen.queryByText("App.loadError")).not.toBeInTheDocument();
  });
});
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/pages/NeedsPage.test.tsx tests/unit/lib/cache.test.ts
```

Expected: All pass.

**Step 5: Commit**

```bash
git add src/lib/cache.ts src/pages/NeedsPage.tsx tests/unit/pages/NeedsPage.test.tsx tests/unit/lib/cache.test.ts
git commit -m "feat: remove summary cards from needs page, simplify data loading"
```

---

### Task 3: Delete NeedsSummaryCards component and test

**Files:**
- Delete: `src/components/NeedsSummaryCards.tsx`
- Delete: `tests/unit/components/NeedsSummaryCards.test.tsx`

**Step 1: Delete both files**

```bash
rm src/components/NeedsSummaryCards.tsx tests/unit/components/NeedsSummaryCards.test.tsx
```

**Step 2: Run full test suite to confirm nothing else imports it**

```bash
npm test
```

Expected: All tests pass. No other file imports NeedsSummaryCards (we removed the only import in Task 2).

**Step 3: Commit**

```bash
git add -u
git commit -m "chore: delete NeedsSummaryCards component and test"
```

---

### Task 4: Update pin colors in NeedsMap

**Files:**
- Modify: `src/components/maps/NeedsMap.tsx:7-11`
- Modify: `src/components/PinDetailSheet.tsx:10-12`

**Step 1: Update STATUS_COLORS in NeedsMap**

In `src/components/maps/NeedsMap.tsx`, replace the `STATUS_COLORS` map:

```typescript
// Before:
const STATUS_COLORS: Record<string, string> = {
  verified: "var(--color-error)",
  in_transit: "var(--color-warning)",
  completed: "var(--color-success)",
};

// After:
const STATUS_COLORS: Record<string, string> = {
  pending: "var(--color-neutral-400)",
  verified: "var(--color-error)",
  in_transit: "var(--color-primary)",
};
```

Note: The `makeIcon` fallback already uses `var(--color-neutral-400)` for unknown statuses, but we make `pending` explicit. Completed is not in the map since completed pins won't be rendered on the map.

**Step 2: Update status dot colors in PinDetailSheet**

In `src/components/PinDetailSheet.tsx`, update the status-to-Tailwind-class map:

```typescript
// Before:
const STATUS_DOT: Record<string, string> = {
  verified: "bg-error",
  in_transit: "bg-warning",
  completed: "bg-success",
};

// After:
const STATUS_DOT: Record<string, string> = {
  pending: "bg-neutral-400",
  verified: "bg-error",
  in_transit: "bg-primary",
  completed: "bg-success",
};
```

**Step 3: Run tests**

```bash
npm test -- tests/unit/components/maps/NeedsMap.test.tsx tests/unit/components/PinDetailSheet.test.tsx
```

Expected: All pass (NeedsMap test mocks Leaflet and doesn't assert color values; PinDetailSheet test should pass since the map keys are still valid).

**Step 4: Commit**

```bash
git add src/components/maps/NeedsMap.tsx src/components/PinDetailSheet.tsx
git commit -m "feat: new pin colors — gray pending, red verified, blue in-transit"
```

---

### Task 5: Add i18n keys for legend and urgency badges

**Files:**
- Modify: `public/locales/en/translation.json`
- Run: `npm run translate` (for fil/ilo)

**Step 1: Update English translation file**

Add new keys and update existing ones in the `Dashboard` namespace:

```json
"statusPending": "Pending",
"statusVerified": "Verified",
"statusInTransit": "In transit",
"statusCompleted": "Completed",
"urgencyLow": "Low",
"urgencyMedium": "Medium",
"urgencyHigh": "High",
"urgencyCritical": "Critical"
```

Note: `statusVerified`, `statusInTransit`, `statusCompleted` already exist with longer descriptions ("Verified — needs response"). Update them to the short labels:

```json
"statusVerified": "Verified",
"statusInTransit": "In transit",
"statusCompleted": "Completed"
```

The `SubmitForm` namespace already has urgency keys (`urgencyLow`, etc.) but we need them in `Dashboard` too so both namespaces stay clean. Actually — since the translation mock just returns the key, and the `SubmitForm.urgencyX` keys exist, we can reuse those. But for clarity in the Dashboard context, add `Dashboard`-scoped keys.

**Step 2: Run translation script**

```bash
npm run translate
```

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat: add i18n keys for legend labels and urgency badges"
```

---

### Task 6: Restructure NeedsCoordinationMap — legend, sorting, badges

This is the main UI task. **Files:**
- Modify: `src/components/NeedsCoordinationMap.tsx` (full rewrite of component body)
- Modify: `tests/unit/components/NeedsCoordinationMap.test.tsx`

**Step 1: Rewrite NeedsCoordinationMap**

Replace the full component with the restructured version:

```tsx
import { Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";
import PinDetailSheet from "@/components/PinDetailSheet";
import { lazyWithReload } from "@/lib/lazy-reload";
import type { NeedPoint } from "@/lib/queries";

const NeedsMap = lazyWithReload(() => import("@/components/maps/NeedsMap"));

type Props = {
  needsPoints: NeedPoint[];
};

const ACCESS_KEYS: Record<string, string> = {
  truck: "Dashboard.accessTruck",
  "4x4": "Dashboard.access4x4",
  boat: "Dashboard.accessBoat",
  foot_only: "Dashboard.accessFootOnly",
  cut_off: "Dashboard.accessCutOff",
};

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  verified: 1,
  in_transit: 2,
  completed: 3,
};

const URGENCY_PRIORITY: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const URGENCY_STYLES: Record<string, string> = {
  critical: "bg-error/20 text-error",
  high: "bg-warning/20 text-warning",
  medium: "bg-neutral-400/20 text-neutral-400",
  low: "bg-neutral-400/10 text-neutral-400/60",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-neutral-400",
  verified: "bg-error",
  in_transit: "bg-primary",
  completed: "bg-success",
};

const LEGEND_ITEMS = [
  { status: "pending", dot: "bg-neutral-400", label: "Dashboard.statusPending" },
  { status: "verified", dot: "bg-error", label: "Dashboard.statusVerified" },
  { status: "in_transit", dot: "bg-primary", label: "Dashboard.statusInTransit" },
] as const;

export default function NeedsCoordinationMap({ needsPoints }: Props) {
  const { t } = useTranslation();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [selectedPoint, setSelectedPoint] = useState<NeedPoint | null>(null);

  // Apply local status overrides
  const allPoints = useMemo(
    () =>
      needsPoints.map((p) =>
        statusOverrides[p.id] ? { ...p, status: statusOverrides[p.id] } : p
      ),
    [needsPoints, statusOverrides]
  );

  // Map pins: only actionable statuses
  const mapPoints = useMemo(
    () => allPoints.filter((p) => p.status !== "completed"),
    [allPoints]
  );

  // Sidebar: all points, sorted by status priority then urgency
  const sortedPoints = useMemo(() => {
    return [...allPoints].sort((a, b) => {
      const statusDiff =
        (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return (
        (URGENCY_PRIORITY[a.urgency ?? "low"] ?? 99) -
        (URGENCY_PRIORITY[b.urgency ?? "low"] ?? 99)
      );
    });
  }, [allPoints]);

  // Legend counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, verified: 0, in_transit: 0 };
    for (const p of allPoints) {
      if (p.status in c) c[p.status]++;
    }
    return c;
  }, [allPoints]);

  function handleStatusChange(id: string, newStatus: string) {
    setStatusOverrides((prev) => ({ ...prev, [id]: newStatus }));
    setSelectedPoint((prev) =>
      prev?.id === id ? { ...prev, status: newStatus } : prev
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-50">
          {t("Dashboard.needsMap")}
        </h3>
        <span className="rounded-full bg-error/20 px-3 py-1 text-xs font-medium text-error">
          {t("Dashboard.liveNeeds")}
        </span>
      </div>

      {/* Horizontal legend with counts */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${item.dot}`} />
            <span className="text-xs text-neutral-400">
              {counts[item.status]} {t(item.label)}
            </span>
          </div>
        ))}
      </div>

      {/* Map + Sidebar grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map (2/3 width) */}
        <div className="lg:col-span-2">
          {mapPoints.length > 0 ? (
            <Suspense fallback={<MapSkeleton />}>
              <NeedsMap points={mapPoints} onPinSelect={setSelectedPoint} />
            </Suspense>
          ) : (
            <div className="flex h-[28rem] items-center justify-center rounded-lg bg-base/30">
              <p className="text-sm text-neutral-400/60">
                {t("Dashboard.noNeedsData")}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Desktop: pin detail replaces sidebar content */}
          {selectedPoint ? (
            <div className="hidden lg:block">
              <PinDetailSheet
                point={selectedPoint}
                onClose={() => setSelectedPoint(null)}
                onStatusChange={handleStatusChange}
                variant="panel"
              />
            </div>
          ) : null}

          {/* Needs list (hidden on desktop when detail panel is open) */}
          <div className={selectedPoint ? "lg:hidden" : ""}>
            <div className="divide-y divide-neutral-400/20 overflow-y-auto lg:max-h-[28rem]">
              {sortedPoints.map((need) => (
                <button
                  key={need.id}
                  onClick={() => setSelectedPoint(need)}
                  className="flex w-full items-start justify-between py-3 text-left transition-colors hover:bg-neutral-400/10 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[need.status] ?? "bg-neutral-400"}`}
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
                  {need.urgency && (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[need.urgency] ?? URGENCY_STYLES.low}`}>
                      {t(`Dashboard.urgency${need.urgency.charAt(0).toUpperCase()}${need.urgency.slice(1)}`)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: bottom sheet overlay */}
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
}
```

**Step 2: Update NeedsCoordinationMap test**

The existing test checks for `Dashboard.pinStatus` (the old sidebar legend heading) — remove that assertion. Update the test to verify the new legend and sorting behavior:

```tsx
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let capturedOnPinSelect: ((point: any) => void) | null = null;

vi.mock("@/components/maps/NeedsMap", () => ({
  default: ({ onPinSelect, points }: { onPinSelect: (point: any) => void; points: any[] }) => {
    capturedOnPinSelect = onPinSelect;
    return <div data-testid="needs-map" data-point-count={points.length} />;
  },
}));
vi.mock("@/components/PinDetailSheet", () => ({
  default: ({ point, onClose, variant }: { point: any; onClose: () => void; variant?: string }) => (
    <div data-testid={variant === "panel" ? "pin-detail-panel" : "pin-detail-sheet"}>
      <span>{point.barangayName}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

const mockPoints = [
  {
    id: "1", lat: 16.67, lng: 120.32, status: "verified",
    gapCategory: "sustenance", accessStatus: "truck", urgency: "high",
    quantityNeeded: 80, notes: "Food needed", contactName: "Maria",
    barangayName: "Urbiztondo", municipality: "San Juan",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "2", lat: 16.73, lng: 120.35, status: "verified",
    gapCategory: "lunas", accessStatus: "boat", urgency: "critical",
    quantityNeeded: 50, notes: "Medical", contactName: "Jose",
    barangayName: "Bacnotan", municipality: "Bacnotan",
    createdAt: "2026-04-01T12:00:00Z",
  },
  {
    id: "3", lat: 16.66, lng: 120.33, status: "completed",
    gapCategory: "sustenance", accessStatus: "truck", urgency: "medium",
    quantityNeeded: 70, notes: "Delivered", contactName: "Elena",
    barangayName: "Poblacion", municipality: "San Juan",
    createdAt: "2026-04-01T08:00:00Z",
  },
  {
    id: "4", lat: 16.80, lng: 120.37, status: "pending",
    gapCategory: "sustenance", accessStatus: "cut_off", urgency: "critical",
    quantityNeeded: 45, notes: "Unverified", contactName: "Caller",
    barangayName: "Poblacion Luna", municipality: "Luna",
    createdAt: "2026-04-01T14:00:00Z",
  },
];

describe("NeedsCoordinationMap", () => {
  it("renders the map, legend with counts, and needs list", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);

    // Map renders
    expect(await screen.findByTestId("needs-map")).toBeInTheDocument();

    // Legend labels present
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
    expect(screen.getByText(/Dashboard.statusPending/)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard.statusVerified/)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard.statusInTransit/)).toBeInTheDocument();
  });

  it("excludes completed points from the map", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    const map = await screen.findByTestId("needs-map");
    // 4 total points, but completed is excluded from map → 3 map points
    expect(map.getAttribute("data-point-count")).toBe("3");
  });

  it("sorts sidebar by status priority then urgency", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);

    const buttons = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.includes("sustenance") || btn.textContent?.includes("lunas")
    );

    // Expected order: pending-critical (Poblacion Luna), verified-critical (Bacnotan),
    // verified-high (Urbiztondo), completed-medium (Poblacion)
    const names = buttons.map((btn) => {
      const nameEl = btn.querySelector("p");
      return nameEl?.textContent;
    });
    expect(names).toEqual(["Poblacion Luna", "Bacnotan", "Urbiztondo", "Poblacion"]);
  });

  it("shows urgency badge on every list item", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);

    // All 4 items should have an urgency badge
    expect(screen.getAllByText(/Dashboard\.urgency/)).toHaveLength(4);
  });

  it("renders PinDetailSheet when a point is selected and hides on close", async () => {
    capturedOnPinSelect = null;
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    await screen.findByTestId("needs-map");

    expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();

    expect(capturedOnPinSelect).not.toBeNull();
    act(() => {
      capturedOnPinSelect!(mockPoints[0]);
    });

    const sheet = screen.getByTestId("pin-detail-sheet");
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveTextContent("Urbiztondo");

    const closeButton = within(sheet).getByText("close");
    fireEvent.click(closeButton);
    expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();
  });
});
```

**Step 3: Run tests**

```bash
npm test -- tests/unit/components/NeedsCoordinationMap.test.tsx
```

Expected: All pass.

**Step 4: Commit**

```bash
git add src/components/NeedsCoordinationMap.tsx tests/unit/components/NeedsCoordinationMap.test.tsx
git commit -m "feat: restructure needs map — inline legend, sorted sidebar, urgency badges"
```

---

### Task 7: Update i18n translations

**Files:**
- Modify: `public/locales/en/translation.json`
- Run: `npm run translate`

**Step 1: Update English translations**

In the `Dashboard` namespace, update/add these keys:

```json
"statusPending": "Pending",
"statusVerified": "Verified",
"statusInTransit": "In transit",
"statusCompleted": "Completed",
"urgencyLow": "Low",
"urgencyMedium": "Medium",
"urgencyHigh": "High",
"urgencyCritical": "Critical"
```

The old verbose labels (`"Verified — needs response"`, etc.) get replaced by the short versions.

Optionally remove unused keys if nothing else references them: `pinStatus`, `activeNeeds`, `awaitingResponse`, `fulfilled`, `needsMet`, `criticalNeeds`, `immediateAttention`, `allAccess`. Verify with grep first.

**Step 2: Run translate**

```bash
npm run translate
```

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat: update i18n — short legend labels, urgency badge keys"
```

---

### Task 8: Run full verification

**Step 1: Run unit tests**

```bash
npm test
```

Expected: All pass.

**Step 2: Run TypeScript check + build**

```bash
npm run build
```

Expected: No type errors, clean build.

**Step 3: Run lint**

```bash
npm run lint
```

Expected: Clean.

**Step 4: Run Playwright smoke tests**

```bash
npm run verify
```

Expected: All smoke tests pass.

**Step 5: Visual verification with dev server**

```bash
npm run dev
```

Open `http://localhost:5173/en` and verify:
- No summary cards above the map
- Horizontal legend shows colored dots with counts: `X Pending`, `X Verified`, `X In transit`
- Map shows gray (pending), red (verified), blue (in transit) pins — no completed pins
- Sidebar list is sorted: pending items first (by urgency), then verified, then in transit, then completed (muted)
- Every list item has an urgency badge (Critical/High/Medium/Low)
- Completed items at bottom have muted text
- Click a pin → detail panel opens on desktop, bottom sheet on mobile
- Mobile layout stacks properly

**Step 6: Commit any fixes, then final commit if needed**
