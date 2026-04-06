# Data Model & Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify aid categories across the app, split Relief page into Deployments + Relief Operations, add purchase tracking, and expand Submit into a multi-form Report page.

**Architecture:** Schema-first approach — update Supabase tables and seed data, then query layer, then UI. Each new page is a standalone component consuming queries through the existing cache-first pattern. The Report page uses a form selector dropdown to switch between three forms sharing the same page shell.

**Tech Stack:** Supabase (Postgres), React, TypeScript, Leaflet, Vitest + RTL, react-i18next

**Design doc:** `docs/plans/2026-04-06-data-model-page-redesign.md`

---

## Task 1: Schema — Update `schema.sql`

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Update submissions table**

Remove `type` column and CHECK constraint. Replace `gap_category text NOT NULL` with `aid_category_id uuid NOT NULL REFERENCES aid_categories(id)`. Add beneficiary count fields.

```sql
-- Remove these lines:
--   type            text NOT NULL CHECK (type IN ('need')),
--   gap_category    text NOT NULL,

-- Add these fields (after barangay_id):
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),

-- Add these fields (after urgency):
  num_adults      integer DEFAULT 0,
  num_children    integer DEFAULT 0,
  num_seniors_pwd integer DEFAULT 0,
```

**Step 2: Update deployments table**

Remove `recipient`, `volunteer_count`, `hours`, `lat`, `lng`.

```sql
-- Remove these lines:
--   recipient       text,
--   lat             decimal(9,6),
--   lng             decimal(9,6),
--   volunteer_count integer,
--   hours           decimal(5,1),
```

**Step 3: Update organizations table**

Remove `type` column/constraint and `lat`/`lng`.

```sql
-- Remove these lines:
--   type         text NOT NULL CHECK (type IN ('donor', 'hub', 'both')),
--   lat          decimal(9,6),
--   lng          decimal(9,6),
```

**Step 4: Add purchases table**

Add after the `donations` table definition:

```sql
-- Purchases: goods bought with donation money
CREATE TABLE IF NOT EXISTS purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  quantity        integer NOT NULL,
  unit            text,
  cost            decimal(12,2),
  date            date DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
```

**Step 5: Replace aid_categories seed data**

Replace the two existing INSERT blocks (lines 113-129) with:

```sql
-- Seed aid categories (Hannah's unified 9-category list)
INSERT INTO aid_categories (name, icon) VALUES
  ('Hot Meals', '🍲'),
  ('Drinking Water', '💧'),
  ('Water Filtration', '🚰'),
  ('Temporary Shelter', '🏕️'),
  ('Clothing', '👕'),
  ('Construction Materials', '🔨'),
  ('Medical Supplies', '🏥'),
  ('Hygiene Kits', '🧼'),
  ('Canned Food', '🥫')
ON CONFLICT (name) DO NOTHING;
```

