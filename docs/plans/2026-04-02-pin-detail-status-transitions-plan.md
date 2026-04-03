# Pin Detail Panel & Status Transitions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Leaflet popup on the needs map with a bottom sheet showing full submission details and forward-only status transition controls.

**Architecture:** New `PinDetailSheet` component rendered by `NeedsCoordinationMap`, which holds selected-point state. `NeedsMap` removes its `<Popup>` and calls an `onPinSelect` callback. Status mutations go through a new `updateSubmissionStatus()` query function, gated by a new RLS policy.

**Tech Stack:** React, TypeScript, Tailwind CSS (semantic tokens only), Supabase (Postgres RLS), react-i18next, Vitest + RTL, Playwright

---

### Task 1: Extend NeedPoint type and query with `createdAt`

The detail panel needs a submission timestamp. The `NeedPoint` type currently omits `created_at`.

**Files:**
- Modify: `src/lib/queries.ts:112-154`
- Test: `tests/unit/lib/queries.test.ts`

**Step 1: Update the type and query**

In `src/lib/queries.ts`, add `createdAt` to `NeedPoint`:

```typescript
export type NeedPoint = {
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
  createdAt: string;  // <-- add this
};
```

In `getNeedsMapPoints()`, add `created_at` to the select string:

```typescript
.select(
  "id, lat, lng, status, gap_category, access_status, urgency, quantity_needed, notes, contact_name, created_at, barangays(name, municipality)"
)
```

And map it in the return:

```typescript
createdAt: row.created_at as string,
```

**Step 2: Run existing tests to make sure nothing breaks**

Run: `npx vitest run tests/unit/lib/queries.test.ts`
Expected: PASS (existing tests shouldn't depend on the absence of `createdAt`)

**Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat(queries): add createdAt to NeedPoint type and query"
```

---

### Task 2: Add `updateSubmissionStatus` query function

**Files:**
- Modify: `src/lib/queries.ts`
- Test: `tests/unit/lib/queries.test.ts`

**Step 1: Write the failing test**

In `tests/unit/lib/queries.test.ts`, add:

```typescript
import { updateSubmissionStatus } from "@/lib/queries";

describe("updateSubmissionStatus", () => {
  it("calls supabase update with correct id and status", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

    await updateSubmissionStatus("abc-123", "in_transit");

    expect(supabase.from).toHaveBeenCalledWith("submissions");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "in_transit" });
  });

  it("throws on supabase error", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      error: { message: "RLS violation" },
    });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

    await expect(updateSubmissionStatus("abc-123", "verified")).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/queries.test.ts`
Expected: FAIL — `updateSubmissionStatus` is not exported

**Step 3: Write the implementation**

Add to `src/lib/queries.ts` (after the `getNeedsSummary` function):

```typescript
export async function updateSubmissionStatus(id: string, status: string) {
  const { error } = await supabase
    .from("submissions")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/queries.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat(queries): add updateSubmissionStatus function"
```

---

### Task 3: Add RLS policy for anon UPDATE on submissions

**Files:**
- Modify: `supabase/rls-policies.sql`

**Step 1: Add the policy**

Append to `supabase/rls-policies.sql` after the existing submissions policies:

```sql
CREATE POLICY "anon_update_submissions" ON submissions
  FOR UPDATE USING (true) WITH CHECK (true);
```

**Step 2: Apply to Supabase**

> **Note:** Ask the user before running this — it's a write operation on the remote database.

```bash
npx supabase db push
```

Or apply manually via Supabase SQL editor.

**Step 3: Commit**

```bash
git add supabase/rls-policies.sql
git commit -m "feat(rls): add anon UPDATE policy on submissions for demo"
```

---

### Task 4: Add i18n keys for PinDetail namespace

**Files:**
- Modify: `public/locales/en/translation.json`

**Step 1: Add English keys**

Add a new `PinDetail` namespace to `public/locales/en/translation.json`:

```json
"PinDetail": {
  "statusPending": "Pending",
  "statusVerified": "Verified",
  "statusInTransit": "In Transit",
  "statusCompleted": "Completed",
  "statusResolved": "Resolved",
  "markVerified": "Mark Verified",
  "markInTransit": "Mark In Transit",
  "markCompleted": "Mark Completed",
  "markResolved": "Mark Resolved",
  "offlineMessage": "Status changes require an internet connection",
  "resolvedMessage": "This need has been resolved",
  "contactName": "Contact",
  "submitted": "Submitted",
  "notes": "Notes",
  "photo": "Photo",
  "gapCategory": "Type of Need",
  "urgency": "Urgency",
  "access": "Access",
  "families": "Families",
  "close": "Close detail panel",
  "statusLabel": "Status",
  "updating": "Updating...",
  "updateError": "Failed to update status. Try again."
}
```

**Step 2: Run machine translation**

Run: `npm run translate`
Expected: Filipino and Ilocano translation files updated with new keys

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat(i18n): add PinDetail translation keys"
```

---

### Task 5: Modify NeedsMap to use `onPinSelect` callback

Remove the Leaflet `<Popup>` and call a callback when a marker is clicked.

**Files:**
- Modify: `src/components/maps/NeedsMap.tsx`
- Test: `tests/unit/components/maps/NeedsMap.test.tsx`

**Step 1: Write the failing test**

Replace the existing NeedsMap tests (since the popup is being removed):

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({
    children,
    eventHandlers,
  }: {
    children?: React.ReactNode;
    eventHandlers?: { click?: () => void };
  }) => (
    <div data-testid="marker" onClick={eventHandlers?.click}>
      {children}
    </div>
  ),
}));
vi.mock("leaflet", () => ({
  default: { divIcon: vi.fn(() => ({})) },
  divIcon: vi.fn(() => ({})),
}));

