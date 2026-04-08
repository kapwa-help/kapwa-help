# Data Model V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current 8-table schema with the simplified 12-table marketplace data model (orgs/hubs separated, no quantities, beneficiaries as metric, multi-select aid categories via junction tables).

**Architecture:** Clean break — rewrite schema.sql, seed-demo.sql, then update types, queries, forms, components, and tests bottom-up. No migrations needed (demo data only). Junction tables (need_categories, donation_categories, purchase_categories, hub_inventory) replace single FK aid_category_id columns.

**Tech Stack:** Supabase (Postgres), TypeScript, React, Vitest + RTL

**Reference:** Design spec at `docs/plans/2026-04-08-data-model-v1.md`

---

## Task 1: Rewrite schema.sql

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Rewrite the schema file**

Replace the entire contents of `supabase/schema.sql` with the new schema. Drop all old tables and enums, create new ones.

Key changes from old schema:
- `submissions` → `needs` (renamed, simplified columns)
- `organizations` loses `lat`, `lng` (no longer map entities)
- New table `deployment_hubs` (independent from orgs, has lat/lng/notes)
- New junction tables: `need_categories`, `donation_categories`, `purchase_categories`, `hub_inventory`
- `donations` gains `donor_name`, `donor_type`; loses `quantity`, `unit`
- `purchases` loses `quantity`, `unit`, `aid_category_id`
- `deployments` loses `organization_id`, `barangay_id`, `quantity`, `unit`, `status`; gains `hub_id`
- `hazards` loses `hazard_type` enum
- `barangays` table removed entirely
- Status enum: `pending | verified | in_transit | confirmed` (was 5 states, now 4)

```sql
-- ============================================================
-- Kapwa Help — V1 Data Model
-- ============================================================

-- Enums
CREATE TYPE access_status AS ENUM ('truck', '4x4', 'boat', 'foot_only', 'cut_off');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE need_status AS ENUM ('pending', 'verified', 'in_transit', 'confirmed');
CREATE TYPE donation_type AS ENUM ('cash', 'in_kind');
CREATE TYPE donor_type AS ENUM ('individual', 'organization');
CREATE TYPE hazard_status AS ENUM ('active', 'resolved');

-- Events (scopes everything)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  region text,
  started_at date,
  ended_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Organizations (financial/accountability layer)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  name text NOT NULL,
  description text,
  contact_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deployment Hubs (operational/map layer — independent from orgs)
CREATE TABLE deployment_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  name text NOT NULL,
  lat decimal(9,6) NOT NULL,
  lng decimal(9,6) NOT NULL,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Aid Categories (shared vocabulary)
CREATE TABLE aid_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL
);

-- Hub Inventory (junction — which categories a hub currently has)
CREATE TABLE hub_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES deployment_hubs(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(hub_id, aid_category_id)
);

-- Needs (demand side — community or hub needs)
CREATE TABLE needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  hub_id uuid REFERENCES deployment_hubs(id),
  lat decimal(9,6) NOT NULL,
  lng decimal(9,6) NOT NULL,
  access_status access_status NOT NULL,
  urgency urgency_level NOT NULL,
  status need_status NOT NULL DEFAULT 'pending',
  num_people integer NOT NULL,
  contact_name text NOT NULL,
  contact_phone text,
  notes text,
  delivery_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Need Categories (junction — multi-select aid types per need)
CREATE TABLE need_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(need_id, aid_category_id)
);

-- Donations (financial ledger)
CREATE TABLE donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  donor_name text,
  donor_type donor_type,
  type donation_type NOT NULL,
  amount decimal(12,2),
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Donation Categories (junction — multi-select for in-kind)
CREATE TABLE donation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(donation_id, aid_category_id)
);

-- Purchases (org spending record)
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  cost decimal(12,2) NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Purchase Categories (junction — multi-select)
CREATE TABLE purchase_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  UNIQUE(purchase_id, aid_category_id)
);

-- Hazards (map layer)
CREATE TABLE hazards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  description text NOT NULL,
  photo_url text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  status hazard_status NOT NULL DEFAULT 'active',
  reported_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deployments (fulfillment record — created when need is confirmed)
CREATE TABLE deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  hub_id uuid NOT NULL REFERENCES deployment_hubs(id),
  need_id uuid NOT NULL UNIQUE REFERENCES needs(id),
  date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "refactor: rewrite schema.sql for V1 data model

Separate orgs from hubs, add junction tables for multi-select
aid categories, rename submissions to needs, simplify to 4-status
lifecycle, track beneficiaries instead of quantities."
```

