# Data Model & Page Redesign

Date: 2026-04-06
Status: Design approved
Context: Conversation with Hannah about aligning the app to the actual relief operations pipeline — needs to deployments to transparency reporting.

## Motivation

The current Relief page mixes deployment tracking with financial data. Categorization is fragmented — `gap_category` (free text on submissions) and `aid_categories` (table for deployments) represent the same concept differently. There's no way to track purchases or available inventory. The app needs a clearer pipeline: **report a need → verify → deploy → track distribution → report transparently.**

## Navigation

```
Needs  |  Deployments  |  Relief Operations  |  Report
```

- **Stories** page removed from router (component kept in codebase for future subdomain use)
- **Submit** renamed to **Report** with expanded scope (three form types)

## Data Model Changes

### 1. Unified Aid Categories

Replace all current `aid_categories` seed data and the gap category concept with Hannah's 9-category list:

| Category             | Icon |
|----------------------|------|
| Hot Meals            | 🍲   |
| Drinking Water       | 💧   |
| Water Filtration     | 🚰   |
| Temporary Shelter    | 🏕️   |
| Clothing             | 👕   |
| Construction Materials | 🔨 |
| Medical Supplies     | 🏥   |
| Hygiene Kits         | 🧼   |
| Canned Food          | 🥫   |

These are the source of truth across the entire app — submit form, claim form, deployments, purchases, and reporting.

### 2. Submissions Table Changes

**Remove:**
- `type` — always 'need', single-value column adds nothing
- `gap_category` (text) — replaced by FK

**Add:**
- `aid_category_id` (uuid FK → aid_categories, NOT NULL) — replaces gap_category
- `num_adults` (integer, optional, default 0)
- `num_children` (integer, optional, default 0)
- `num_seniors_pwd` (integer, optional, default 0)

**Keep (photo fields per scope §5.B):**
- `submission_photo_url` — "Proof of Need" (will become required when upload UI is added)
- `dispatch_photo_url` — "Proof of Relief in transit" (optional)
- `delivery_photo_url` — "Proof of Fulfillment" (gates completed → resolved transition)

Beneficiary count = `num_adults + num_children + num_seniors_pwd`, aggregated per barangay for the deployments page.

### 3. Deployments Table Changes

**Remove:**
- `recipient` — beneficiary data moves to submission-level counts
- `volunteer_count` — volunteer tracking deferred to future iteration
- `hours` — same, deferred
- `lat` / `lng` — deployments aggregate at barangay level; barangay already has coordinates

### 4. Organizations Table Changes

**Remove:**
- `type` (donor/hub/both) — redundant with data. If an org has donations rows, it's a donor. If it has deployments rows, it's a hub. No label needed.
- `lat` / `lng` — no longer showing org locations on map; deployments aggregate by barangay

### 5. New Table: purchases

```sql
CREATE TABLE purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  aid_category_id uuid REFERENCES aid_categories(id) NOT NULL,
  quantity        integer NOT NULL,
  unit            text,
  cost            decimal(12,2),
  date            date DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
```

Records when an organization buys goods with donation money. Minimal on purpose — just category, quantity, cost.

### 6. Inventory (Calculated)

Available goods per category:

```
Available = SUM(purchases.quantity) - SUM(deployments.quantity WHERE status='received')
```

No stored inventory table — it's a query. Keeps things simple and avoids sync issues.

## Pipeline

```
Field reporter submits need (with category, beneficiary counts)
  → Coordinator verifies
    → Organization claims (deployment record created, status=pending)
      → Dispatch photo uploaded (optional, submission stays in_transit)
        → Delivery photo uploaded (submission → completed)
          → Coordinator resolves (submission → resolved, deployment → received)
```

- Resolved submissions leave the needs map
- Received deployments appear on the deployments page
- Delivery photo required as gate before resolved transition
- Resolve updates both records in one user action (two Supabase calls)

## Page Designs

### Needs Page (minimal changes)

- Submit form dropdown uses 9 unified categories (replaces Lunas/Sustenance/Shelter)
- Pin detail sheet shows category name from `aid_categories`
- New optional fields on submit: num_adults, num_children, num_seniors_pwd
- Resolved pins filtered out of the map
- Delivery photo required before completed → resolved transition

### Deployments Page (new, replaces deployment-related parts of Relief page)

**Top row — Summary cards:**
- Total Deliveries — count of received deployments
- People Served — sum of beneficiary counts from linked resolved submissions
- Barangays Reached — distinct barangay count from received deployments

**Main section — Barangay distribution map:**
- Proportional bubble markers centered on each barangay's coordinates
- Bubble size scales with total goods delivered to that barangay
- Click a bubble → popup with breakdown by aid category and quantities
- Future upgrade: choropleth with GeoJSON barangay boundaries

**Bottom section — Recent deployments:**
- Feed of individual deployments, sortable by date, filterable by barangay or category

### Relief Operations Page (new, replaces financial parts of Relief page)

No map — purely financial and inventory data.

**Top row — Summary cards:**
- Total Donations (₱ sum)
- Total Spent (₱ sum of purchase costs)
- Goods Available (total purchased minus deployed units)

**Left column — Donations & Purchases:**
- Donations by Organization (existing component, mostly unchanged)
- Recent Purchases list — org name, category, quantity, cost, date

**Right column — Available Inventory:**
- 9 aid categories as cards/tiles
- Each shows available count (purchased - deployed)
- Depleted categories grayed out
- This is the "what can we send out" view coordinators check before responding

### Report Page (expanded from Submit)

Replaces the current Submit page. Opens with a dropdown selector:

```
What would you like to report?
  ▾ Submit a Need (default)
    Report a Donation
    Report a Purchase
```

Selection swaps the form below. Default is "Submit a Need" since field reporters are the most common users.

**Form 1 — Submit a Need** (existing form, updated):
- Location (GPS auto-capture)
- Contact name, phone
- Barangay (dropdown)
- Aid category (dropdown — 9 unified categories)
- Access status (truck/4x4/boat/foot_only/cut_off)
- Urgency (low/medium/high/critical)
- Number of adults (optional)
- Number of children (optional)
- Number of seniors/PWDs (optional)
- Quantity needed (optional)
- Notes (optional)

**Form 2 — Report a Donation** (new):
- Organization (dropdown)
- Amount (₱)
- Date
- Notes (optional)

**Form 3 — Report a Purchase** (new):
- Organization (dropdown)
- Aid category (dropdown — 9 unified categories)
- Quantity
- Unit (optional — "boxes", "packs", etc.)
- Cost (₱)
- Date
- Notes (optional)

## Schema Migration Summary

1. Reseed `aid_categories` with 9 unified categories (drop old rows)
2. Add `aid_category_id` FK to `submissions`, migrate existing `gap_category` values
3. Drop `gap_category` and `type` columns from `submissions`
4. Add `num_adults`, `num_children`, `num_seniors_pwd` to `submissions`
5. Drop `recipient`, `volunteer_count`, `hours`, `lat`, `lng` from `deployments`
6. Drop `type`, `lat`, `lng` from `organizations`
7. Create `purchases` table
8. Update RLS policies for new table
9. Update seed/demo data to match new schema