**Step 6: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: update schema for unified categories, purchases, and column cleanup"
```

---

## Task 2: Schema — Update `rls-policies.sql`

**Files:**
- Modify: `supabase/rls-policies.sql`

**Step 1: Add purchases policies**

Append after the submissions policies:

```sql
-- Purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_purchases ON purchases FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_purchases ON purchases FOR INSERT TO anon WITH CHECK (true);
```

**Step 2: Commit**

```bash
git add supabase/rls-policies.sql
git commit -m "feat: add RLS policies for purchases table"
```

---

## Task 3: Schema — Update `seed-demo.sql`

**Files:**
- Modify: `supabase/seed-demo.sql`

This file is self-contained demo data. It needs a full rewrite to match the new schema:
- Remove `type` from organization inserts
- Remove `lat`/`lng` from organization inserts
- Update aid category variable names to match new 9 categories
- Update submissions to use `aid_category_id` FK instead of `gap_category` text
- Remove `type: 'need'` from submission inserts
- Add `num_adults`, `num_children`, `num_seniors_pwd` to submission inserts
- Remove `recipient`, `volunteer_count`, `hours`, `lat`, `lng` from deployment inserts
- Add sample `purchases` data

**Step 1: Rewrite the seed file**

The seed file uses a DO $$ block with declared variables. Key changes:

**Organization inserts** — remove type and lat/lng:
```sql
-- Before:
INSERT INTO organizations (name, type, municipality, lat, lng)
VALUES ('SJRRHASS', 'both', 'San Juan', 16.6815, 120.3218)
-- After:
INSERT INTO organizations (name, municipality)
VALUES ('SJRRHASS', 'San Juan')
```

**Aid category lookups** — update to new names:
```sql
-- Replace old lookups with:
SELECT id INTO v_hot_meals FROM aid_categories WHERE name = 'Hot Meals';
SELECT id INTO v_drinking_water FROM aid_categories WHERE name = 'Drinking Water';
SELECT id INTO v_water_filt FROM aid_categories WHERE name = 'Water Filtration';
SELECT id INTO v_temp_shelter FROM aid_categories WHERE name = 'Temporary Shelter';
SELECT id INTO v_clothing FROM aid_categories WHERE name = 'Clothing';
SELECT id INTO v_construction FROM aid_categories WHERE name = 'Construction Materials';
SELECT id INTO v_medical FROM aid_categories WHERE name = 'Medical Supplies';
SELECT id INTO v_hygiene FROM aid_categories WHERE name = 'Hygiene Kits';
SELECT id INTO v_canned_food FROM aid_categories WHERE name = 'Canned Food';
```

**Submission inserts** — replace type+gap_category with aid_category_id, add beneficiary counts:
```sql
-- Before:
INSERT INTO submissions (id, event_id, type, status, contact_name, barangay_id, gap_category, ...)
VALUES (v_sub_id, v_event, 'need', 'pending', 'Vol. Name', v_brgy, 'sustenance', ...)
-- After:
INSERT INTO submissions (id, event_id, status, contact_name, barangay_id, aid_category_id, ..., num_adults, num_children, num_seniors_pwd)
VALUES (v_sub_id, v_event, 'pending', 'Vol. Name', v_brgy, v_hot_meals, ..., 15, 8, 2)
```

**Deployment inserts** — remove dropped columns:
```sql
-- Remove: recipient, volunteer_count, hours, lat, lng from all deployment inserts
```

**Add purchases section** after deployments:
```sql
-- §11: Purchases (goods bought with donations)
INSERT INTO purchases (event_id, organization_id, aid_category_id, quantity, unit, cost, date, notes)
VALUES
  (v_event, v_sjrrhass, v_hot_meals, 500, 'meals', 25000.00, '2024-12-08', 'demo-seed'),
  (v_event, v_feed_inc, v_drinking_water, 1000, 'bottles', 15000.00, '2024-12-09', 'demo-seed'),
  (v_event, v_econest, v_hygiene, 200, 'kits', 40000.00, '2024-12-10', 'demo-seed'),
  (v_event, v_starlight, v_medical, 150, 'packs', 75000.00, '2024-12-11', 'demo-seed'),
  (v_event, v_citizens, v_canned_food, 300, 'cases', 18000.00, '2024-12-12', 'demo-seed'),
  (v_event, v_emerging, v_construction, 100, 'bundles', 50000.00, '2024-12-13', 'demo-seed'),
  (v_event, v_curma, v_clothing, 400, 'sets', 32000.00, '2024-12-14', 'demo-seed'),
  (v_event, v_waves4water, v_water_filt, 50, 'units', 125000.00, '2024-12-15', 'demo-seed');
```

**Step 2: Commit**

```bash
git add supabase/seed-demo.sql
git commit -m "feat: update seed data for new schema — unified categories, purchases, beneficiary counts"
```

---

## Task 4: Query Layer — Update types and queries

**Files:**
- Modify: `src/lib/queries.ts`

**Step 1: Write failing tests for new query types**

**File:** `tests/unit/lib/queries.test.ts`

Add tests that reference the new type shapes (aid_category_id instead of gap_category on NeedPoint, no lat/lng on DeploymentInsert, new PurchaseInsert type). These will fail because the types don't exist yet.

**Step 2: Update `NeedPoint` type**

In `src/lib/queries.ts`, find the NeedPoint type and:
- Replace `gapCategory: string | null` with `aidCategoryId: string | null` and `aidCategoryName: string | null` and `aidCategoryIcon: string | null`
- Add `numAdults: number`, `numChildren: number`, `numSeniorsPwd: number`

```typescript
export type NeedPoint = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  aidCategoryId: string | null;
  aidCategoryName: string | null;
  aidCategoryIcon: string | null;
  accessStatus: string | null;
  urgency: string | null;
  quantityNeeded: number | null;
  numAdults: number;
  numChildren: number;
  numSeniorsPwd: number;
  notes: string | null;
  contactName: string;
  barangayName: string;
  municipality: string;
  createdAt: string;
};
```

**Step 3: Update `getNeedsMapPoints()` query**

Update the select to join aid_categories and map new fields:
```typescript
const { data } = await supabase
  .from("submissions")
  .select("id, lat, lng, status, aid_category_id, access_status, urgency, quantity_needed, num_adults, num_children, num_seniors_pwd, notes, contact_name, created_at, barangays(name, municipality), aid_categories(name, icon)")
  .eq("event_id", eventId)
  .neq("status", "resolved");