---

## Task 2: Rewrite RLS policies

**Files:**
- Modify: `supabase/rls-policies.sql`

**Step 1: Rewrite RLS policies for new tables**

Update to reference new table names. Same open-access pattern (demo phase) but covering all 12 tables. Enable RLS on each table, add SELECT policy for anon on all tables, add INSERT/UPDATE on operational tables (needs, deployments, donations, purchases, hazards, hub_inventory, need_categories, donation_categories, purchase_categories).

**Step 2: Commit**

```bash
git add supabase/rls-policies.sql
git commit -m "refactor: update RLS policies for V1 schema"
```

---

## Task 3: Rewrite seed-demo.sql

**Files:**
- Modify: `supabase/seed-demo.sql`

**Step 1: Rewrite demo seed data**

Create demo data for the new schema:
- 1 active event
- 3-4 organizations (Citizens for LU, Buhaki LU Chapter, Art Relief Mobile Kitchen, LU Disaster Response)
- 4-5 deployment hubs with lat/lng in La Union area (separate from orgs)
- hub_inventory rows linking hubs to aid categories they have
- 6-8 needs with varying statuses (pending, verified, in_transit, confirmed), using num_people instead of demographic breakdown
- need_categories rows (multiple categories per need)
- Cash and in-kind donations with donor_name/donor_type
- donation_categories for in-kind donations
- Purchases with purchase_categories
- 3-4 hazards (no hazard_type, just description)
- Deployments linking hubs to confirmed needs

Key: use realistic La Union coordinates. Hubs in San Juan, Bacnotan, San Fernando area. Needs spread across municipalities.

**Step 2: Commit**

```bash
git add supabase/seed-demo.sql
git commit -m "refactor: rewrite demo seed data for V1 schema"
```

---

## Task 4: Update TypeScript types and query functions

**Files:**
- Modify: `src/lib/queries.ts`
- Modify: `src/lib/cache.ts`

This is the most critical task — every component depends on these types.

**Step 1: Rewrite types in queries.ts**

Replace old types with new ones:

```typescript
// --- Display Types ---

export interface NeedPoint {
  id: string;
  lat: number;
  lng: number;
  status: 'pending' | 'verified' | 'in_transit' | 'confirmed';
  categories: { id: string; name: string; icon: string }[];
  accessStatus: string;
  urgency: string;
  numPeople: number;
  contactName: string;
  contactPhone: string | null;
  notes: string | null;
  hubId: string | null;
  deliveryPhotoUrl: string | null;
  createdAt: string;
}

export interface HubPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  notes: string | null;
  inventory: { categoryName: string; categoryIcon: string }[];
}

export interface HazardPoint {
  id: string;
  description: string;
  photoUrl: string | null;
  lat: number;
  lng: number;
  status: string;
  reportedBy: string | null;
  createdAt: string;
}

// --- Insert Types ---

export interface NeedInsert {
  id?: string;
  event_id: string;
  hub_id?: string | null;
  lat: number;
  lng: number;
  access_status: string;
  urgency: string;
  num_people: number;
  contact_name: string;
  contact_phone?: string;
  notes?: string;
  category_ids: string[];  // resolved client-side, inserted into need_categories
}

export interface DonationInsert {
  event_id: string;
  organization_id: string;
  donor_name?: string;
  donor_type?: 'individual' | 'organization';
  type: 'cash' | 'in_kind';
  amount?: number;
  date: string;
  notes?: string;
  category_ids?: string[];  // for in-kind, inserted into donation_categories
}

export interface PurchaseInsert {
  event_id: string;
  organization_id: string;
  cost: number;
  date: string;
  notes?: string;
  category_ids: string[];  // inserted into purchase_categories
}

export interface HazardInsert {
  event_id: string;
  description: string;
  photo_url?: string;
  latitude: number;
  longitude: number;
  reported_by?: string;
}

export interface DeploymentInsert {
  event_id: string;
  hub_id: string;
  need_id: string;
  date: string;
  notes?: string;
}
```

