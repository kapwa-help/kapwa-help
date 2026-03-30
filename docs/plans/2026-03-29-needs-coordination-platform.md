# Needs Coordination Platform — Data Model & Map Reorientation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve LUaid from a retrospective donations dashboard into a needs-first coordination platform aligned with the KapwaRelief scope document (`docs/scope`).

**Architecture:** Add an `events` table to scope all data to a disaster operation. Expand the `submissions` table into a proper "Needs" entity with access status, the scope's 3 gap categories (Lunas/Sustenance/Shelter), and full pin lifecycle status. Reframe `deployments` as "Relief Actions" linked to specific needs. Reorient the map from deployment markers to needs pins colored by status. Keep existing `donations` and `deployments` tables but de-emphasize in UI.

**Tech Stack:** Supabase (Postgres), React + TypeScript, Leaflet/react-leaflet, Vitest + React Testing Library, Playwright

---

## Task 1: Add `events` table to schema

Every need and action belongs to a disaster event. This scopes the entire app.

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `supabase/rls-policies.sql`

**Step 1: Add events table to schema.sql**

Add this before the `organizations` table (top of file, after the header comment):

```sql
-- Events: disaster operations that scope all data
CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  region      text NOT NULL,
  started_at  date NOT NULL,
  ended_at    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

**Step 2: Add RLS policy for events**

Add to `rls-policies.sql` before the organizations section:

```sql
-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_events" ON events
  FOR SELECT USING (true);
```

**Step 3: Commit**

```bash
git add supabase/schema.sql supabase/rls-policies.sql
git commit -m "feat(schema): add events table for disaster operation scoping"
```

---

## Task 2: Expand `submissions` into a "Needs" entity

The scope document defines needs with: GPS + gap category (Lunas/Sustenance/Shelter) + access status + pin lifecycle. We evolve the existing `submissions` table to support this while preserving the feedback type.

**Files:**
- Modify: `supabase/schema.sql` (the `submissions` table and `aid_categories` seed data)

**Step 1: Add scope-aligned gap categories to seed data**

Replace the existing `INSERT INTO aid_categories` block at the bottom of `schema.sql` with:

```sql
-- Seed aid categories
-- Original dashboard categories
INSERT INTO aid_categories (name, icon) VALUES
  ('Water Filtration', 'droplet'),
  ('Meals', 'utensils'),
  ('Relief Goods', 'package'),
  ('Construction Materials', 'hammer'),
  ('Cleaning Supplies', 'sparkles'),
  ('Drinking Water', 'glass-water'),
  ('Kiddie Packs', 'baby');

-- Scope-aligned gap categories (KapwaRelief "The Gap" taxonomy)
INSERT INTO aid_categories (name, icon) VALUES
  ('Lunas', 'heart-pulse'),
  ('Sustenance', 'utensils'),
  ('Shelter', 'house');
```

**Step 2: Expand the submissions table**

Replace the existing `CREATE TABLE submissions` block with:

```sql
-- Submissions: aid needs and feedback from the field
-- "Needs" follow the KapwaRelief pin lifecycle (docs/scope §5.B)
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  type            text NOT NULL CHECK (type IN ('need', 'request', 'feedback')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'in_transit', 'completed', 'resolved')),
  -- Contact
  contact_name    text NOT NULL,
  contact_phone   text,
  -- Location
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  gap_category    text CHECK (gap_category IN ('lunas', 'sustenance', 'shelter')),
  lat             decimal(9,6),
  lng             decimal(9,6),
  -- Access / passability (scope §5.A)
  access_status   text CHECK (access_status IN ('truck', '4x4', 'boat', 'foot_only', 'cut_off')),
  -- Need details
  quantity_needed integer,
  urgency         text CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  notes           text,
  photo_url       text,
  -- Feedback fields (type='feedback' only)
  rating          integer CHECK (rating BETWEEN 1 AND 5),
  issue_type      text CHECK (issue_type IN ('insufficient', 'damaged', 'wrong_items', 'delayed')),
  -- Timestamps
  verified_at     timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);
```

Key changes from the existing table:
- Added `event_id` FK to scope needs to a disaster
- Added `type = 'need'` to the check constraint (original had only request/feedback)
- Expanded `status` to match the pin lifecycle: `pending → verified → in_transit → completed` (plus `resolved` for backward compat)
- Added `gap_category` for the scope's 3 categories (Lunas/Sustenance/Shelter)
- Added `access_status` for passability (Truck/4x4/Boat/Foot-only/Cut-off)
- Added `photo_url` placeholder (no storage yet, just the column)
- Added `verified_at` and `completed_at` timestamps for lifecycle tracking

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): expand submissions into needs entity with lifecycle and access status"
```

---

## Task 3: Link deployments to events and needs

Reframe `deployments` as "Relief Actions" that can optionally fulfill a specific need.

**Files:**
- Modify: `supabase/schema.sql` (the `deployments` table)

**Step 1: Add event_id and submission_id to deployments**

Replace the existing `CREATE TABLE deployments` block with:

