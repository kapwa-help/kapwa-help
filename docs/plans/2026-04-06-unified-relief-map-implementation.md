# Unified Relief Map — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 4-page layout (Needs, Deployments, Relief Ops, Report) with a 3-page layout: a unified full-screen Relief Map with toggleable layers (needs, hubs, hazards), a Relief Transparency data page, and the Report page with a new hazard form.

**Architecture:** The Relief Map page fetches needs, hubs (orgs with lat/lng), and hazards, rendering them as separate Leaflet marker layers on a single map. A legend panel toggles layers. A detail panel slides in on marker tap, adapting its content to the marker type. The Relief Transparency page consolidates all non-map data (donations, purchases, inventory, barangay equity). The schema adds a `hazards` table and restores `lat`/`lng` on `organizations`.

**Tech Stack:** React 18, TypeScript strict, Leaflet/react-leaflet, Supabase (Postgres), Tailwind v4 semantic tokens, Vitest + Playwright, react-i18next

---

## Task 1: Schema — Add `hazards` table and restore org coordinates

**Files:**
- Modify: `supabase/schema.sql:18-24`
- Modify: `supabase/rls-policies.sql`
- Modify: `supabase/seed-demo.sql`

**Step 1: Add lat/lng to organizations in schema.sql**

In `supabase/schema.sql`, update the `organizations` table (lines 18-24) to add lat/lng columns:

```sql
-- Organizations: donors, deployment hubs, or both
CREATE TABLE IF NOT EXISTS organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  municipality text,
  lat          decimal(9,6),
  lng          decimal(9,6),
  created_at   timestamptz DEFAULT now()
);
```

**Step 2: Add hazards table to schema.sql**

Append after the `deployments` table (after line 118):

```sql
-- Hazards: field-reported hazard conditions
CREATE TABLE IF NOT EXISTS hazards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id),
  hazard_type text NOT NULL CHECK (hazard_type IN (
                'flood', 'landslide', 'road_blocked',
                'bridge_out', 'electrical_hazard', 'other'
              )),
  description text,
  photo_url   text,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  reported_by text,
  created_at  timestamptz DEFAULT now()
);
```

**Step 3: Add RLS policies for hazards**

Append to `supabase/rls-policies.sql`:

```sql
-- Hazards
ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_hazards" ON hazards
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_hazards" ON hazards
  FOR INSERT WITH CHECK (true);
```

**Step 4: Add seed data for orgs with coordinates and hazards**

In `supabase/seed-demo.sql`, update existing org inserts to include lat/lng for orgs that act as hubs. Add a few demo hazards. Use La Union coordinates.

Example org updates (add to the existing org INSERT block):
- DSWD La Union: lat=16.6159, lng=120.3209 (San Fernando)
- Philippine Red Cross: lat=16.6833, lng=120.3667 (near San Juan)
- KapwaRelief: lat=16.5500, lng=120.3833 (Bauang)

Example hazard seed data:
```sql
INSERT INTO hazards (event_id, hazard_type, description, latitude, longitude, status) VALUES
  ((SELECT id FROM events WHERE slug = 'typhoon-emong'), 'flood', 'Flooded road near barangay center, waist-deep', 16.63, 120.34, 'active'),
  ((SELECT id FROM events WHERE slug = 'typhoon-emong'), 'road_blocked', 'Fallen tree blocking main road to Bacnotan', 16.69, 120.35, 'active'),
  ((SELECT id FROM events WHERE slug = 'typhoon-emong'), 'electrical_hazard', 'Downed power lines near school', 16.61, 120.32, 'active')
ON CONFLICT DO NOTHING;
```

**Step 5: Commit**

```bash
git add supabase/schema.sql supabase/rls-policies.sql supabase/seed-demo.sql
git commit -m "feat: add hazards table, restore org lat/lng for hub markers"
```

---

## Task 2: Query layer — Hub and hazard queries

**Files:**
- Modify: `src/lib/queries.ts`
- Test: `tests/unit/lib/queries.test.ts`

**Step 1: Write failing tests for new query functions**

In `tests/unit/lib/queries.test.ts`, add tests for:

```typescript
describe("getDeploymentHubs", () => {
  it("returns organizations with lat/lng as hubs with inventory", async () => {
    // Mock supabase to return orgs with lat/lng and inventory data
    // Expect: array of { id, name, municipality, lat, lng, inventory: [...] }
  });
});

describe("getHazards", () => {
  it("returns active hazards for an event", async () => {
    // Mock supabase to return hazards
    // Expect: array of { id, hazardType, description, photoUrl, lat, lng, status, reportedBy, createdAt }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`
Expected: FAIL — functions not defined

**Step 3: Implement query functions**

Add to `src/lib/queries.ts`:

```typescript
// --- Hub queries ---

export type HubPoint = {
  id: string;
  name: string;
  municipality: string | null;
  lat: number;
  lng: number;
  inventory: { categoryName: string; categoryIcon: string | null; available: number }[];
};

export async function getDeploymentHubs(eventId: string): Promise<HubPoint[]> {
  // 1. Fetch orgs with lat/lng
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, municipality, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (orgError) throw orgError;
  if (!orgs?.length) return [];

  // 2. Fetch purchased quantities per org per category
  const { data: purchases, error: purchaseError } = await supabase
    .from("purchases")
    .select("organization_id, quantity, aid_categories(name, icon)")
    .eq("event_id", eventId);
  if (purchaseError) throw purchaseError;

  // 3. Fetch deployed quantities per org per category
  const { data: deployments, error: deployError } = await supabase
    .from("deployments")
    .select("organization_id, quantity, aid_categories(name, icon)")
    .eq("event_id", eventId)
    .eq("status", "received");
  if (deployError) throw deployError;

  // 4. Build per-org inventory (purchased - deployed)
  const orgInventory = new Map<string, Map<string, { name: string; icon: string | null; purchased: number; deployed: number }>>();

  for (const row of purchases ?? []) {
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    if (!cat) continue;
    if (!orgInventory.has(row.organization_id)) orgInventory.set(row.organization_id, new Map());
    const inv = orgInventory.get(row.organization_id)!;
    if (!inv.has(cat.name)) inv.set(cat.name, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    inv.get(cat.name)!.purchased += row.quantity ?? 0;
  }

  for (const row of deployments ?? []) {
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    if (!cat) continue;
    if (!orgInventory.has(row.organization_id)) orgInventory.set(row.organization_id, new Map());
    const inv = orgInventory.get(row.organization_id)!;
    if (!inv.has(cat.name)) inv.set(cat.name, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    inv.get(cat.name)!.deployed += row.quantity ?? 0;
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    municipality: org.municipality,
    lat: Number(org.lat),
    lng: Number(org.lng),
    inventory: Array.from(orgInventory.get(org.id)?.values() ?? []).map((item) => ({
      categoryName: item.name,
      categoryIcon: item.icon,
      available: item.purchased - item.deployed,
    })),
  }));
}

// --- Hazard queries ---

export type HazardPoint = {
  id: string;
  hazardType: string;
  description: string | null;
  photoUrl: string | null;
  lat: number;
  lng: number;
  status: string;
  reportedBy: string | null;
  createdAt: string;
};

export async function getHazards(eventId: string): Promise<HazardPoint[]> {
  const { data, error } = await supabase
    .from("hazards")
    .select("id, hazard_type, description, photo_url, latitude, longitude, status, reported_by, created_at")
    .eq("event_id", eventId)
    .eq("status", "active");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    hazardType: row.hazard_type,
    description: row.description,
    photoUrl: row.photo_url,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    status: row.status,
    reportedBy: row.reported_by,
    createdAt: row.created_at as string,
  }));
}

export interface HazardInsert {
  event_id?: string | null;
  hazard_type: string;
  description: string | null;
  photo_url?: string | null;
  latitude: number;
  longitude: number;
  reported_by: string | null;
}

export async function insertHazard(hazard: HazardInsert) {
  const { error } = await supabase.from("hazards").insert(hazard);
  if (error) throw error;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: add hub and hazard query functions"
```

---

## Task 3: Cache layer — Add relief map cache

**Files:**
- Modify: `src/lib/cache.ts`
- Test: `tests/unit/lib/cache.test.ts`

**Step 1: Write failing test**

Add test for new cache functions in `tests/unit/lib/cache.test.ts`:

```typescript
describe("relief map cache", () => {
  it("round-trips relief map data", async () => {
    const data = {
      needsPoints: [],
      hubs: [],
      hazards: [],
      activeEvent: null,
    };
    await setCachedReliefMap(data);
    const cached = await getCachedReliefMap();
    expect(cached?.data).toEqual(data);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 3: Implement cache changes**

In `src/lib/cache.ts`:

1. Bump `DB_VERSION` from 4 to 5
2. Add `RELIEF_MAP_KEY = "reliefMap"`
3. Replace `NeedsData` with `ReliefMapData` that includes all three layers:

```typescript
export type ReliefMapData = {
  activeEvent: { id: string; name: string; slug: string; description: string | null; region: string; started_at: string } | null;
  needsPoints: NeedsData["needsPoints"];
  hubs: {
    id: string;
    name: string;
    municipality: string | null;
    lat: number;
    lng: number;
    inventory: { categoryName: string; categoryIcon: string | null; available: number }[];
  }[];
  hazards: {
    id: string;
    hazardType: string;
    description: string | null;
    photoUrl: string | null;
    lat: number;
    lng: number;
    status: string;
    reportedBy: string | null;
    createdAt: string;
  }[];
};
```

4. Add `getCachedReliefMap()` / `setCachedReliefMap()` exports
5. Keep existing `NeedsData` type and needs cache for backward compat during migration (remove in cleanup)
6. Rename `OPERATIONS_KEY` to `TRANSPARENCY_KEY` = `"transparency"` and update corresponding type to `TransparencyData` (same shape as `OperationsData` plus barangay equity)

**Step 4: Run test to verify it passes**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/lib/cache.ts tests/unit/lib/cache.test.ts
git commit -m "feat: add relief map and transparency cache types"
```

---

## Task 4: i18n — Add translation keys

**Files:**
- Modify: `public/locales/en/translation.json`
- Then run: `npm run translate`

**Step 1: Add English keys**

Add/update these keys in `public/locales/en/translation.json`:

```json
{
  "Navigation": {
    "reliefMap": "Relief Map",
    "transparency": "Transparency"
  },
  "ReliefMap": {
    "activeNeeds": "Active Needs",
    "hubs": "Hubs",
    "hazards": "Hazards",
    "legend": "Legend",
    "layerNeeds": "Needs",
    "layerHubs": "Deployment Hubs",
    "layerHazards": "Hazards",
    "statusPending": "Pending",
    "statusVerified": "Verified",
    "statusInTransit": "In Transit",
    "statusCompleted": "Completed"
  },
  "HubDetail": {
    "inventory": "Available Inventory",
    "noInventory": "No inventory data",
    "municipality": "Municipality"
  },
  "HazardDetail": {
    "type": "Hazard Type",
    "description": "Description",
    "reportedBy": "Reported By",
    "reported": "Reported",
    "flood": "Flood",
    "landslide": "Landslide",
    "road_blocked": "Road Blocked",
    "bridge_out": "Bridge Out",
    "electrical_hazard": "Electrical Hazard",
    "other": "Other",
    "markResolved": "Mark Resolved"
  },
  "HazardForm": {
    "hazardType": "Hazard Type",
    "description": "Description",
    "descriptionPlaceholder": "Describe the hazard...",
    "photo": "Photo (optional)",
    "reportedBy": "Your Name (optional)",
    "reportedByPlaceholder": "Optional — for follow-up",
    "submit": "Report Hazard",
    "submitting": "Submitting...",
    "success": "Hazard reported successfully!",
    "error": "Failed to report hazard",
    "flood": "Flood",
    "landslide": "Landslide",
    "road_blocked": "Road Blocked",
    "bridge_out": "Bridge Out",
    "electrical_hazard": "Electrical Hazard",
    "other": "Other"
  },
  "Transparency": {
    "title": "Relief Transparency",
    "totalDonations": "Total Donations",
    "totalSpent": "Total Spent",
    "availableBalance": "Available Balance",
    "barangayEquity": "Barangay Aid Distribution",
    "barangay": "Barangay",
    "totalReceived": "Total Received",
    "categories": "Categories"
  },
  "ReportForm": {
    "reportHazard": "Report a Hazard"
  }
}
```

**Step 2: Run translate script**