**Step 2: Rewrite query functions**

Key function changes:

- `getNeedsMapPoints(eventId)` — query `needs` table, join `need_categories` + `aid_categories` to get category arrays. No more barangay join.
- `insertNeed(need)` — insert into `needs`, then batch insert into `need_categories` for each `category_ids` entry. Replaces `insertSubmission`.
- `updateNeedStatus(id, status)` — replaces `updateSubmissionStatus`, uses `needs` table.
- `getDeploymentHubs(eventId)` — query `deployment_hubs`, join `hub_inventory` + `aid_categories`. No more inventory math. Just return category checklist.
- `insertDonation(donation)` — insert into `donations`, then batch insert `donation_categories` for in-kind.
- `insertPurchase(purchase)` — insert into `purchases`, then batch insert `purchase_categories`.
- `getHazards(eventId)` — remove `hazard_type` from select. Just description + photo.
- `insertHazard(hazard)` — remove `hazard_type` field.
- `getTotalBeneficiaries(eventId)` — SUM `num_people` from `needs` WHERE `status = 'confirmed'`. No more demographic breakdown.
- `getPeopleServed(eventId)` — same as getTotalBeneficiaries, or merge them.
- `createDeployment(deployment)` — insert into `deployments` and update need status to `confirmed`.
- Remove: `getBarangays()`, `getBarangayDistribution()`, `getGoodsByCategory()`, `updateDeploymentStatus()`, `getRecentDeployments()`.
- Remove or simplify: `getAvailableInventory()` — no longer calculated, hub_inventory is manual.
- `getOrganizations()` — remove `municipality` from select.
- `getHubs()` — new function, returns all hubs for dropdowns.

**Step 3: Update cache.ts types**

Update `NeedsData`, `ReliefMapData`, `TransparencyData` types to match new query return shapes. Remove `BarangayDistributionEntry`. Remove demographic breakdown from `DeploymentsData` — just `totalBeneficiaries: number`.

**Step 4: Commit**

```bash
git add src/lib/queries.ts src/lib/cache.ts
git commit -m "refactor: rewrite types and queries for V1 data model

Multi-select categories via junction tables, num_people replaces
demographic breakdown, hubs separated from orgs, hazard_type removed."
```

---

## Task 5: Update form-cache.ts (offline outbox)

**Files:**
- Modify: `src/lib/form-cache.ts`

**Step 1: Update the outbox payload type**

The outbox stores `NeedInsert` payloads for offline submission. Update the stored shape to match the new `NeedInsert` type (remove `barangay_id`, `quantity_needed`, demographic fields, photo fields; add `category_ids`, `num_people`).

The outbox flush function needs to handle the junction table insert — when syncing a cached need, it must:
1. Insert the need row
2. Insert `need_categories` rows for each `category_ids` entry

**Step 2: Commit**

```bash
git add src/lib/form-cache.ts
git commit -m "refactor: update offline outbox for V1 need schema"
```

---

## Task 6: Update SubmitForm component

**Files:**
- Modify: `src/components/SubmitForm.tsx`

**Step 1: Update the form**

Key changes:
- Remove barangay dropdown entirely (no more `getBarangays()` call, no barangay state)
- Replace single `aid_category_id` select with **multi-select checkboxes** for aid categories
- Remove `quantity_needed` field
- Replace `num_adults`, `num_children`, `num_seniors_pwd` fields with single `num_people` field
- Remove `submission_photo_url` and `dispatch_photo_url` from payload
- Build `NeedInsert` payload with `category_ids: string[]` array
- Keep: contact_name, contact_phone, access_status, urgency, notes, lat/lng