```sql
-- Deployments (Relief Actions): every aid delivery event
-- Can optionally fulfill a specific need (submission_id)
CREATE TABLE deployments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  barangay_id     uuid REFERENCES barangays(id),
  submission_id   uuid REFERENCES submissions(id),
  quantity        integer,
  unit            text,
  recipient       text,
  lat             decimal(9,6),
  lng             decimal(9,6),
  date            date,
  volunteer_count integer,
  hours           decimal(5,1),
  notes           text,
  created_at      timestamptz DEFAULT now()
);
```

Changes: added `event_id` and `submission_id` (both nullable for backward compat with existing data).

**Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): link deployments to events and specific needs"
```

---

## Task 4: Create demo event and seed needs data

Populate the new schema with demo data that tells the KapwaRelief story.

**Files:**
- Modify: `supabase/seed-demo.sql`

**Step 1: Add event and needs to seed script**

At the top of the `DECLARE` block, add:

```sql
  -- Event ID
  v_event          uuid;

  -- Gap category IDs
  v_lunas          uuid;
  v_sustenance     uuid;
  v_shelter        uuid;
```

At the start of the `BEGIN` block (after the existing org lookups, before donations), add:

```sql
  -- ============================================================
  -- 0. Insert demo event
  -- ============================================================
  INSERT INTO events (name, slug, description, region, started_at, is_active)
    VALUES (
      'Typhoon Emong Relief',
      'typhoon-emong-2024',
      'Category 4 typhoon making landfall in La Union, November 2024',
      'La Union',
      '2024-11-10',
      true
    )
    RETURNING id INTO v_event;

  -- Look up scope gap categories
  SELECT id INTO v_lunas      FROM aid_categories WHERE name = 'Lunas';
  SELECT id INTO v_sustenance FROM aid_categories WHERE name = 'Sustenance';
  SELECT id INTO v_shelter    FROM aid_categories WHERE name = 'Shelter';
```

After the existing deployments section (before section 8), add:

```sql
  -- ============================================================
  -- 9. Insert demo needs (submissions with type='need')
  --    Spread across barangays with varied statuses and access
  -- ============================================================
  INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, aid_category_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, created_at) VALUES
    -- Verified needs (live on map)
    (v_event, 'need', 'verified',   'Kap. Maria Santos',    v_brgy_urbiztondo,   v_lunas,      'lunas',      16.6690, 120.3230, 'truck',     50, 'critical', 'Medical supplies for 50 families — multiple injuries from debris', '2024-11-11 08:00:00+08'),
    (v_event, 'need', 'verified',   'Kap. Jose Reyes',      v_brgy_bacnotan,     v_sustenance, 'sustenance', 16.7345, 120.3475, '4x4',       80, 'high',     'Food and water for 80 families — supplies running low',             '2024-11-11 09:30:00+08'),
    (v_event, 'need', 'verified',   'Ldr. Ana Cruz',        v_brgy_nalvo,        v_shelter,    'shelter',    16.8090, 120.3690, 'foot_only', 30, 'critical', '30 homes destroyed — need tarps and building materials',            '2024-11-11 10:00:00+08'),
    (v_event, 'need', 'verified',   'Ldr. Pedro Gomez',     v_brgy_paringao,     v_sustenance, 'sustenance', 16.5150, 120.3290, 'boat',      60, 'high',     'Flooding cut road access — boat needed for food delivery',          '2024-11-12 07:00:00+08'),
    (v_event, 'need', 'verified',   'Vol. Rica Tan',        v_brgy_guerrero,     v_lunas,      'lunas',      16.7260, 120.3550, 'truck',     25, 'medium',   'First aid kits needed for minor injuries',                          '2024-11-12 11:00:00+08'),
    -- In-transit (donor committed)
    (v_event, 'need', 'in_transit', 'Kap. Luis Aquino',     v_brgy_central_east, v_sustenance, 'sustenance', 16.5380, 120.3400, 'truck',     100, 'high',    'EcoNest committed 420 relief packs — en route',                    '2024-11-11 14:00:00+08'),
    (v_event, 'need', 'in_transit', 'Ldr. Rosa Bautista',   v_brgy_dili,         v_shelter,    'shelter',    16.7420, 120.3510, '4x4',       40, 'high',     'Art Relief deploying construction materials',                       '2024-11-12 08:00:00+08'),
    -- Completed (fulfilled)
    (v_event, 'need', 'completed',  'Kap. Elena Ramos',     v_brgy_poblacion_sj, v_sustenance, 'sustenance', 16.6640, 120.3290, 'truck',     70, 'high',     'LU Citizen Volunteers delivered 480 meals',                        '2024-11-11 06:00:00+08'),
    (v_event, 'need', 'completed',  'Vol. Marco Diaz',      v_brgy_baccuit,      v_lunas,      'lunas',      16.5462, 120.3312, 'truck',     35, 'medium',   'La Union Surf Club delivered 120 medical kits',                    '2024-11-12 09:00:00+08'),
    -- Pending (unverified, not yet visible on map)
    (v_event, 'need', 'pending',    'Caller: unknown',      v_brgy_poblacion_lu, v_sustenance, 'sustenance', 16.8015, 120.3735, 'cut_off',   45, 'critical', 'Unverified report of cut-off community needing food — checking',   '2024-11-13 06:00:00+08');

  -- Link existing deployments to the event
  UPDATE deployments SET event_id = v_event WHERE notes = 'demo-seed';