```bash
npm run translate
```

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat: add i18n keys for relief map, hazards, transparency"
```

---

## Task 5: Unified ReliefMap component — NeedsMap enhancement

**Files:**
- Modify: `src/components/maps/NeedsMap.tsx` → rename to `src/components/maps/ReliefMapLeaflet.tsx`
- Test: `tests/unit/components/maps/NeedsMap.test.tsx` → rename

**Step 1: Copy and rename NeedsMap to ReliefMapLeaflet**

The new `ReliefMapLeaflet.tsx` extends `NeedsMap.tsx` to render three marker layers. It accepts:

```typescript
type Props = {
  needsPoints: NeedPoint[];
  hubs: HubPoint[];
  hazards: HazardPoint[];
  visibleLayers: { needs: boolean; hubs: boolean; hazards: boolean };
  onNeedSelect: (point: NeedPoint) => void;
  onHubSelect: (hub: HubPoint) => void;
  onHazardSelect: (hazard: HazardPoint) => void;
};
```

Key changes from NeedsMap:
- Zoom control position changes from `bottomleft` to `bottomright`
- Three marker groups, each conditionally rendered based on `visibleLayers`
- Hub markers use a distinct divIcon (blue box shape)
- Hazard markers use a warning triangle divIcon (orange/red)
- Need markers keep existing colored dots

Hub icon:
```typescript
function makeHubIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:var(--color-primary);border:2px solid var(--color-neutral-50);border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
      <span style="color:white;font-size:12px;font-weight:bold">H</span>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}
```

Hazard icon:
```typescript
function makeHazardIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:18px solid var(--color-warning);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))"></div>`,
    iconSize: [20, 18],
    iconAnchor: [10, 18],
  });
}
```

**Step 2: Update tests**

Rename test file and update imports. Add tests for rendering hub and hazard markers when visible.

**Step 3: Run tests**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/components/maps/ReliefMapLeaflet.tsx tests/unit/components/maps/
git commit -m "feat: create ReliefMapLeaflet with three marker layers"
```

---

## Task 6: MapLegend component

**Files:**
- Create: `src/components/MapLegend.tsx`
- Test: `tests/unit/components/MapLegend.test.tsx`

**Step 1: Write failing test**

```typescript
describe("MapLegend", () => {
  it("renders three layer toggles, all checked by default", () => {
    render(<MapLegend layers={defaultLayers} onToggle={vi.fn()} />);
    expect(screen.getByLabelText(/needs/i)).toBeChecked();
    expect(screen.getByLabelText(/hubs/i)).toBeChecked();
    expect(screen.getByLabelText(/hazards/i)).toBeChecked();
  });

  it("calls onToggle when a layer is unchecked", async () => {
    const onToggle = vi.fn();
    render(<MapLegend layers={defaultLayers} onToggle={onToggle} />);
    await userEvent.click(screen.getByLabelText(/needs/i));
    expect(onToggle).toHaveBeenCalledWith("needs");
  });

  it("shows needs status sub-legend", () => {
    render(<MapLegend layers={defaultLayers} onToggle={vi.fn()} />);
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 3: Implement MapLegend**

```typescript
// src/components/MapLegend.tsx
import { useTranslation } from "react-i18next";

export type LayerVisibility = {
  needs: boolean;
  hubs: boolean;
  hazards: boolean;
};

type Props = {
  layers: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility) => void;
};

const NEED_STATUSES = [
  { key: "pending", color: "bg-neutral-400" },
  { key: "verified", color: "bg-error" },
  { key: "inTransit", color: "bg-warning" },
  { key: "completed", color: "bg-success" },
] as const;