**Step 2: Commit**

```bash
git add src/components/SubmitForm.tsx
git commit -m "refactor: simplify SubmitForm for V1 — multi-select categories, num_people"
```

---

## Task 7: Update DonationForm component

**Files:**
- Modify: `src/components/DonationForm.tsx`

**Step 1: Update the form**

Key changes:
- Add `donor_name` text input (optional)
- Add `donor_type` toggle/select: individual or organization (optional)
- For cash: keep `amount` (required), remove category
- For in-kind: replace single `aid_category_id` with **multi-select checkboxes**, remove `quantity` and `unit` fields
- Build `DonationInsert` payload

**Step 2: Commit**

```bash
git add src/components/DonationForm.tsx
git commit -m "refactor: update DonationForm — donor tracking, multi-select in-kind categories"
```

---

## Task 8: Update PurchaseForm component

**Files:**
- Modify: `src/components/PurchaseForm.tsx`

**Step 1: Update the form**

Key changes:
- Replace single `aid_category_id` with **multi-select checkboxes**
- Remove `quantity` and `unit` fields
- Keep `cost` (required), `date`, `notes`, `organization_id`
- Build `PurchaseInsert` payload with `category_ids`

**Step 2: Commit**

```bash
git add src/components/PurchaseForm.tsx
git commit -m "refactor: update PurchaseForm — multi-select categories, drop quantities"
```

---

## Task 9: Update HazardForm component

**Files:**
- Modify: `src/components/HazardForm.tsx`

**Step 1: Update the form**

Key changes:
- Remove `hazard_type` dropdown and `HAZARD_TYPES` constant
- Make `description` required (was optional when type was primary classifier)
- Keep photo upload, reported_by (optional), location
- Build `HazardInsert` payload without `hazard_type`

**Step 2: Commit**

```bash
git add src/components/HazardForm.tsx
git commit -m "refactor: simplify HazardForm — freeform description replaces type dropdown"
```

---

## Task 10: Update ClaimForm component

**Files:**
- Modify: `src/components/ClaimForm.tsx`

**Step 1: Update the form**

Key changes:
- Replace `organization_id` with `hub_id` dropdown (hubs fulfill needs, not orgs)
- Remove `aid_category_id` dropdown (need already has categories)
- Remove `quantity` and `unit` fields
- Keep `notes`
- Build `DeploymentInsert` payload: `{ hub_id, need_id, date, notes }`
- On submit: call `createDeployment()` which sets need status to `confirmed`

**Step 2: Commit**

```bash
git add src/components/ClaimForm.tsx
git commit -m "refactor: update ClaimForm — hub-based fulfillment, no quantities"
```

---

## Task 11: Update PinDetailSheet component

**Files:**
- Modify: `src/components/PinDetailSheet.tsx`

**Step 1: Update the detail view**

Key changes:
- Remove `barangayName` and `municipality` display
- Show multiple aid categories (map over `point.categories` array) instead of single category
- Replace `numAdults + numChildren + numSeniorsPwd` calculation with `point.numPeople`
- Update status stepper: 4 states (pending → verified → in_transit → confirmed) instead of 5
- Remove `completed` step — `confirmed` is terminal
- Add delivery photo upload on the `in_transit → confirmed` transition
- Call `updateNeedStatus()` instead of `updateSubmissionStatus()`
- Remove `updateDeploymentStatus()` call

**Step 2: Commit**

```bash
git add src/components/PinDetailSheet.tsx
git commit -m "refactor: update PinDetailSheet — multi-category display, 4-status lifecycle"
```

---

## Task 12: Update HubDetailPanel component

**Files:**
- Modify: `src/components/HubDetailPanel.tsx`

**Step 1: Update the detail view**

Key changes:
- Display inventory as category checklist (no quantities): just icon + name per row
- Add hub notes display section
- Hub needs section: query `needs` WHERE `hub_id = this_hub` and display as list
- Remove quantity-based inventory calculation display

**Step 2: Commit**