```

Map the result:
```typescript
return (data ?? []).map((row) => {
  const brgy = row.barangays as unknown as { name: string; municipality: string };
  const cat = row.aid_categories as unknown as { name: string; icon: string | null };
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    aidCategoryId: row.aid_category_id,
    aidCategoryName: cat?.name ?? null,
    aidCategoryIcon: cat?.icon ?? null,
    accessStatus: row.access_status,
    urgency: row.urgency,
    quantityNeeded: row.quantity_needed,
    numAdults: row.num_adults ?? 0,
    numChildren: row.num_children ?? 0,
    numSeniorsPwd: row.num_seniors_pwd ?? 0,
    notes: row.notes,
    contactName: row.contact_name,
    barangayName: brgy?.name ?? "",
    municipality: brgy?.municipality ?? "",
    createdAt: row.created_at,
  };
});
```

**Step 4: Update `SubmissionInsert` interface**

```typescript
export interface SubmissionInsert {
  id?: string;
  event_id?: string | null;
  contact_name: string;
  contact_phone: string | null;
  barangay_id: string;
  aid_category_id: string;
  access_status: string;
  notes: string | null;
  quantity_needed: number | null;
  urgency: string;
  num_adults: number | null;
  num_children: number | null;
  num_seniors_pwd: number | null;
  lat: number | null;
  lng: number | null;
  geohash?: string | null;
}
```

**Step 5: Update `DeploymentInsert` interface**

Remove `lat`, `lng`:
```typescript
export interface DeploymentInsert {
  event_id?: string | null;
  organization_id: string;
  aid_category_id: string;
  submission_id: string;
  barangay_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}
```

**Step 6: Add `PurchaseInsert` interface and `insertPurchase()` function**

```typescript
export interface PurchaseInsert {
  event_id?: string | null;
  organization_id: string;
  aid_category_id: string;
  quantity: number;
  unit: string | null;
  cost: number | null;
  date: string;
  notes: string | null;
}

export async function insertPurchase(purchase: PurchaseInsert) {
  const { error } = await supabase.from("purchases").insert(purchase);
  if (error) throw error;
}
```

**Step 7: Add `DonationInsert` interface and `insertDonation()` function**

```typescript
export interface DonationInsert {
  organization_id: string;
  amount: number;
  date: string;
  notes: string | null;
}

export async function insertDonation(donation: DonationInsert) {
  const { error } = await supabase.from("donations").insert(donation);
  if (error) throw error;
}
```

**Step 8: Add deployments page queries**

```typescript
// Deployments page: barangay distribution with category breakdown
export async function getBarangayDistribution(eventId: string) {
  const { data } = await supabase
    .from("deployments")
    .select("quantity, barangays(id, name, municipality, lat, lng), aid_categories(name, icon)")
    .eq("event_id", eventId)
    .eq("status", "received");

  // Aggregate by barangay
  const byBarangay = new Map<string, {
    id: string;
    name: string;
    municipality: string;
    lat: number;
    lng: number;
    categories: Map<string, { name: string; icon: string | null; total: number }>;
    totalQuantity: number;
  }>();

  for (const row of data ?? []) {
    const brgy = row.barangays as unknown as { id: string; name: string; municipality: string; lat: number; lng: number };
    const cat = row.aid_categories as unknown as { name: string; icon: string | null };
    if (!brgy) continue;

    if (!byBarangay.has(brgy.id)) {
      byBarangay.set(brgy.id, {
        id: brgy.id,
        name: brgy.name,
        municipality: brgy.municipality,
        lat: brgy.lat,
        lng: brgy.lng,
        categories: new Map(),
        totalQuantity: 0,
      });
    }

    const entry = byBarangay.get(brgy.id)!;
    const catName = cat?.name ?? "Unknown";
    if (!entry.categories.has(catName)) {
      entry.categories.set(catName, { name: catName, icon: cat?.icon ?? null, total: 0 });
    }
    entry.categories.get(catName)!.total += row.quantity ?? 0;
    entry.totalQuantity += row.quantity ?? 0;
  }

  return Array.from(byBarangay.values()).map((b) => ({
    ...b,
    categories: Array.from(b.categories.values()),
  }));
}

// People served: sum beneficiary counts from resolved submissions linked to received deployments
export async function getPeopleServed(eventId: string) {
  const { data } = await supabase
    .from("submissions")
    .select("num_adults, num_children, num_seniors_pwd")
    .eq("event_id", eventId)
    .eq("status", "resolved");

  return (data ?? []).reduce(
    (acc, row) => ({
      adults: acc.adults + (row.num_adults ?? 0),
      children: acc.children + (row.num_children ?? 0),
      seniorsPwd: acc.seniorsPwd + (row.num_seniors_pwd ?? 0),
    }),
    { adults: 0, children: 0, seniorsPwd: 0 }
  );
}