const mockPoints = [
  {
    id: "1",
    lat: 16.67,
    lng: 120.32,
    status: "verified",
    gapCategory: "sustenance",
    accessStatus: "truck",
    urgency: "high",
    quantityNeeded: 80,
    notes: "Food needed",
    contactName: "Maria Santos",
    barangayName: "Urbiztondo",
    municipality: "San Juan",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "2",
    lat: 16.73,
    lng: 120.35,
    status: "in_transit",
    gapCategory: "lunas",
    accessStatus: "boat",
    urgency: "critical",
    quantityNeeded: 50,
    notes: "Medical supplies",
    contactName: "Jose Reyes",
    barangayName: "Bacnotan Proper",
    municipality: "Bacnotan",
    createdAt: "2026-04-01T12:00:00Z",
  },
];

describe("NeedsMap", () => {
  it("renders markers for each need point", async () => {
    const { default: NeedsMap } = await import("@/components/maps/NeedsMap");
    render(<NeedsMap points={mockPoints} onPinSelect={vi.fn()} />);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("calls onPinSelect when a marker is clicked", async () => {
    const { default: NeedsMap } = await import("@/components/maps/NeedsMap");
    const onPinSelect = vi.fn();
    render(<NeedsMap points={mockPoints} onPinSelect={onPinSelect} />);
    fireEvent.click(screen.getAllByTestId("marker")[0]);
    expect(onPinSelect).toHaveBeenCalledWith(mockPoints[0]);
  });

  it("does not render popups", async () => {
    const { default: NeedsMap } = await import("@/components/maps/NeedsMap");
    render(<NeedsMap points={mockPoints} onPinSelect={vi.fn()} />);
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/maps/NeedsMap.test.tsx`
Expected: FAIL — `onPinSelect` prop not accepted, Popup still renders

**Step 3: Implement the changes**

Update `src/components/maps/NeedsMap.tsx`:

- Remove `Popup` from react-leaflet imports
- Remove `ACCESS_KEYS` (no longer needed here — it's still in `NeedsCoordinationMap`)
- Add `onPinSelect` to the Props type
- Replace the `<Popup>` block inside `<Marker>` with `eventHandlers={{ click: () => onPinSelect(point) }}`
- Remove `useTranslation` import (no longer needed — no popup text)

The updated component:

```typescript
import { useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import type { NeedPoint } from "@/lib/queries";

const STATUS_COLORS: Record<string, string> = {
  verified: "var(--color-error)",
  in_transit: "var(--color-warning)",
  completed: "var(--color-success)",
};

function makeIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "var(--color-neutral-400)";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid var(--color-neutral-50);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type Props = {
  points: NeedPoint[];
  onPinSelect: (point: NeedPoint) => void;
};

export default function NeedsMap({ points, onPinSelect }: Props) {
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

  return (
    <div className="relative h-[28rem] overflow-hidden rounded-lg">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: handleTileError,
            tileload: handleTileLoad,
          }}
        />
        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={makeIcon(point.status)}
            eventHandlers={{ click: () => onPinSelect(point) }}
          />
        ))}
      </MapContainer>
      {tilesUnavailable && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center bg-base/80"
        >
          <p className="text-neutral-400 text-sm">
            Map tiles unavailable offline
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/maps/NeedsMap.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/maps/NeedsMap.tsx tests/unit/components/maps/NeedsMap.test.tsx
git commit -m "refactor(NeedsMap): replace Popup with onPinSelect callback"
```

---

### Task 6: Create PinDetailSheet component

**Files:**
- Create: `src/components/PinDetailSheet.tsx`
- Create: `tests/unit/components/PinDetailSheet.test.tsx`

**Step 1: Write the failing tests**

Create `tests/unit/components/PinDetailSheet.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PinDetailSheet from "@/components/PinDetailSheet";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/queries", () => ({
  updateSubmissionStatus: vi.fn(),
}));

const mockPoint = {
  id: "abc-123",
  lat: 16.67,
  lng: 120.32,
  status: "verified",
  gapCategory: "sustenance",
  accessStatus: "truck",
  urgency: "high",
  quantityNeeded: 80,
  notes: "Food needed urgently",
  contactName: "Maria Santos",
  barangayName: "Urbiztondo",
  municipality: "San Juan",
  createdAt: "2026-04-01T10:00:00Z",
};

describe("PinDetailSheet", () => {
  it("renders all submission details", () => {
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("Urbiztondo, San Juan")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Food needed urgently")).toBeInTheDocument();
  });

  it("shows forward transition buttons for verified status", () => {
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("PinDetail.markInTransit")).toBeInTheDocument();
    expect(screen.getByText("PinDetail.markCompleted")).toBeInTheDocument();
    expect(screen.getByText("PinDetail.markResolved")).toBeInTheDocument();
    // Should NOT show "Mark Verified" since already verified
    expect(screen.queryByText("PinDetail.markVerified")).not.toBeInTheDocument();
  });

  it("shows no transition buttons for resolved status", () => {
    render(
      <PinDetailSheet
        point={{ ...mockPoint, status: "resolved" }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("PinDetail.resolvedMessage")).toBeInTheDocument();
    expect(screen.queryByText("PinDetail.markVerified")).not.toBeInTheDocument();
    expect(screen.queryByText("PinDetail.markInTransit")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={onClose}
        onStatusChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("PinDetail.close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onStatusChange on successful transition", async () => {
    const { updateSubmissionStatus } = await import("@/lib/queries");
    vi.mocked(updateSubmissionStatus).mockResolvedValue(undefined);

    const onStatusChange = vi.fn();
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={vi.fn()}
        onStatusChange={onStatusChange}
      />
    );

    fireEvent.click(screen.getByText("PinDetail.markInTransit"));

    // Wait for async mutation
    await vi.waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith("abc-123", "in_transit");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/PinDetailSheet.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement PinDetailSheet**

Create `src/components/PinDetailSheet.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { updateSubmissionStatus } from "@/lib/queries";
import type { NeedPoint } from "@/lib/queries";

const STATUS_ORDER = ["pending", "verified", "in_transit", "completed", "resolved"] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-neutral-400",
  verified: "bg-error",
  in_transit: "bg-warning",
  completed: "bg-success",
  resolved: "bg-primary",
};

const STATUS_BUTTON_COLORS: Record<string, string> = {
  verified: "bg-error hover:bg-error/80",
  in_transit: "bg-warning hover:bg-warning/80",
  completed: "bg-success hover:bg-success/80",
  resolved: "bg-primary hover:bg-primary/80",
};

const STATUS_KEYS: Record<string, string> = {
  pending: "PinDetail.statusPending",
  verified: "PinDetail.statusVerified",
  in_transit: "PinDetail.statusInTransit",
  completed: "PinDetail.statusCompleted",
  resolved: "PinDetail.statusResolved",
};

const MARK_KEYS: Record<string, string> = {
  verified: "PinDetail.markVerified",
  in_transit: "PinDetail.markInTransit",
  completed: "PinDetail.markCompleted",
  resolved: "PinDetail.markResolved",
};

const ACCESS_KEYS: Record<string, string> = {
  truck: "Dashboard.accessTruck",
  "4x4": "Dashboard.access4x4",
  boat: "Dashboard.accessBoat",
  foot_only: "Dashboard.accessFootOnly",
  cut_off: "Dashboard.accessCutOff",
};

type Props = {
  point: NeedPoint;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: string) => void;
};

export default function PinDetailSheet({ point, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const currentIndex = STATUS_ORDER.indexOf(point.status as typeof STATUS_ORDER[number]);
  const forwardStatuses = STATUS_ORDER.slice(currentIndex + 1);
  const isResolved = point.status === "resolved";

  async function handleTransition(newStatus: string) {
    if (!isOnline) return;
    setUpdating(newStatus);
    setError(null);
    try {
      await updateSubmissionStatus(point.id, newStatus);
      onStatusChange(point.id, newStatus);
    } catch {
      setError(t("PinDetail.updateError"));
    } finally {
      setUpdating(null);
    }
  }

  const relativeTime = formatRelativeTime(point.createdAt);

  return (
    <div
      role="dialog"
      aria-label={`${point.barangayName}, ${point.municipality}`}
      className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-full ${STATUS_COLORS[point.status] ?? "bg-neutral-400"}`} />
            <span className="text-xs font-medium text-neutral-400">
              {t(STATUS_KEYS[point.status] ?? "PinDetail.statusPending")}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={t("PinDetail.close")}
            className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Location */}
        <h3 className="mb-3 text-lg font-semibold text-neutral-50">
          {point.barangayName}, {point.municipality}
        </h3>

        {/* Details grid */}
        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-neutral-400">{t("PinDetail.gapCategory")}</span>
            <p className="text-neutral-50">{point.gapCategory ?? t("Dashboard.unset")}</p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.urgency")}</span>
            <p className="text-neutral-50">
              {t(`Dashboard.urgency_${point.urgency ?? "unset"}`, point.urgency ?? "")}
            </p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.access")}</span>
            <p className="text-neutral-50">
              {point.accessStatus && ACCESS_KEYS[point.accessStatus]
                ? t(ACCESS_KEYS[point.accessStatus])
                : point.accessStatus ?? ""}
            </p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.families")}</span>
            <p className="text-neutral-50">{point.quantityNeeded ?? "—"}</p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.contactName")}</span>
            <p className="text-neutral-50">{point.contactName}</p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.submitted")}</span>
            <p className="text-neutral-50">{relativeTime}</p>
          </div>
        </div>

        {/* Notes */}
        {point.notes && (
          <div className="mb-4">
            <span className="text-sm text-neutral-400">{t("PinDetail.notes")}</span>
            <p className="mt-1 text-sm text-neutral-100">{point.notes}</p>
          </div>
        )}

        {/* Step indicator */}
        <div className="mb-4" aria-hidden="true">
          <div className="flex items-center justify-between">
            {STATUS_ORDER.map((s, i) => {
              const isCurrent = s === point.status;
              const isPast = i < currentIndex;
              return (
                <div key={s} className="flex flex-1 items-center">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      isCurrent
                        ? STATUS_COLORS[s]
                        : isPast
                          ? STATUS_COLORS[s] + " opacity-60"
                          : "bg-neutral-400/30"
                    }`}
                  />
                  {i < STATUS_ORDER.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 ${
                        isPast ? "bg-neutral-400/40" : "bg-neutral-400/20"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status actions */}
        {isResolved ? (
          <p className="text-center text-sm text-neutral-400">
            {t("PinDetail.resolvedMessage")}
          </p>
        ) : (
          <div className="space-y-2">
            {!isOnline && (
              <p className="text-center text-xs text-warning">
                {t("PinDetail.offlineMessage")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {forwardStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleTransition(s)}
                  disabled={!isOnline || updating !== null}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-50 transition-colors disabled:opacity-50 ${
                    STATUS_BUTTON_COLORS[s] ?? "bg-neutral-400"
                  }`}
                >
                  {updating === s ? t("PinDetail.updating") : t(MARK_KEYS[s])}
                </button>
              ))}
            </div>
            {error && (
              <p className="text-center text-xs text-error">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
```

Also add the slide-up animation to `src/index.css` (inside the `@theme inline` block or after it):

```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/PinDetailSheet.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/PinDetailSheet.tsx tests/unit/components/PinDetailSheet.test.tsx src/index.css
git commit -m "feat: add PinDetailSheet component with status transitions"
```

---

### Task 7: Wire PinDetailSheet into NeedsCoordinationMap

**Files:**
- Modify: `src/components/NeedsCoordinationMap.tsx`
- Test: `tests/unit/components/NeedsCoordinationMap.test.tsx`

**Step 1: Write the failing test**

Add to `tests/unit/components/NeedsCoordinationMap.test.tsx`:

```typescript
vi.mock("@/components/PinDetailSheet", () => ({
  default: ({ point, onClose }: any) => (
    <div data-testid="pin-detail-sheet">
      <span>{point.barangayName}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

it("renders PinDetailSheet when a point is selected", async () => {
  const { default: NeedsCoordinationMap } = await import(
    "@/components/NeedsCoordinationMap"
  );
  // NeedsMap mock needs to call onPinSelect
  // Update the NeedsMap mock to expose onPinSelect
  vi.mocked(await import("@/components/maps/NeedsMap")).default = (({ onPinSelect }: any) => (
    <div data-testid="needs-map">
      <button data-testid="select-pin" onClick={() => onPinSelect(mockPoints[0])}>
        select
      </button>
    </div>
  )) as any;

  render(<NeedsCoordinationMap needsPoints={mockPoints} />);
  expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId("select-pin"));
  expect(screen.getByTestId("pin-detail-sheet")).toBeInTheDocument();
  expect(screen.getByText("Urbiztondo")).toBeInTheDocument();
});
```

> **Note:** The mock setup for this test is complex because `NeedsMap` is lazy-loaded. The implementing agent should adapt the test to work with the existing mock pattern (dynamic import + `vi.mock`). The key assertion is: clicking a pin renders the sheet, closing it hides it.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/NeedsCoordinationMap.test.tsx`
Expected: FAIL

**Step 3: Implement the wiring**

Update `src/components/NeedsCoordinationMap.tsx`:

Key changes:
1. Import `PinDetailSheet` (regular import, not lazy — it's small)
2. Add state: `const [selectedPoint, setSelectedPoint] = useState<NeedPoint | null>(null)`
3. Add `points` state initialized from `needsPoints` prop (so we can update locally on status change)
4. Pass `onPinSelect={setSelectedPoint}` to `<NeedsMap>`
5. Add `handleStatusChange` that updates the point's status in the local array
6. Render `{selectedPoint && <PinDetailSheet ... />}` at the end of the component

```typescript
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";
import PinDetailSheet from "@/components/PinDetailSheet";
import { lazyWithReload } from "@/lib/lazy-reload";
import type { NeedPoint } from "@/lib/queries";

const NeedsMap = lazyWithReload(() => import("@/components/maps/NeedsMap"));

// ... ACCESS_KEYS, ACCESS_FILTERS stay the same ...

export default function NeedsCoordinationMap({ needsPoints }: Props) {
  const { t } = useTranslation();
  const [accessFilter, setAccessFilter] = useState("all");
  const [points, setPoints] = useState(needsPoints);
  const [selectedPoint, setSelectedPoint] = useState<NeedPoint | null>(null);

  const filtered =
    accessFilter === "all"
      ? points
      : points.filter((p) => p.accessStatus === accessFilter);

  function handleStatusChange(id: string, newStatus: string) {
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );
    setSelectedPoint((prev) =>
      prev?.id === id ? { ...prev, status: newStatus } : prev
    );
  }

  return (
    <div className="...">
      {/* ... existing filter + map + sidebar JSX ... */}

      {/* Pass onPinSelect to NeedsMap */}
      <NeedsMap points={filtered} onPinSelect={setSelectedPoint} />

      {/* Pin detail sheet */}
      {selectedPoint && (
        <PinDetailSheet
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/NeedsCoordinationMap.test.tsx`
Expected: PASS

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/components/NeedsCoordinationMap.tsx tests/unit/components/NeedsCoordinationMap.test.tsx
git commit -m "feat: wire PinDetailSheet into NeedsCoordinationMap"
```

---

### Task 8: Update NeedsMap test mock data for `createdAt`

Ensure all test fixtures across the codebase include the new `createdAt` field to prevent type errors.

**Files:**
- Modify: `tests/unit/components/NeedsCoordinationMap.test.tsx` — add `createdAt` to `mockPoints`
- Modify: `tests/unit/pages/NeedsPage.test.tsx` — add `createdAt` to any mock `NeedPoint` fixtures

**Step 1: Update all mock data**

Add `createdAt: "2026-04-01T10:00:00Z"` to every mock `NeedPoint` in these test files.

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: add createdAt to NeedPoint test fixtures"
```

---

### Task 9: Playwright verification

**Files:**
- None modified — this is a verification step

**Step 1: Build and verify**

Run: `npm run build`
Expected: TypeScript compiles with no errors, production build succeeds

**Step 2: Run Playwright smoke tests**

Run: `npm run verify`
Expected: All smoke tests pass. The needs page should still render correctly — pins are visible, clicking opens the bottom sheet instead of a popup.

**Step 3: Manual spot-check (headed mode)**

Run: `npm run verify:headed`
Expected: Visually confirm:
- Clicking a pin opens the bottom sheet
- All fields display correctly
- Status transition buttons appear
- Close button dismisses the sheet
- Pin colors match status

---

### Task 10: Final commit and PR prep

**Step 1: Ensure clean state**

Run: `git status`
Expected: No uncommitted changes

**Step 2: Review all changes**

Run: `git log --oneline main..HEAD`
Expected: Clean commit history covering tasks 1-8

> **Note:** PR creation will be handled separately using the finishing-a-development-branch skill.