```bash
git add src/components/HubDetailPanel.tsx
git commit -m "refactor: update HubDetailPanel — category checklist, notes, hub needs"
```

---

## Task 13: Update HazardDetailPanel component

**Files:**
- Modify: `src/components/HazardDetailPanel.tsx`

**Step 1: Update the detail view**

Key changes:
- Remove `hazardType` display line and its i18n key lookup
- Description is now the primary identifier (was secondary to type)
- Keep photo, reported_by, timestamp display

**Step 2: Commit**

```bash
git add src/components/HazardDetailPanel.tsx
git commit -m "refactor: simplify HazardDetailPanel — description-first, no type"
```

---

## Task 14: Update ReliefMap and ReliefMapLeaflet

**Files:**
- Modify: `src/components/ReliefMap.tsx`
- Modify: `src/components/maps/ReliefMapLeaflet.tsx`

**Step 1: Update map components**

Key changes:
- Update `NeedPoint` usage to match new type (categories array, numPeople, no barangay)
- Update `HubPoint` usage (no quantities in inventory)
- Update `HazardPoint` usage (no hazardType)
- Summary bar: update active needs count filter — active = `verified` + `in_transit` (no `completed`)
- Status color mapping: remove `completed` and `resolved`, add `confirmed` (use primary/cyan)

**Step 2: Commit**

```bash
git add src/components/ReliefMap.tsx src/components/maps/ReliefMapLeaflet.tsx
git commit -m "refactor: update map components for V1 types"
```

---

## Task 15: Update TransparencyPage

**Files:**
- Modify: `src/pages/TransparencyPage.tsx`
- Modify: `src/components/BarangayEquity.tsx` (remove or repurpose)
- Modify: `src/components/RecentPurchases.tsx`
- Modify: `src/components/DonationsByOrg.tsx`

**Step 1: Update transparency page**

Key changes:
- Remove BarangayEquity component and its import (barangays stripped)
- Update summary cards: Total Donations, Total Spent, Total Beneficiaries (from confirmed needs)
- Update RecentPurchases: remove quantity/unit columns, show cost + categories
- Update DonationsByOrg: keep as-is (groups cash donations by org)
- Remove or comment out available inventory section (no longer calculated)

**Step 2: Commit**

```bash
git add src/pages/TransparencyPage.tsx src/components/BarangayEquity.tsx src/components/RecentPurchases.tsx src/components/DonationsByOrg.tsx
git commit -m "refactor: update TransparencyPage — beneficiaries metric, drop barangay equity"
```

---

## Task 16: Update i18n translation files

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

**Step 1: Update all three locale files**

Key changes across all locales:
- Remove: `SubmitForm.barangay`, `SubmitForm.barangayPlaceholder`, `SubmitForm.quantityNeeded`, `SubmitForm.quantityPlaceholder`, `SubmitForm.numAdults`, `SubmitForm.numChildren`, `SubmitForm.numSeniorsPwd`
- Add: `SubmitForm.numPeople` (label for beneficiary count), `SubmitForm.selectCategories` (multi-select label)
- Remove: `HazardForm.hazardType`, all `HazardForm.{type}` keys (flood, landslide, etc.)
- Remove: `HazardDetail.type`, all `HazardDetail.{type}` keys
- Remove: `Transparency.barangayEquity`, `Transparency.barangay`
- Add: `DonationForm.donorName`, `DonationForm.donorType`, `DonationForm.individual`, `DonationForm.organization`
- Update status keys: remove `completed`/`resolved`, add `confirmed`
- Keep all access_status keys unchanged

After updating English, run `npm run translate` to machine-translate new keys to fil/ilo.

**Step 2: Commit**

```bash
git add public/locales/
git commit -m "i18n: update translation keys for V1 data model"
```

---

## Task 17: Update ReliefMapPage

**Files:**
- Modify: `src/pages/ReliefMapPage.tsx`

**Step 1: Update data fetching**

Key changes:
- Ensure `getNeedsMapPoints()` is called with correct event_id
- Hub data now comes from `getDeploymentHubs()` which returns category checklists
- Hazard data no longer has `hazardType`
- Any status filtering should use 4 statuses, not 5