// Recent deployments feed
export async function getRecentDeployments(eventId: string) {
  const { data } = await supabase
    .from("deployments")
    .select("id, quantity, unit, date, notes, status, created_at, organizations(name), aid_categories(name, icon), barangays(name, municipality)")
    .eq("event_id", eventId)
    .eq("status", "received")
    .order("date", { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    unit: row.unit,
    date: row.date,
    notes: row.notes,
    orgName: (row.organizations as unknown as { name: string })?.name ?? "",
    categoryName: (row.aid_categories as unknown as { name: string })?.name ?? "",
    categoryIcon: (row.aid_categories as unknown as { icon: string | null })?.icon ?? null,
    barangayName: (row.barangays as unknown as { name: string })?.name ?? "",
    municipality: (row.barangays as unknown as { municipality: string })?.municipality ?? "",
  }));
}
```

**Step 9: Add Relief Operations page queries**

```typescript
// Total spent on purchases
export async function getTotalSpent() {
  const { data } = await supabase
    .from("purchases")
    .select("cost");
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
}

// Recent purchases
export async function getRecentPurchases(eventId: string) {
  const { data } = await supabase
    .from("purchases")
    .select("id, quantity, unit, cost, date, notes, created_at, organizations(name), aid_categories(name, icon)")
    .eq("event_id", eventId)
    .order("date", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    unit: row.unit,
    cost: row.cost,
    date: row.date,
    notes: row.notes,
    orgName: (row.organizations as unknown as { name: string })?.name ?? "",
    categoryName: (row.aid_categories as unknown as { name: string })?.name ?? "",
    categoryIcon: (row.aid_categories as unknown as { icon: string | null })?.icon ?? null,
  }));
}

// Available inventory: purchased minus deployed per category
export async function getAvailableInventory(eventId: string) {
  // Get all purchased quantities by category
  const { data: purchaseData } = await supabase
    .from("purchases")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("event_id", eventId);

  // Get all deployed quantities by category
  const { data: deployData } = await supabase
    .from("deployments")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("event_id", eventId)
    .eq("status", "received");

  const inventory = new Map<string, { name: string; icon: string | null; purchased: number; deployed: number }>();

  for (const row of purchaseData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    if (!inventory.has(cat.id)) {
      inventory.set(cat.id, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    }
    inventory.get(cat.id)!.purchased += row.quantity ?? 0;
  }

  for (const row of deployData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    if (!inventory.has(cat.id)) {
      inventory.set(cat.id, { name: cat.name, icon: cat.icon, purchased: 0, deployed: 0 });
    }
    inventory.get(cat.id)!.deployed += row.quantity ?? 0;
  }

  return Array.from(inventory.values()).map((item) => ({
    ...item,
    available: item.purchased - item.deployed,
  }));
}
```

**Step 10: Remove old queries that are no longer needed**

- `getVolunteerCount()` — volunteer tracking deferred
- `getDeploymentHubs()` — org type removed, hubs derived from deployment data
- `getDeploymentMapPoints()` — replaced by `getBarangayDistribution()`

Keep these (still used):
- `getTotalDonations()` — Relief Operations page
- `getTotalBeneficiaries()` — can rename/refactor but keep for deployments summary
- `getDonationsByOrganization()` — Relief Operations page
- `getGoodsByCategory()` — Relief Operations page (or replace with inventory view)
- `getBeneficiariesByBarangay()` — may still be useful, evaluate during implementation

**Step 11: Run tests and fix any failures**

```bash
npm test
```

**Step 12: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: update query layer for unified categories, purchases, and deployments"
```

---

## Task 5: Cache Layer — Update types

**Files:**
- Modify: `src/lib/cache.ts`

**Step 1: Update `NeedsData` type**

The NeedPoint type change propagates automatically since NeedsData references it.

**Step 2: Replace `ReliefData` with two new types**

```typescript
export type DeploymentsData = {
  totalDeliveries: number;
  peopleServed: { adults: number; children: number; seniorsPwd: number };
  barangaysReached: number;
  barangayDistribution: {
    id: string;
    name: string;
    municipality: string;
    lat: number;
    lng: number;
    categories: { name: string; icon: string | null; total: number }[];
    totalQuantity: number;
  }[];
  recentDeployments: {
    id: string;
    quantity: number | null;
    unit: string | null;
    date: string | null;
    orgName: string;
    categoryName: string;
    categoryIcon: string | null;
    barangayName: string;
    municipality: string;
  }[];
};

export type OperationsData = {
  totalDonations: number;
  totalSpent: number;
  donationsByOrg: { name: string; amount: number }[];
  recentPurchases: {
    id: string;
    quantity: number;
    unit: string | null;
    cost: number | null;
    date: string | null;
    orgName: string;
    categoryName: string;
    categoryIcon: string | null;
  }[];
  availableInventory: {
    name: string;
    icon: string | null;
    purchased: number;
    deployed: number;
    available: number;
  }[];
};
```

**Step 3: Add cache functions**

```typescript
export const getCachedDeployments = () => getCached<DeploymentsData>("deployments");
export const setCachedDeployments = (data: DeploymentsData) => setCached("deployments", data);
export const getCachedOperations = () => getCached<OperationsData>("operations");
export const setCachedOperations = (data: OperationsData) => setCached("operations", data);
```

**Step 4: Remove old `ReliefData` type and `getCachedRelief`/`setCachedRelief`**

**Step 5: Run tests, fix failures**

```bash
npm test
```

**Step 6: Commit**

```bash
git add src/lib/cache.ts tests/unit/lib/cache.test.ts
git commit -m "feat: split ReliefData cache into DeploymentsData and OperationsData"
```

---

## Task 6: Navigation + Routing

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/components/Header.tsx`
- Create: `src/pages/DeploymentsPage.tsx` (stub)
- Create: `src/pages/ReliefOperationsPage.tsx` (stub)
- Create: `src/pages/ReportPage.tsx` (stub)

**Step 1: Write failing smoke test**

In `tests/e2e/smoke.spec.ts`, update route expectations:
- Remove `/stories` route test
- Add `/deployments` route test
- Add `/relief-operations` route test
- Change `/submit` to `/report`

Run: `npm run verify`
Expected: FAIL (routes don't exist yet)

**Step 2: Create stub pages**

Create minimal placeholder components for `DeploymentsPage`, `ReliefOperationsPage`, and `ReportPage` that just render a header and "Coming soon" text. This gets routing working before building out full UI.

**DeploymentsPage.tsx:**
```typescript
import { useTranslation } from "react-i18next";
import { Header } from "../components/Header";

export function DeploymentsPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">{t("Deployments.title")}</h1>
      </main>
    </div>
  );
}
```

**ReliefOperationsPage.tsx:**
```typescript
import { useTranslation } from "react-i18next";
import { Header } from "../components/Header";