export default function MapLegend({ layers, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-neutral-400/20 bg-secondary/90 p-3 backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {t("ReliefMap.legend")}
      </p>

      {/* Needs toggle + sub-legend */}
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={layers.needs}
          onChange={() => onToggle("needs")}
          aria-label={t("ReliefMap.layerNeeds")}
          className="accent-primary"
        />
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerNeeds")}</span>
      </label>
      {layers.needs && (
        <div className="ml-6 space-y-0.5">
          {NEED_STATUSES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />
              <span className="text-xs text-neutral-400">
                {t(`ReliefMap.status${s.key.charAt(0).toUpperCase()}${s.key.slice(1)}`)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hubs toggle */}
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={layers.hubs}
          onChange={() => onToggle("hubs")}
          aria-label={t("ReliefMap.layerHubs")}
          className="accent-primary"
        />
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerHubs")}</span>
      </label>

      {/* Hazards toggle */}
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={layers.hazards}
          onChange={() => onToggle("hazards")}
          aria-label={t("ReliefMap.layerHazards")}
          className="accent-primary"
        />
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerHazards")}</span>
      </label>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/components/MapLegend.tsx tests/unit/components/MapLegend.test.tsx
git commit -m "feat: add MapLegend component with toggleable layers"
```

---

## Task 7: HubDetailPanel and HazardDetailPanel

**Files:**
- Create: `src/components/HubDetailPanel.tsx`
- Create: `src/components/HazardDetailPanel.tsx`
- Test: `tests/unit/components/HubDetailPanel.test.tsx`
- Test: `tests/unit/components/HazardDetailPanel.test.tsx`

**Step 1: Write failing tests**

For HubDetailPanel:
```typescript
it("renders hub name and inventory items", () => {
  render(<HubDetailPanel hub={mockHub} onClose={vi.fn()} />);
  expect(screen.getByText("DSWD La Union")).toBeInTheDocument();
  expect(screen.getByText("Hot Meals")).toBeInTheDocument();
});
```

For HazardDetailPanel:
```typescript
it("renders hazard type and description", () => {
  render(<HazardDetailPanel hazard={mockHazard} onClose={vi.fn()} />);
  expect(screen.getByText(/flood/i)).toBeInTheDocument();
  expect(screen.getByText("Flooded road near barangay center")).toBeInTheDocument();
});
```

**Step 2: Run tests — expect fail**

**Step 3: Implement both panels**

`HubDetailPanel.tsx` — shows: close button, hub name, municipality, inventory list (category icon + name + available count). Similar style to `PinDetailSheet` panel variant.

`HazardDetailPanel.tsx` — shows: close button, hazard type (translated), description, photo (if present), reported by, created time (relative), "Mark Resolved" button.

Both accept `variant?: "panel" | "sheet"` prop for desktop/mobile rendering (same pattern as `PinDetailSheet`).

**Step 4: Run tests — expect pass**

**Step 5: Commit**

```bash
git add src/components/HubDetailPanel.tsx src/components/HazardDetailPanel.tsx tests/unit/components/
git commit -m "feat: add hub and hazard detail panels"
```

---

## Task 8: ReliefMap coordination wrapper

**Files:**
- Create: `src/components/ReliefMap.tsx`
- Test: `tests/unit/components/ReliefMap.test.tsx`

This is the main component — replaces both `NeedsCoordinationMap` and `DeploymentsCoordinationMap`. It manages:
- Layer visibility state
- Selected marker state (need, hub, or hazard)
- Summary bar counts
- Legend panel
- Detail panel (desktop sidebar / mobile bottom sheet)

**Step 1: Write failing test**

```typescript
describe("ReliefMap", () => {
  it("renders summary bar with correct counts", () => {
    render(<ReliefMap needsPoints={mockNeeds} hubs={mockHubs} hazards={mockHazards} />);
    // Active = verified + in_transit
    expect(screen.getByText(/2 Active Needs/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Hubs/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Hazard/i)).toBeInTheDocument();
  });

  it("renders legend with all layers checked", () => {
    render(<ReliefMap needsPoints={[]} hubs={[]} hazards={[]} />);
    expect(screen.getByLabelText(/needs/i)).toBeChecked();
  });
});
```

**Step 2: Run test — expect fail**

**Step 3: Implement ReliefMap**

Key structure (adapting from `NeedsCoordinationMap` at `src/components/NeedsCoordinationMap.tsx`):

```typescript
export default function ReliefMap({ needsPoints, hubs, hazards }: Props) {
  const { t } = useTranslation();
  const [layers, setLayers] = useState<LayerVisibility>({ needs: true, hubs: true, hazards: true });
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<
    | { type: "need"; data: NeedPoint }
    | { type: "hub"; data: HubPoint }
    | { type: "hazard"; data: HazardPoint }
    | null
  >(null);

  // Apply status overrides to needs
  const allPoints = useMemo(() => /* same as NeedsCoordinationMap lines 61-67 */);

  // Summary counts
  const activeNeedsCount = allPoints.filter(p => p.status === "verified" || p.status === "in_transit").length;

  function toggleLayer(layer: keyof LayerVisibility) {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Map */}
      <Suspense fallback={<MapSkeleton />}>
        <ReliefMapLeaflet
          needsPoints={allPoints}
          hubs={hubs}
          hazards={hazards}
          visibleLayers={layers}
          onNeedSelect={(p) => setSelected({ type: "need", data: p })}
          onHubSelect={(h) => setSelected({ type: "hub", data: h })}
          onHazardSelect={(h) => setSelected({ type: "hazard", data: h })}
        />
      </Suspense>

      {/* Summary bar — top center */}
      <div className="absolute left-2 right-2 top-3 z-[500] flex items-center justify-center gap-1.5 lg:top-4 lg:gap-2">
        <div className="flex items-center gap-1 rounded-full bg-secondary/85 px-2 py-0.5 backdrop-blur-sm lg:px-3 lg:py-1">
          <span className="text-xs text-neutral-400 lg:text-sm">
            {activeNeedsCount} {t("ReliefMap.activeNeeds")} · {hubs.length} {t("ReliefMap.hubs")} · {hazards.length} {t("ReliefMap.hazards")}
          </span>
        </div>
      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-4 left-4 z-[500]">
        <MapLegend layers={layers} onToggle={toggleLayer} />
      </div>

      {/* Desktop detail panel — right side, only when selected */}
      {selected && (
        <div className="absolute bottom-4 right-4 top-4 z-[500] hidden w-[320px] flex-col overflow-hidden rounded-xl bg-secondary/90 backdrop-blur-sm lg:flex">
          <div className="flex-1 overflow-y-auto p-4">
            {selected.type === "need" && (
              <PinDetailSheet
                point={selected.data}
                onClose={() => setSelected(null)}
                onStatusChange={handleStatusChange}
                variant="panel"
              />
            )}
            {selected.type === "hub" && (
              <HubDetailPanel hub={selected.data} onClose={() => setSelected(null)} variant="panel" />
            )}
            {selected.type === "hazard" && (
              <HazardDetailPanel hazard={selected.data} onClose={() => setSelected(null)} variant="panel" />
            )}
          </div>
        </div>
      )}

      {/* Mobile: bottom sheet for selected item */}
      {selected && (
        <div className="lg:hidden">
          {selected.type === "need" && (
            <PinDetailSheet point={selected.data} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />
          )}
          {selected.type === "hub" && (
            <HubDetailPanel hub={selected.data} onClose={() => setSelected(null)} />
          )}
          {selected.type === "hazard" && (
            <HazardDetailPanel hazard={selected.data} onClose={() => setSelected(null)} />
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests — expect pass**

**Step 5: Commit**

```bash
git add src/components/ReliefMap.tsx tests/unit/components/ReliefMap.test.tsx
git commit -m "feat: add unified ReliefMap coordination component"
```

---

## Task 9: ReliefMapPage — new page component

**Files:**
- Create: `src/pages/ReliefMapPage.tsx` (based on `NeedsPage.tsx`)
- Test: `tests/unit/pages/ReliefMapPage.test.tsx`

**Step 1: Write failing test**

```typescript
it("renders header, relief map, and status footer", async () => {
  render(<ReliefMapPage />);
  expect(await screen.findByText("Kapwa Help")).toBeInTheDocument();
});
```

**Step 2: Implement ReliefMapPage**

Based on `NeedsPage.tsx` (lines 1-107), but fetches all three data sources:

```typescript
export function ReliefMapPage() {
  // Same cache-first pattern as NeedsPage
  // fetchData calls: getActiveEvent(), getNeedsMapPoints(), getDeploymentHubs(), getHazards()
  // Caches with setCachedReliefMap()
  // Renders: Header > ReliefMap > StatusFooter
}
```

**Step 3: Run test — expect pass**

**Step 4: Commit**

```bash
git add src/pages/ReliefMapPage.tsx tests/unit/pages/
git commit -m "feat: add ReliefMapPage with three-layer data fetching"
```

---

## Task 10: BarangayEquity component

**Files:**
- Create: `src/components/BarangayEquity.tsx`
- Test: `tests/unit/components/BarangayEquity.test.tsx`

**Step 1: Write failing test**

```typescript
it("renders a row per barangay with total received", () => {
  render(<BarangayEquity distribution={mockDistribution} />);
  expect(screen.getByText("San Fernando")).toBeInTheDocument();
  expect(screen.getByText("150")).toBeInTheDocument(); // total quantity
});
```

**Step 2: Implement BarangayEquity**

Table showing each barangay, categories received (as icons), and total quantity. Uses the existing `getBarangayDistribution()` data shape. Styled as a card with the standard design system pattern.

**Step 3: Run tests — expect pass**

**Step 4: Commit**

```bash
git add src/components/BarangayEquity.tsx tests/unit/components/BarangayEquity.test.tsx
git commit -m "feat: add BarangayEquity component for transparency page"
```

---

## Task 11: TransparencyPage — replace ReliefOperationsPage

**Files:**
- Create: `src/pages/TransparencyPage.tsx` (based on `ReliefOperationsPage.tsx`)
- Test: `tests/unit/pages/TransparencyPage.test.tsx`

**Step 1: Write failing test**

```typescript
it("renders summary cards, inventory, barangay equity, and two-column grid", async () => {
  render(<TransparencyPage />);
  expect(await screen.findByText(/Relief Transparency/i)).toBeInTheDocument();
});
```

**Step 2: Implement TransparencyPage**

Based on `ReliefOperationsPage.tsx` (lines 1-126). Changes:
- Title: "Relief Transparency"
- Adds `BarangayEquity` between `AvailableInventory` and the two-column grid
- Fetches `getBarangayDistribution()` in addition to existing data
- Uses `transparency` cache key

Layout order:
1. `OperationsSummaryCards`
2. `AvailableInventory`
3. `BarangayEquity`
4. Two-column: `DonationsByOrg` | `RecentPurchases`

**Step 3: Run tests — expect pass**

**Step 4: Commit**

```bash
git add src/pages/TransparencyPage.tsx tests/unit/pages/TransparencyPage.test.tsx
git commit -m "feat: add TransparencyPage with barangay equity"
```

---

## Task 12: HazardForm component

**Files:**
- Create: `src/components/HazardForm.tsx`
- Test: `tests/unit/components/HazardForm.test.tsx`

**Step 1: Write failing test**

```typescript
it("renders hazard type dropdown and description field", () => {
  render(<HazardForm />);
  expect(screen.getByLabelText(/hazard type/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
});
```

**Step 2: Implement HazardForm**

Follow the same pattern as `SubmitForm.tsx` for geolocation handling. Fields:
- Hazard type: dropdown with 6 options
- Description: textarea
- Photo: file input (stores filename, upload deferred)
- Location: geolocation button (reuse pattern from SubmitForm lines ~100-170)
- Reported by: text input, optional

On submit: calls `insertHazard()` from queries.

**Step 3: Run tests — expect pass**

**Step 4: Commit**

```bash
git add src/components/HazardForm.tsx tests/unit/components/HazardForm.test.tsx
git commit -m "feat: add HazardForm component"
```

---

## Task 13: Update Report page with hazard form

**Files:**
- Modify: `src/pages/ReportPage.tsx`

**Step 1: Add hazard option to form selector**

In `src/pages/ReportPage.tsx`:
- Add `"hazard"` to the formType union (line 10)
- Import `HazardForm`
- Add `<option value="hazard">{t("ReportForm.reportHazard")}</option>` (after line 31)
- Add `{formType === "hazard" && <HazardForm />}` (after line 38)

**Step 2: Run unit tests**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/pages/ReportPage.tsx
git commit -m "feat: add hazard form option to Report page"
```

---

## Task 14: Router and Header — wire up new pages

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `tests/unit/components/Header.test.tsx`

**Step 1: Update router**

Replace `src/router.tsx` contents:

```typescript
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ReliefMapPage } from "./pages/ReliefMapPage";
import { TransparencyPage } from "./pages/TransparencyPage";
import { ReportPage } from "./pages/ReportPage";

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
      { path: "transparency", element: <TransparencyPage /> },
      { path: "report", element: <ReportPage /> },
    ],
  },
]);
```

**Step 2: Update Header nav items**

In `src/components/Header.tsx` (lines 51-55), replace navItems:

```typescript
const navItems = [
  { to: `/${locale}`, label: t("Navigation.reliefMap"), end: true },
  { to: `/${locale}/transparency`, label: t("Navigation.transparency") },
];
```

**Step 3: Update Header test**

Update `tests/unit/components/Header.test.tsx` to expect "Relief Map" and "Transparency" nav links instead of "Needs", "Deployments", "Relief Ops".

**Step 4: Run all tests**

Run: `npm test -- --reporter verbose 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/router.tsx src/components/Header.tsx tests/unit/components/Header.test.tsx
git commit -m "feat: wire up Relief Map and Transparency routes"
```

---

## Task 15: Delete old components and pages

**Files:**
- Delete: `src/pages/NeedsPage.tsx`
- Delete: `src/pages/DeploymentsPage.tsx`
- Delete: `src/pages/ReliefOperationsPage.tsx`
- Delete: `src/components/NeedsCoordinationMap.tsx`
- Delete: `src/components/DeploymentsCoordinationMap.tsx`
- Delete: `src/components/maps/BarangayBubbleMap.tsx`
- Delete: `src/components/maps/NeedsMap.tsx` (replaced by ReliefMapLeaflet)
- Delete: `src/components/BarangayDetailPanel.tsx`
- Delete: associated test files

**Step 1: Delete files**

```bash
rm src/pages/NeedsPage.tsx src/pages/DeploymentsPage.tsx src/pages/ReliefOperationsPage.tsx
rm src/components/NeedsCoordinationMap.tsx src/components/DeploymentsCoordinationMap.tsx
rm src/components/maps/BarangayBubbleMap.tsx src/components/maps/NeedsMap.tsx
rm src/components/BarangayDetailPanel.tsx
rm tests/unit/pages/NeedsPage.test.tsx tests/unit/pages/ReliefPage.test.tsx
rm tests/unit/components/NeedsCoordinationMap.test.tsx
rm tests/unit/components/maps/BarangayBubbleMap.test.tsx tests/unit/components/maps/NeedsMap.test.tsx
rm tests/unit/components/BarangayDetailPanel.test.tsx
```

(Only delete files that exist — some test files may have already been removed in PR #79.)

**Step 2: Run all tests to verify nothing is broken**

Run: `npm test -- --reporter verbose 2>&1 | tail -30`

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old pages and components replaced by unified map"
```

---

## Task 16: Update smoke tests

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

**Step 1: Replace deployments and relief operations tests**

Update `tests/e2e/smoke.spec.ts`:
- Remove deployments page tests (lines 33-51)
- Remove relief operations page tests (lines 53-71)
- Add transparency page tests:
  ```typescript
  for (const locale of LOCALES) {
    test(`transparency page renders in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/transparency`);
      await expect(page.locator("text=Kapwa Help")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
      await page.screenshot({
        path: `tests/e2e/screenshots/transparency-${locale}.png`,
        fullPage: true,
      });
    });
  }
  ```
- Update nav link test (line 112) to click "Transparency" instead of "Deployments"
- Update mobile nav test (line 131) to navigate to "Transparency"
- Update needs page tests to check for Relief Map elements (legend, summary bar)
- Add hazard form test: select "Report a Hazard" in report page selector

**Step 2: Run smoke tests**

```bash
npm run verify
```

**Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test: update smoke tests for unified map and transparency page"
```

---

## Task 17: Update rules and documentation

**Files:**
- Modify: `.claude/rules/verification.md` — update routes table
- Modify: `.claude/rules/supabase.md` — add hazards table to schema section

**Step 1: Update verification.md routes table**

Replace the routes table with:
```
| Route | Page | Key Elements |
|-------|------|-------------|
| `/:locale` | Relief Map | Header, map with legend, summary bar, zoom controls |
| `/:locale/transparency` | Transparency | Header, `<h1>`, summary cards, inventory, barangay equity |
| `/:locale/report` | Report | Header, `<h1>`, form selector (need/donation/purchase/hazard) |
```

**Step 2: Update supabase.md schema section**

Add hazards table description. Note org lat/lng restoration.

**Step 3: Commit**

```bash
git add .claude/rules/
git commit -m "docs: update rules for new page structure and hazards table"
```

---

## Task 18: Full verification pass

**Step 1: Run unit tests**

```bash
npm test
```

Expected: All tests pass.

**Step 2: Run build**

```bash
npm run build
```

Expected: TypeScript compilation + Vite build succeeds.

**Step 3: Run smoke tests**

```bash
npm run verify
```

Expected: All smoke tests pass across all 3 locales.

**Step 4: Manual check with Playwright CLI**

```bash
npx playwright test --headed
```

Verify:
- Relief Map shows all three marker layers
- Legend toggles hide/show layers
- Summary bar shows correct counts
- Tapping a need pin opens detail panel
- Tapping a hub marker shows inventory
- Transparency page shows all sections
- Report page hazard form renders
- Mobile responsive layout works

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