**Step 2: Commit**

```bash
git add src/pages/ReliefMapPage.tsx
git commit -m "refactor: update ReliefMapPage data fetching for V1"
```

---

## Task 18: Update all test files

**Files:**
- Modify: `tests/unit/lib/queries.test.ts`
- Modify: `tests/unit/lib/cache.test.ts`
- Modify: `tests/unit/lib/form-cache.test.ts`
- Modify: `tests/unit/components/SubmitForm.test.tsx`
- Modify: `tests/unit/components/PinDetailSheet.test.tsx`
- Modify: `tests/unit/components/ClaimForm.test.tsx`
- Modify: `tests/unit/components/HazardForm.test.tsx`
- Modify: `tests/unit/components/HubDetailPanel.test.tsx`
- Modify: `tests/unit/components/HazardDetailPanel.test.tsx`
- Modify: `tests/unit/components/ReliefMap.test.tsx`
- Modify: `tests/unit/components/maps/ReliefMapLeaflet.test.tsx`
- Modify: `tests/unit/components/DonationForm.test.tsx`
- Remove: `tests/unit/components/BarangayEquity.test.tsx`

**Step 1: Update mock data across all test files**

All mock `NeedPoint` objects must use new shape:
- Replace `aidCategoryId`/`aidCategoryName`/`aidCategoryIcon` with `categories: [{ id, name, icon }]`
- Replace `numAdults`/`numChildren`/`numSeniorsPwd` with `numPeople`
- Remove `barangayName`, `municipality`, `quantityNeeded`
- Add `hubId: null`
- Status values: use `confirmed` instead of `completed`/`resolved`

All mock `HubPoint` objects:
- Remove quantity from inventory items — just `{ categoryName, categoryIcon }`
- Add `description: null`, `notes: null`

All mock `HazardPoint` objects:
- Remove `hazardType`

Update query test mocks:
- `insertSubmission` → `insertNeed` with new payload shape
- `getBarangays` tests → remove entirely
- `createDeploymentForNeed` → `createDeployment` with hub_id
- Hazard tests: remove hazard_type from insert/select mocks

Update form tests:
- SubmitForm: remove barangay field tests, update payload assertions
- DonationForm: add donor_name/donor_type fields, remove quantity/unit for in-kind
- PurchaseForm: remove quantity/unit, multi-select categories
- HazardForm: remove hazard_type dropdown test
- ClaimForm: hub_id instead of org_id, remove quantity/unit

Remove BarangayEquity test file entirely.

**Step 2: Run tests**

```bash
npm test
```

Expected: All tests pass (98+ tests, minus removed BarangayEquity tests, plus any new tests).

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update all tests for V1 data model"
```

---

## Task 19: Final verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

**Step 2: Run build**

```bash
npm run build
```

Expected: No TypeScript errors, clean build.

**Step 3: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

**Step 4: Commit any remaining fixes**

If any issues found, fix and commit with descriptive message.

---

## Task Summary

| Task | What | Risk |
|------|------|------|
| 1 | schema.sql rewrite | Low — demo data, clean break |
| 2 | RLS policies | Low |
| 3 | Seed data | Low |
| 4 | Types + queries | **CRITICAL** — everything depends on this |
| 5 | Offline outbox | Medium — offline sync logic |
| 6 | SubmitForm | High — primary user-facing form |
| 7 | DonationForm | Medium |
| 8 | PurchaseForm | Medium |
| 9 | HazardForm | Low — small change |
| 10 | ClaimForm | Medium — hub-based now |
| 11 | PinDetailSheet | High — complex status logic |
| 12 | HubDetailPanel | Medium |
| 13 | HazardDetailPanel | Low |
| 14 | ReliefMap + Leaflet | High — map rendering |
| 15 | TransparencyPage | Medium |
| 16 | i18n translations | Medium — 3 locale files |
| 17 | ReliefMapPage | Low |
| 18 | Tests | High — many files |
| 19 | Final verification | Low |