export function ReliefOperationsPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">{t("ReliefOps.title")}</h1>
      </main>
    </div>
  );
}
```

**ReportPage.tsx:**
```typescript
import { useTranslation } from "react-i18next";
import { Header } from "../components/Header";

export function ReportPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">{t("ReportForm.title")}</h1>
      </main>
    </div>
  );
}
```

**Step 3: Update router.tsx**

```typescript
import { DeploymentsPage } from "./pages/DeploymentsPage";
import { ReliefOperationsPage } from "./pages/ReliefOperationsPage";
import { ReportPage } from "./pages/ReportPage";

// In the children array, replace:
//   { path: "relief", element: <ReliefPage /> },
//   { path: "stories", element: <StoriesPage /> },
//   { path: "submit", element: <SubmitPage /> },
// With:
{ path: "deployments", element: <DeploymentsPage /> },
{ path: "relief-operations", element: <ReliefOperationsPage /> },
{ path: "report", element: <ReportPage /> },
```

Remove unused imports for ReliefPage, StoriesPage, SubmitPage.

**Step 4: Update Header.tsx navigation**

Update the `navItems` array:
```typescript
const navItems = [
  { label: t("Navigation.needs"), to: `/${locale}`, end: true },
  { label: t("Navigation.deployments"), to: `/${locale}/deployments` },
  { label: t("Navigation.reliefOps"), to: `/${locale}/relief-operations` },
];
```

Update the Report button link from `/${locale}/submit` to `/${locale}/report`.

**Step 5: Add i18n keys**

In `public/locales/en/translation.json`, add:
```json
"Navigation": {
  ...existing keys...,
  "deployments": "Deployments",
  "reliefOps": "Relief Operations"
},
"Deployments": {
  "title": "Deployments"
},
"ReliefOps": {
  "title": "Relief Operations"
},
"ReportForm": {
  "title": "Report",
  "selectorLabel": "What would you like to report?",
  "submitNeed": "Submit a Need",
  "reportDonation": "Report a Donation",
  "reportPurchase": "Report a Purchase"
}
```

Run `npm run translate` to generate fil/ilo translations.

**Step 6: Run unit tests and smoke tests**

```bash
npm test
npm run verify
```

Fix any broken tests (Header.test.tsx, smoke.spec.ts, etc.).

**Step 7: Commit**

```bash
git add src/router.tsx src/components/Header.tsx src/pages/DeploymentsPage.tsx src/pages/ReliefOperationsPage.tsx src/pages/ReportPage.tsx public/locales/ tests/
git commit -m "feat: update navigation — Deployments, Relief Operations, Report pages"
```

---

## Task 7: Report Page — Form Selector + Submit Need Form

**Files:**
- Modify: `src/pages/ReportPage.tsx`
- Modify: `src/components/SubmitForm.tsx`

**Step 1: Write failing test for form selector**

Test that ReportPage renders a dropdown with three options and defaults to "Submit a Need".

**Step 2: Build form selector in ReportPage**

```typescript
const [formType, setFormType] = useState<"need" | "donation" | "purchase">("need");