```

**Step 2: Commit**

```bash
git add supabase/seed-demo.sql
git commit -m "feat(seed): add demo event and needs data for KapwaRelief coordination demo"
```

---

## Task 5: Add needs queries

New query functions to fetch needs for the map and dashboard.

**Files:**
- Modify: `src/lib/queries.ts`

**Step 1: Write failing test for getNeedsMapPoints**

Create test in `tests/unit/queries.test.ts`. The existing test file mocks Supabase — follow the same pattern.

Add to the existing `tests/unit/queries.test.ts` describe block:

```typescript
describe("getNeedsMapPoints", () => {
  it("returns formatted need points from Supabase", async () => {
    const { getNeedsMapPoints } = await import("@/lib/queries");
    const mockData = [
      {
        id: "abc",
        lat: 16.67,
        lng: 120.32,
        status: "verified",
        gap_category: "sustenance",
        access_status: "truck",
        urgency: "high",
        quantity_needed: 80,
        notes: "Food needed",
        contact_name: "Test",
        barangays: { name: "Urbiztondo", municipality: "San Juan" },
        aid_categories: { name: "Sustenance" },
      },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await getNeedsMapPoints();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "abc",
      lat: 16.67,
      lng: 120.32,
      status: "verified",
      gapCategory: "sustenance",
      accessStatus: "truck",
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/queries.test.ts
```

Expected: FAIL — `getNeedsMapPoints` is not exported.

**Step 3: Implement getNeedsMapPoints in queries.ts**

Add to `src/lib/queries.ts`:

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
  categoryName: string;
};

export async function getNeedsMapPoints(): Promise<NeedPoint[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, lat, lng, status, gap_category, access_status, urgency, quantity_needed, notes, contact_name, barangays(name, municipality), aid_categories(name)"
    )
    .in("status", ["verified", "in_transit", "completed"])
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) throw error;
  return data.map((row) => {
    const brgy = row.barangays as unknown as { name: string; municipality: string };
    const cat = row.aid_categories as unknown as { name: string };
    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      status: row.status,
      gapCategory: row.gap_category,
      accessStatus: row.access_status,
      urgency: row.urgency,
      quantityNeeded: row.quantity_needed,
      notes: row.notes,
      contactName: row.contact_name,
      barangayName: brgy?.name ?? "Unknown",
      municipality: brgy?.municipality ?? "",
      categoryName: cat?.name ?? "Unknown",
    };
  });
}
```

**Step 4: Add getNeedsSummary query**

```typescript
export async function getNeedsSummary() {
  const { data, error } = await supabase
    .from("submissions")
    .select("status, gap_category, access_status, urgency")
    .in("type", ["need", "request"]);

  if (error) throw error;

  const summary = {
    total: data.length,
    byStatus: { pending: 0, verified: 0, in_transit: 0, completed: 0 },
    byGap: { lunas: 0, sustenance: 0, shelter: 0 },
    byAccess: { truck: 0, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
    critical: 0,
  };

  for (const row of data) {
    const s = row.status as keyof typeof summary.byStatus;
    if (s in summary.byStatus) summary.byStatus[s]++;

    const g = row.gap_category as keyof typeof summary.byGap | null;
    if (g && g in summary.byGap) summary.byGap[g]++;

    const a = row.access_status as keyof typeof summary.byAccess | null;
    if (a && a in summary.byAccess) summary.byAccess[a]++;

    if (row.urgency === "critical") summary.critical++;
  }

  return summary;
}
```

**Step 5: Add getActiveEvent query**

```typescript
export async function getActiveEvent() {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, slug, description, region, started_at")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}
```

**Step 6: Update SubmissionInsert type**

Update the existing `SubmissionInsert` interface:

```typescript
export interface SubmissionInsert {
  id?: string;
  event_id?: string | null;
  type: "need" | "request" | "feedback";
  contact_name: string;
  contact_phone: string | null;
  barangay_id: string;
  aid_category_id: string;
  gap_category?: string | null;
  access_status?: string | null;
  notes: string | null;
  quantity_needed: number | null;
  urgency: string | null;
  rating: number | null;
  issue_type: string | null;
  photo_url?: string | null;
}
```

**Step 7: Run tests**

```bash
npm test -- tests/unit/queries.test.ts
```

Expected: all tests pass (existing + new).

**Step 8: Commit**

```bash
git add src/lib/queries.ts tests/unit/queries.test.ts
git commit -m "feat(queries): add needs map points, summary, and active event queries"
```

---

## Task 6: Update DashboardData cache type and fetch logic

Add needs data to the dashboard's cache and fetch pipeline.

**Files:**
- Modify: `src/lib/cache.ts`
- Modify: `src/pages/DashboardPage.tsx`

**Step 1: Update DashboardData type in cache.ts**

Add needs-related fields to the `DashboardData` type:

```typescript
export type DashboardData = {
  // Existing fields
  totalDonations: number;
  totalBeneficiaries: number;
  volunteerCount: number;
  donationsByOrg: { name: string; amount: number }[];
  deploymentHubs: { name: string; municipality: string; count: number }[];
  goodsByCategory: { name: string; icon: string | null; total: number }[];
  barangays: { name: string; municipality: string; beneficiaries: number }[];
  deploymentPoints: {
    lat: number;
    lng: number;
    quantity: number | null;
    unit: string | null;
    orgName: string;
    categoryName: string;
  }[];
  // New: needs coordination
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
    categoryName: string;
  }[];
  needsSummary: {
    total: number;
    byStatus: { pending: number; verified: number; in_transit: number; completed: number };
    byGap: { lunas: number; sustenance: number; shelter: number };
    byAccess: { truck: number; "4x4": number; boat: number; foot_only: number; cut_off: number };
    critical: number;
  };
};
```

**Step 2: Update DashboardPage.tsx fetch**

Import the new queries:

```typescript
import {
  getTotalDonations,
  getTotalBeneficiaries,
  getVolunteerCount,
  getDonationsByOrganization,
  getDeploymentHubs,
  getGoodsByCategory,
  getBeneficiariesByBarangay,
  getDeploymentMapPoints,
  getNeedsMapPoints,
  getNeedsSummary,
  getActiveEvent,
} from "@/lib/queries";
```

Update the `Promise.all` in `fetchData` to include the new queries:

```typescript
const [
  totalDonations,
  totalBeneficiaries,
  volunteerCount,
  donationsByOrg,
  deploymentHubs,
  goodsByCategory,
  barangays,
  deploymentPoints,
  needsPoints,
  needsSummary,
  activeEvent,
] = await Promise.all([
  getTotalDonations(),
  getTotalBeneficiaries(),
  getVolunteerCount(),
  getDonationsByOrganization(),
  getDeploymentHubs(),
  getGoodsByCategory(),
  getBeneficiariesByBarangay(),
  getDeploymentMapPoints(),
  getNeedsMapPoints(),
  getNeedsSummary(),
  getActiveEvent(),
]);
```

Add the new fields to `freshData`:

```typescript
const freshData: DashboardData = {
  totalDonations,
  totalBeneficiaries,
  volunteerCount,
  donationsByOrg,
  deploymentHubs,
  goodsByCategory,
  barangays,
  deploymentPoints,
  needsPoints,
  needsSummary,
  activeEvent,
};
```

**Step 3: Run existing tests to make sure nothing is broken**

```bash
npm test
```

Fix any type errors that arise from the expanded DashboardData type (test mocks may need the new fields added as empty defaults).

**Step 4: Commit**

```bash
git add src/lib/cache.ts src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): fetch needs data alongside existing deployment data"
```

---

## Task 7: Build NeedsMap component

The centerpiece — a map showing needs pins colored by status, replacing (or augmenting) the deployment-only map.

**Files:**
- Create: `src/components/maps/NeedsMap.tsx`
- Create: `tests/unit/NeedsMap.test.tsx`

**Step 1: Write failing test**

Create `tests/unit/NeedsMap.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
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
    categoryName: "Sustenance",
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
    categoryName: "Lunas",
  },
];

describe("NeedsMap", () => {
  it("renders markers for each need point", async () => {
    const { default: NeedsMap } = await import(
      "@/components/maps/NeedsMap"
    );
    render(<NeedsMap points={mockPoints} />);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("shows access status and urgency in popups", async () => {
    const { default: NeedsMap } = await import(
      "@/components/maps/NeedsMap"
    );
    render(<NeedsMap points={mockPoints} />);
    expect(screen.getByText("Food needed")).toBeInTheDocument();
    expect(screen.getByText("Medical supplies")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/NeedsMap.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement NeedsMap component**

Create `src/components/maps/NeedsMap.tsx`:

```typescript
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { NeedPoint } from "@/lib/queries";

// Pin colors by status — the core visual language of the scope
const STATUS_COLORS: Record<string, string> = {
  verified: "var(--color-error)",      // Red: urgent, needs response
  in_transit: "var(--color-warning)",  // Amber: help is coming
  completed: "var(--color-success)",   // Green: fulfilled
};

function makeIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "var(--color-neutral-400)";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid var(--color-neutral-50);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const ACCESS_LABELS: Record<string, string> = {
  truck: "Truck",
  "4x4": "4x4 Vehicle",
  boat: "Boat Only",
  foot_only: "Foot Only",
  cut_off: "Cut Off",
};

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type Props = {
  points: NeedPoint[];
};

export default function NeedsMap({ points }: Props) {
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
          >
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-semibold">{point.barangayName}, {point.municipality}</p>
                <p>{point.categoryName} — {point.urgency ?? "unset"} urgency</p>
                {point.accessStatus && (
                  <p className="text-xs">
                    Access: <strong>{ACCESS_LABELS[point.accessStatus] ?? point.accessStatus}</strong>
                  </p>
                )}
                {point.quantityNeeded && (
                  <p className="text-xs">{point.quantityNeeded} families</p>
                )}
                {point.notes && <p className="text-xs italic">{point.notes}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tilesUnavailable && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center bg-base/80"
        >
          <p className="text-neutral-400 text-sm">
            {t("Dashboard.mapTilesUnavailable")}
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/NeedsMap.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/maps/NeedsMap.tsx tests/unit/NeedsMap.test.tsx
git commit -m "feat(map): add NeedsMap component with status-colored pins"
```

---

## Task 8: Build NeedsSummaryCards component

Replace (or augment) the donation-centric summary cards with needs-centric metrics.

**Files:**
- Create: `src/components/NeedsSummaryCards.tsx`
- Create: `tests/unit/NeedsSummaryCards.test.tsx`

**Step 1: Write failing test**

Create `tests/unit/NeedsSummaryCards.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSummary = {
  total: 10,
  byStatus: { pending: 2, verified: 4, in_transit: 2, completed: 2 },
  byGap: { lunas: 3, sustenance: 5, shelter: 2 },
  byAccess: { truck: 4, "4x4": 2, boat: 2, foot_only: 1, cut_off: 1 },
  critical: 3,
};

describe("NeedsSummaryCards", () => {
  it("renders need counts", async () => {
    const { default: NeedsSummaryCards } = await import(
      "@/components/NeedsSummaryCards"
    );
    render(<NeedsSummaryCards summary={mockSummary} />);
    expect(screen.getByText("4")).toBeInTheDocument(); // verified
    expect(screen.getByText("3")).toBeInTheDocument(); // critical
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/NeedsSummaryCards.test.tsx
```

**Step 3: Implement component**

Create `src/components/NeedsSummaryCards.tsx`:

```typescript
import { useTranslation } from "react-i18next";

type NeedsSummary = {
  total: number;
  byStatus: { pending: number; verified: number; in_transit: number; completed: number };
  byGap: { lunas: number; sustenance: number; shelter: number };
  byAccess: { truck: number; "4x4": number; boat: number; foot_only: number; cut_off: number };
  critical: number;
};

type Props = {
  summary: NeedsSummary;
};

export default function NeedsSummaryCards({ summary }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Active Needs */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.activeNeeds")}
        </p>
        <p className="mt-2 text-3xl font-bold text-error">
          {summary.byStatus.verified}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.awaitingResponse")}
        </p>
      </div>

      {/* In Transit */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.inTransit")}
        </p>
        <p className="mt-2 text-3xl font-bold text-warning">
          {summary.byStatus.in_transit}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.helpOnTheWay")}
        </p>
      </div>

      {/* Fulfilled */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.fulfilled")}
        </p>
        <p className="mt-2 text-3xl font-bold text-success">
          {summary.byStatus.completed}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.needsMet")}
        </p>
      </div>

      {/* Critical */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.criticalNeeds")}
        </p>
        <p className="mt-2 text-3xl font-bold text-error">
          {summary.critical}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.immediateAttention")}
        </p>
      </div>
    </div>
  );
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/NeedsSummaryCards.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/NeedsSummaryCards.tsx tests/unit/NeedsSummaryCards.test.tsx
git commit -m "feat(ui): add NeedsSummaryCards showing active/transit/fulfilled/critical counts"
```

---

## Task 9: Build NeedsCoordinationMap wrapper

Replaces `AidDistributionMap` as the primary map section. Shows the NeedsMap with a status legend and access filter sidebar.

**Files:**
- Create: `src/components/NeedsCoordinationMap.tsx`
- Create: `tests/unit/NeedsCoordinationMap.test.tsx`

**Step 1: Write failing test**

Create `tests/unit/NeedsCoordinationMap.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/maps/NeedsMap", () => ({
  default: () => <div data-testid="needs-map" />,
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
    contactName: "Maria",
    barangayName: "Urbiztondo",
    municipality: "San Juan",
    categoryName: "Sustenance",
  },
  {
    id: "2",
    lat: 16.73,
    lng: 120.35,
    status: "verified",
    gapCategory: "lunas",
    accessStatus: "boat",
    urgency: "critical",
    quantityNeeded: 50,
    notes: "Medical",
    contactName: "Jose",
    barangayName: "Bacnotan",
    municipality: "Bacnotan",
    categoryName: "Lunas",
  },
];

describe("NeedsCoordinationMap", () => {
  it("renders the map and legend", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    expect(screen.getByTestId("needs-map")).toBeInTheDocument();
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/NeedsCoordinationMap.test.tsx
```

**Step 3: Implement component**

Create `src/components/NeedsCoordinationMap.tsx`:

```typescript
import { Suspense, lazy, useState } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";
import type { NeedPoint } from "@/lib/queries";

const NeedsMap = lazy(() => import("@/components/maps/NeedsMap"));

type Props = {
  needsPoints: NeedPoint[];
};

const ACCESS_FILTERS = [
  { value: "all", label: "Dashboard.allAccess" },
  { value: "truck", label: "Dashboard.accessTruck" },
  { value: "4x4", label: "Dashboard.access4x4" },
  { value: "boat", label: "Dashboard.accessBoat" },
  { value: "foot_only", label: "Dashboard.accessFootOnly" },
  { value: "cut_off", label: "Dashboard.accessCutOff" },
] as const;

export default function NeedsCoordinationMap({ needsPoints }: Props) {
  const { t } = useTranslation();
  const [accessFilter, setAccessFilter] = useState("all");

  const filtered =
    accessFilter === "all"
      ? needsPoints
      : needsPoints.filter((p) => p.accessStatus === accessFilter);

  return (
    <div className="rounded-xl border border-neutral-400/20 bg-secondary p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-50">
          {t("Dashboard.needsMap")}
        </h3>
        <span className="rounded-full bg-error/20 px-3 py-1 text-xs font-medium text-error">
          {t("Dashboard.liveNeeds")}
        </span>
      </div>

      {/* Access filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ACCESS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setAccessFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              accessFilter === f.value
                ? "bg-primary text-white"
                : "bg-base text-neutral-400 hover:text-neutral-50"
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map (2/3 width) */}
        <div className="lg:col-span-2">
          {filtered.length > 0 ? (
            <Suspense fallback={<MapSkeleton />}>
              <NeedsMap points={filtered} />
            </Suspense>
          ) : (
            <div className="flex h-[28rem] items-center justify-center rounded-lg bg-base/30">
              <p className="text-sm text-neutral-400/60">
                {t("Dashboard.noNeedsData")}
              </p>
            </div>
          )}
        </div>

        {/* Legend + summary sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Status legend */}
          <div className="rounded-lg bg-base/30 p-4">
            <h4 className="mb-3 text-sm font-medium text-neutral-50">
              {t("Dashboard.pinStatus")}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-error" />
                <span className="text-xs text-neutral-400">{t("Dashboard.statusVerified")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-warning" />
                <span className="text-xs text-neutral-400">{t("Dashboard.statusInTransit")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-success" />
                <span className="text-xs text-neutral-400">{t("Dashboard.statusCompleted")}</span>
              </div>
            </div>
          </div>

          {/* Needs list */}
          <div className="divide-y divide-neutral-400/20 overflow-y-auto lg:max-h-[20rem]">
            {filtered.map((need) => (
              <div
                key={need.id}
                className="flex items-start justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      need.status === "verified"
                        ? "bg-error"
                        : need.status === "in_transit"
                          ? "bg-warning"
                          : "bg-success"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-neutral-50">
                      {need.barangayName}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {need.categoryName}
                      {need.accessStatus && ` · ${need.accessStatus.replace("_", " ")}`}
                    </p>
                  </div>
                </div>
                {need.urgency === "critical" && (
                  <span className="rounded bg-error/20 px-2 py-0.5 text-xs font-medium text-error">
                    {t("Dashboard.critical")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/NeedsCoordinationMap.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/NeedsCoordinationMap.tsx tests/unit/NeedsCoordinationMap.test.tsx
git commit -m "feat(ui): add NeedsCoordinationMap with access filter and status legend"
```

---

## Task 10: Reorient the Dashboard page

Wire the new needs-centric components into the dashboard, making needs the primary view with deployments as secondary context.

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

**Step 1: Import new components and restructure the layout**

Add imports:

```typescript
import NeedsSummaryCards from "@/components/NeedsSummaryCards";
import NeedsCoordinationMap from "@/components/NeedsCoordinationMap";
```

Replace the `return` JSX (the `<main>` contents) with this reoriented layout:

```tsx
<main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
  {/* Event header */}
  <div className="text-center">
    <h1 className="text-2xl font-bold text-neutral-50">
      {data.activeEvent?.name ?? t("Dashboard.hero")}
    </h1>
    <p className="mt-1 text-sm text-neutral-400">
      {data.activeEvent?.description ?? t("Dashboard.subtitle")}
    </p>
    <p className="mt-2 text-sm text-neutral-400">
      {updatedAt
        ? `${t("Dashboard.lastUpdated")}: ${updatedAt.toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}`
        : ""}
      {isOffline && (
        <span className="ml-2 text-warning">{"\u00b7"} {t("Dashboard.offline")}</span>
      )}
    </p>
  </div>

  {/* Primary: Needs summary */}
  <NeedsSummaryCards summary={data.needsSummary} />

  {/* Primary: Needs coordination map */}
  <NeedsCoordinationMap needsPoints={data.needsPoints} />

  {/* Secondary: Relief operations context */}
  <div className="border-t border-neutral-400/10 pt-6">
    <h2 className="mb-4 text-lg font-semibold text-neutral-400">
      {t("Dashboard.reliefOperations")}
    </h2>
    <SummaryCards
      totalDonations={data.totalDonations}
      totalBeneficiaries={data.totalBeneficiaries}
      volunteerCount={data.volunteerCount}
      orgCount={data.donationsByOrg.length}
      locationCount={data.barangays.length}
      deploymentCount={totalDeployments}
    />
  </div>
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <DonationsByOrg donations={data.donationsByOrg} />
    <DeploymentHubs hubs={data.deploymentHubs} />
    <GoodsByCategory categories={data.goodsByCategory} />
  </div>
  <AidDistributionMap
    barangays={data.barangays}
    deploymentPoints={data.deploymentPoints}
  />
</main>
```

**Step 2: Run tests and lint**

```bash
npm test && npm run lint
```

Fix any issues.

**Step 3: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): reorient layout — needs-first with deployments as secondary context"
```

---

## Task 11: Add new i18n keys

Add translation keys for all new UI strings.

**Files:**
- Modify: `public/locales/en/translation.json`
- Run: `npm run translate` (to generate fil/ilo translations)

**Step 1: Add new Dashboard keys to English translation**

Add these keys to the `"Dashboard"` section:

```json
"activeNeeds": "Active Needs",
"awaitingResponse": "awaiting response",
"inTransit": "In Transit",
"helpOnTheWay": "help on the way",
"fulfilled": "Fulfilled",
"needsMet": "needs met",
"criticalNeeds": "Critical",
"immediateAttention": "immediate attention",
"needsMap": "Needs Coordination Map",
"liveNeeds": "Live Needs",
"noNeedsData": "No needs reported yet",
"pinStatus": "Pin Status",
"statusVerified": "Verified — needs response",
"statusInTransit": "In transit — help coming",
"statusCompleted": "Completed — aid delivered",
"critical": "Critical",
"reliefOperations": "Relief Operations",
"allAccess": "All",
"accessTruck": "Truck",
"access4x4": "4x4",
"accessBoat": "Boat Only",
"accessFootOnly": "Foot Only",
"accessCutOff": "Cut Off"
```

**Step 2: Run translate script**

```bash
npm run translate
```

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat(i18n): add needs coordination translation keys for en/fil/ilo"
```

---

## Task 12: Update SubmitForm with "need" type and new fields

Expand the submit form to support the `need` submission type with access status and gap category.

**Files:**
- Modify: `src/components/SubmitForm.tsx`

**Step 1: Add "need" as a third type option**

Change the `SubmissionType` type:

```typescript
type SubmissionType = "need" | "request" | "feedback";
```

Add a third button to the type toggle (between request and feedback):

```tsx
<button
  type="button"
  onClick={() => setType("need")}
  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
    type === "need"
      ? "bg-primary text-white"
      : "bg-base text-neutral-400"
  }`}
>
  {t("SubmitForm.typeNeed")}
</button>
```

**Step 2: Add need-specific fields (shown when type === "need")**

After the aid category select and before the request-only fields section, add:

```tsx
{/* Need-specific fields */}
{type === "need" && (
  <>
    {/* Gap category */}
    <fieldset>
      <legend className="text-sm text-neutral-400">
        {t("SubmitForm.gapCategory")}
      </legend>
      <div className="mt-2 flex gap-2">
        {(["lunas", "sustenance", "shelter"] as const).map((gap) => (
          <label key={gap} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="gap_category"
              value={gap}
              className="peer sr-only"
            />
            <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
              {t(`SubmitForm.gap_${gap}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>

    {/* Access status */}
    <div>
      <label htmlFor="access_status" className="block text-sm text-neutral-400">
        {t("SubmitForm.accessStatus")}
      </label>
      <select
        id="access_status"
        name="access_status"
        className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">{t("SubmitForm.accessPlaceholder")}</option>
        <option value="truck">{t("SubmitForm.accessTruck")}</option>
        <option value="4x4">{t("SubmitForm.access4x4")}</option>
        <option value="boat">{t("SubmitForm.accessBoat")}</option>
        <option value="foot_only">{t("SubmitForm.accessFootOnly")}</option>
        <option value="cut_off">{t("SubmitForm.accessCutOff")}</option>
      </select>
    </div>

    {/* Urgency + quantity (reuse from request) */}
    <fieldset>
      <legend className="text-sm text-neutral-400">
        {t("SubmitForm.urgencyLabel")}
      </legend>
      <div className="mt-2 flex gap-2">
        {(["low", "medium", "high", "critical"] as const).map((level) => (
          <label key={level} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="urgency"
              value={level}
              className="peer sr-only"
            />
            <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
              {t(`SubmitForm.urgency${level.charAt(0).toUpperCase() + level.slice(1)}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>

    <div>
      <label htmlFor="quantity_needed" className="block text-sm text-neutral-400">
        {t("SubmitForm.quantityNeeded")}
      </label>
      <input
        id="quantity_needed"
        name="quantity_needed"
        type="number"
        min="1"
        className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={t("SubmitForm.quantityPlaceholder")}
      />
    </div>
  </>
)}
```

**Step 3: Update handleSubmit payload construction**

Update the payload construction to include the new fields:

```typescript
const payload: SubmissionInsert = {
  id,
  type,
  contact_name: formData.get("contact_name") as string,
  contact_phone: (formData.get("contact_phone") as string) || null,
  barangay_id: formData.get("barangay_id") as string,
  aid_category_id: formData.get("aid_category_id") as string,
  gap_category:
    type === "need"
      ? (formData.get("gap_category") as string) || null
      : null,
  access_status:
    type === "need"
      ? (formData.get("access_status") as string) || null
      : null,
  notes: (formData.get("notes") as string) || null,
  quantity_needed:
    (type === "need" || type === "request") && formData.get("quantity_needed")
      ? Number(formData.get("quantity_needed"))
      : null,
  urgency:
    type === "need" || type === "request"
      ? (formData.get("urgency") as string) || null
      : null,
  rating:
    type === "feedback" && formData.get("rating")
      ? Number(formData.get("rating"))
      : null,
  issue_type:
    type === "feedback"
      ? (formData.get("issue_type") as string) || null
      : null,
};
```

**Step 4: Add new i18n keys to English translation**

Add to the `"SubmitForm"` section:

```json
"typeNeed": "Report Need",
"gapCategory": "Type of Need",
"gap_lunas": "Medical (Lunas)",
"gap_sustenance": "Food & Water",
"gap_shelter": "Shelter",
"accessStatus": "Road Access",
"accessPlaceholder": "How can this area be reached?",
"accessTruck": "Truck accessible",
"access4x4": "4x4 vehicle only",
"accessBoat": "Boat only",
"accessFootOnly": "Foot traffic only",
"accessCutOff": "Completely cut off"
```

**Step 5: Run translate, then tests**

```bash
npm run translate && npm test
```

Fix any breaking tests (SubmitForm tests may need updates for the new type option).

**Step 6: Commit**

```bash
git add src/components/SubmitForm.tsx public/locales/
git commit -m "feat(form): add 'need' submission type with gap category and access status"
```

---

## Task 13: Update existing tests for expanded types

Some existing unit tests will break due to the expanded DashboardData type and SubmitForm changes. Fix them.

**Files:**
- Modify: `tests/unit/DashboardPage.test.tsx`
- Modify: `tests/unit/SubmitForm.test.tsx`

**Step 1: Update DashboardPage test mock data**

In `tests/unit/DashboardPage.test.tsx`, wherever `DashboardData` is mocked, add the new fields:

```typescript
activeEvent: {
  id: "evt-1",
  name: "Typhoon Emong Relief",
  slug: "typhoon-emong-2024",
  description: "Test event",
  region: "La Union",
  started_at: "2024-11-10",
},
needsPoints: [],
needsSummary: {
  total: 0,
  byStatus: { pending: 0, verified: 0, in_transit: 0, completed: 0 },
  byGap: { lunas: 0, sustenance: 0, shelter: 0 },
  byAccess: { truck: 0, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
  critical: 0,
},
```

**Step 2: Update SubmitForm tests**

In `tests/unit/SubmitForm.test.tsx`, update tests that check the type toggle to account for the third "Report Need" button. Verify that the default type is still "request" (or update to "need" if we change the default).

**Step 3: Run all tests**

```bash
npm test
```

**Step 4: Commit**

```bash
git add tests/unit/
git commit -m "test: update dashboard and form tests for expanded needs data model"
```

---

## Task 14: Update documentation

Update architecture docs to reflect the new data model and coordination focus.

**Files:**
- Modify: `docs/architecture.md`
- Modify: `CLAUDE.md` (project structure section if needed)

**Step 1: Update architecture.md**

Update the schema section to document:
- The `events` table
- The expanded `submissions` table (needs + lifecycle)
- The `event_id` and `submission_id` on deployments
- The new query functions

Update the "What's Built" section to reflect the needs coordination features.

**Step 2: Update CLAUDE.md project structure**

Add `NeedsMap.tsx`, `NeedsSummaryCards.tsx`, `NeedsCoordinationMap.tsx` to the components listing.

**Step 3: Commit**

```bash
git add docs/architecture.md CLAUDE.md
git commit -m "docs: update architecture and project structure for needs coordination model"
```

---

## Task 15: Run full verification

**Step 1: Run all tests**

```bash
npm test
```

**Step 2: Run lint**

```bash
npm run lint
```

**Step 3: Run build**

```bash
npm run build
```

**Step 4: Run Playwright smoke tests**

```bash
npm run verify
```

**Step 5: Fix any failures, commit fixes**

**Step 6: Final commit if needed**

```bash
git add -A
git commit -m "fix: resolve verification issues from needs coordination refactor"
```

---

## Summary of Changes

| Area | Before | After |
|---|---|---|
| **Schema** | 6 tables, deployment-centric | 7 tables (+events), needs-centric with lifecycle |
| **Dashboard hero** | "Disaster Relief Transparency" | Active event name + description |
| **Summary cards** | Donations / Beneficiaries / Volunteers | Active Needs / In Transit / Fulfilled / Critical |
| **Primary map** | Deployment markers (red dots) | Needs pins (red/amber/green by status) with access filter |
| **Submit form** | Request / Feedback | Need / Request / Feedback with gap category + access status |
| **Secondary section** | N/A | Original donation/deployment cards moved below the fold |
| **Seed data** | Deployments only | Deployments + 10 demo needs across all statuses |