// In JSX:
<select value={formType} onChange={(e) => setFormType(e.target.value as typeof formType)}>
  <option value="need">{t("ReportForm.submitNeed")}</option>
  <option value="donation">{t("ReportForm.reportDonation")}</option>
  <option value="purchase">{t("ReportForm.reportPurchase")}</option>
</select>

{formType === "need" && <SubmitForm />}
{formType === "donation" && <DonationForm />}
{formType === "purchase" && <PurchaseForm />}
```

**Step 3: Update SubmitForm for new schema**

Key changes in `src/components/SubmitForm.tsx`:
- Remove `type: "need"` from the payload (line ~168)
- Change `gap_category: form.gapCategory` to `aid_category_id: form.aidCategoryId`
- Add `num_adults`, `num_children`, `num_seniors_pwd` to form state and payload
- Update form fields to show three number inputs for beneficiary counts
- Update the category dropdown to use `id` as value (it may already do this — verify)

**Step 4: Add beneficiary count fields to form UI**

After the urgency field, before notes:
```tsx
<div className="grid grid-cols-3 gap-3">
  <div>
    <label>{t("SubmitForm.numAdults")}</label>
    <input type="number" min="0" value={form.numAdults}
      onChange={(e) => setForm({ ...form, numAdults: parseInt(e.target.value) || 0 })} />
  </div>
  <div>
    <label>{t("SubmitForm.numChildren")}</label>
    <input type="number" min="0" value={form.numChildren}
      onChange={(e) => setForm({ ...form, numChildren: parseInt(e.target.value) || 0 })} />
  </div>
  <div>
    <label>{t("SubmitForm.numSeniorsPwd")}</label>
    <input type="number" min="0" value={form.numSeniorsPwd}
      onChange={(e) => setForm({ ...form, numSeniorsPwd: parseInt(e.target.value) || 0 })} />
  </div>
</div>
```

**Step 5: Add i18n keys for beneficiary fields**

```json
"SubmitForm": {
  ...existing...,
  "numAdults": "Adults",
  "numChildren": "Children (17 & below)",
  "numSeniorsPwd": "Seniors / PWDs"
}
```

**Step 6: Run tests**

```bash
npm test
```

**Step 7: Commit**

```bash
git add src/pages/ReportPage.tsx src/components/SubmitForm.tsx public/locales/ tests/
git commit -m "feat: Report page with form selector and updated Submit Need form"
```

---

## Task 8: Report Page — Donation Form + Purchase Form

**Files:**
- Create: `src/components/DonationForm.tsx`
- Create: `src/components/PurchaseForm.tsx`

**Step 1: Write failing tests**

Create `tests/unit/components/DonationForm.test.tsx` and `tests/unit/components/PurchaseForm.test.tsx`. Test that forms render correct fields and call insert functions on submit.

**Step 2: Build DonationForm**

Simple form with: organization dropdown, amount input (₱), date picker, notes textarea. On submit, calls `insertDonation()`. Follows same patterns as SubmitForm (loading state, success message, error handling).

**Step 3: Build PurchaseForm**

Form with: organization dropdown, aid category dropdown, quantity input, unit input, cost input (₱), date picker, notes textarea. On submit, calls `insertPurchase()`.

**Step 4: Wire into ReportPage**

Import DonationForm and PurchaseForm, render based on formType state.

**Step 5: Add i18n keys**

```json
"DonationForm": {
  "organization": "Organization",
  "amount": "Amount (₱)",
  "date": "Date",
  "notes": "Notes (optional)",
  "submit": "Report Donation",
  "success": "Donation reported successfully!",
  "error": "Failed to report donation"
},
"PurchaseForm": {
  "organization": "Organization",
  "category": "Aid Category",
  "quantity": "Quantity",
  "unit": "Unit (optional)",
  "cost": "Cost (₱)",
  "date": "Date",
  "notes": "Notes (optional)",
  "submit": "Report Purchase",
  "success": "Purchase reported successfully!",
  "error": "Failed to report purchase"
}
```

**Step 6: Run tests**

```bash
npm test
```

**Step 7: Commit**

```bash
git add src/components/DonationForm.tsx src/components/PurchaseForm.tsx src/pages/ReportPage.tsx public/locales/ tests/
git commit -m "feat: add Donation and Purchase reporting forms"
```

---

## Task 9: Needs Page — Update PinDetailSheet

**Files:**
- Modify: `src/components/PinDetailSheet.tsx`
- Modify: `src/components/NeedsCoordinationMap.tsx` (if it references gapCategory)

**Step 1: Update PinDetailSheet to show aid category name + icon**

Replace the gap category display with aid category name. The `NeedPoint` now has `aidCategoryName` and `aidCategoryIcon`.

```tsx
// Replace gap_category display with:
<span>{pin.aidCategoryIcon} {pin.aidCategoryName}</span>
```

**Step 2: Add beneficiary count display**

Show total people affected: `numAdults + numChildren + numSeniorsPwd`. Replace the "Families" label with "People":

```tsx
<dt>{t("PinDetail.people")}</dt>
<dd>{pin.numAdults + pin.numChildren + pin.numSeniorsPwd}</dd>
```

**Step 3: Gate resolved transition on delivery photo**

In the status stepper, disable the "Resolved" button unless `delivery_photo_url` is set. The current code already shows the delivery photo upload button at the `completed` stage — we just need to ensure the resolve action checks for it.

**Step 4: Update resolve action to update both records**

When coordinator clicks "Resolve", update submission to resolved AND deployment to received:

```typescript
// In the resolve handler:
await updateSubmissionStatus(pin.id, "resolved");
// Also update linked deployment
await supabase
  .from("deployments")
  .update({ status: "received" })
  .eq("submission_id", pin.id);
```

**Step 5: Add i18n keys**

```json
"PinDetail": {
  ...existing...,
  "people": "People",
  "deliveryPhotoRequired": "Delivery photo required to resolve"
}
```

**Step 6: Run tests**

```bash
npm test
```

**Step 7: Commit**

```bash
git add src/components/PinDetailSheet.tsx src/components/NeedsCoordinationMap.tsx public/locales/ tests/
git commit -m "feat: update pin detail — aid categories, beneficiary counts, resolve gate"
```

---

## Task 10: Deployments Page — Full Implementation

**Files:**
- Modify: `src/pages/DeploymentsPage.tsx`
- Create: `src/components/DeploymentSummaryCards.tsx`
- Create: `src/components/BarangayDistributionMap.tsx`
- Create: `src/components/RecentDeployments.tsx`
- Create: `src/components/maps/BarangayBubbleMap.tsx`

**Step 1: Write failing tests for DeploymentsPage**

Create `tests/unit/pages/DeploymentsPage.test.tsx`. Test that it renders summary cards, map, and recent deployments list. Mock the query functions.

**Step 2: Build DeploymentSummaryCards**

Three cards: Total Deliveries, People Served, Barangays Reached. Same visual pattern as existing SummaryCards component.

**Step 3: Build BarangayBubbleMap**

Leaflet map with `CircleMarker` for each barangay. Size proportional to `totalQuantity`. On click, show popup with category breakdown:

```tsx
<CircleMarker
  center={[brgy.lat, brgy.lng]}
  radius={Math.max(8, Math.sqrt(brgy.totalQuantity) * 2)}
  // Use design token colors
>
  <Popup>
    <h3>{brgy.name}, {brgy.municipality}</h3>
    <ul>
      {brgy.categories.map(cat => (
        <li key={cat.name}>{cat.icon} {cat.name}: {cat.total}</li>
      ))}
    </ul>
  </Popup>
</CircleMarker>
```

**Step 4: Build RecentDeployments**

List/table showing recent deployment records: date, org name, category (with icon), quantity + unit, barangay. Sortable by date.

**Step 5: Build BarangayDistributionMap wrapper**

Combines BarangayBubbleMap (left) with a sidebar list of barangays served (right), similar to existing AidDistributionMap layout.

**Step 6: Wire DeploymentsPage**

Follow same cache-first data loading pattern as existing ReliefPage:
```typescript
const [data, setData] = useState<DeploymentsData | null>(null);

useEffect(() => {
  async function load() {
    const cached = await getCachedDeployments();
    if (cached) setData(cached);

    // Fetch fresh
    const [distribution, people, recent] = await Promise.all([
      getBarangayDistribution(eventId),
      getPeopleServed(eventId),
      getRecentDeployments(eventId),
    ]);

    const fresh: DeploymentsData = {
      totalDeliveries: recent.length, // or a dedicated count query
      peopleServed: people,
      barangaysReached: distribution.length,
      barangayDistribution: distribution,
      recentDeployments: recent,
    };

    setData(fresh);
    await setCachedDeployments(fresh);
  }
  load();
}, [eventId]);
```

**Step 7: Run tests**

```bash
npm test
npm run verify
```

**Step 8: Commit**

```bash
git add src/pages/DeploymentsPage.tsx src/components/DeploymentSummaryCards.tsx src/components/BarangayDistributionMap.tsx src/components/RecentDeployments.tsx src/components/maps/BarangayBubbleMap.tsx public/locales/ tests/
git commit -m "feat: Deployments page — summary cards, barangay bubble map, recent deployments"
```

---

## Task 11: Relief Operations Page — Full Implementation

**Files:**
- Modify: `src/pages/ReliefOperationsPage.tsx`
- Create: `src/components/OperationsSummaryCards.tsx`
- Create: `src/components/RecentPurchases.tsx`
- Create: `src/components/AvailableInventory.tsx`
- Reuse: `src/components/DonationsByOrg.tsx` (minimal changes)

**Step 1: Write failing tests for ReliefOperationsPage**

Create `tests/unit/pages/ReliefOperationsPage.test.tsx`. Test summary cards, donations list, purchases list, and inventory grid render.

**Step 2: Build OperationsSummaryCards**

Three cards: Total Donations (₱), Total Spent (₱), Goods Available (count).

**Step 3: Build RecentPurchases**

List showing purchase records: date, org name, category (with icon), quantity + unit, cost (₱).

**Step 4: Build AvailableInventory**

Grid of 9 aid category cards. Each shows category icon + name + available count. Cards with 0 available use a muted/grayed style.

```tsx
<div className="grid grid-cols-3 gap-4">
  {inventory.map(item => (
    <div key={item.name} className={item.available <= 0 ? "opacity-40" : ""}>
      <span className="text-2xl">{item.icon}</span>
      <p className="font-medium">{item.name}</p>
      <p className="text-xl font-bold">{item.available}</p>
      <p className="text-xs text-muted">({item.purchased} purchased, {item.deployed} deployed)</p>
    </div>
  ))}
</div>
```

**Step 5: Wire ReliefOperationsPage**

Same cache-first pattern. Two columns: left = DonationsByOrg + RecentPurchases, right = AvailableInventory.

**Step 6: Run tests**

```bash
npm test
npm run verify
```

**Step 7: Commit**

```bash
git add src/pages/ReliefOperationsPage.tsx src/components/OperationsSummaryCards.tsx src/components/RecentPurchases.tsx src/components/AvailableInventory.tsx public/locales/ tests/
git commit -m "feat: Relief Operations page — donations, purchases, available inventory"
```

---

## Task 12: Cleanup

**Files:**
- Delete: `src/pages/ReliefPage.tsx`
- Delete: `src/pages/StoriesPage.tsx`
- Delete: `src/pages/SubmitPage.tsx`
- Delete: `src/components/DeploymentHubs.tsx` (no longer needed — org type removed)
- Delete: `src/components/AidDistributionMap.tsx` (replaced by BarangayDistributionMap)
- Delete: `src/components/maps/DeploymentMap.tsx` (replaced by BarangayBubbleMap)
- Delete: related test files for removed components
- Modify: `src/components/SummaryCards.tsx` — evaluate if still used or replaced by new summary card components
- Update: `.claude/rules/supabase.md` — update schema description to match new model

**Step 1: Remove old files and their tests**

**Step 2: Run full test suite**

```bash
npm test
npm run verify
```

**Step 3: Run production build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old Relief, Stories, Submit pages and replaced components"
```

---

## Task 13: Final Verification

**Step 1: Run full test suite**

```bash
npm test
npm run verify
```

**Step 2: Production build + preview**

```bash
npm run build && npm run preview
```

Test offline behavior with service worker.

**Step 3: Manual verification with Playwright CLI**

- Navigate all 4 routes in all 3 locales
- Submit a need via Report page (form type: need)
- Switch to donation form and purchase form — verify they render
- Check Deployments page renders map with bubbles
- Check Relief Operations page renders inventory grid
- Verify needs map filters out resolved pins

**Step 4: Final commit if any fixes needed**

---

## Execution Order Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Schema — schema.sql | None |
| 2 | Schema — RLS policies | Task 1 |
| 3 | Schema — seed-demo.sql | Task 1 |
| 4 | Query layer | Task 1 |
| 5 | Cache layer | Task 4 |
| 6 | Navigation + routing (stubs) | None (parallel with 1-5) |
| 7 | Report page — form selector + submit need | Tasks 4, 6 |
| 8 | Report page — donation + purchase forms | Tasks 4, 7 |
| 9 | Needs page — pin detail updates | Task 4 |
| 10 | Deployments page | Tasks 4, 5, 6 |
| 11 | Relief Operations page | Tasks 4, 5, 6 |
| 12 | Cleanup old files | Tasks 7-11 |
| 13 | Final verification | Task 12 |

**Parallelizable:** Tasks 1-3 (schema) can run alongside Task 6 (routing stubs). Tasks 10 and 11 can be built in parallel after their dependencies are met.
