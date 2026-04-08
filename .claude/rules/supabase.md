---
paths:
  - "src/lib/supabase.ts"
  - "src/lib/queries.ts"
  - "supabase/**"
---

# Supabase Integration

## Client Setup

Browser-side Supabase client (`src/lib/supabase.ts`) uses anon key via `import.meta.env`. Safe for browser use — relies on RLS policies for access control.

## Typing Gotcha

The Supabase JS client returns nested relations as `unknown`. Cast join results explicitly:

```ts
// In query functions (src/lib/queries.ts)
row.organizations as unknown as { name: string }
```

## RLS Policies

Defined in `supabase/rls-policies.sql`:
- **Anon read**: SELECT on all 12 tables
- **Anon insert**: INSERT on `needs`, `need_categories`, `donations`, `donation_categories`, `purchases`, `purchase_categories`, `deployments`, `hazards`, `hub_inventory`
- **Anon update**: UPDATE on `needs` (demo phase — tighten when auth is implemented)

## Schema

Twelve tables, event-scoped. Full SQL in `supabase/schema.sql`.
All primary keys are UUIDs — designed for future offline sync with collision-free IDs.

- `events` — disaster operations that scope all data (e.g., "Typhoon Emong Relief")
- `organizations` — financial/accountability layer (no lat/lng — hubs are separate). Scoped by `event_id`
- `deployment_hubs` — operational/map layer with lat/lng. Independent from orgs. Scoped by `event_id`
- `aid_categories` — 9 unified categories (Hot Meals, Drinking Water, Water Filtration, Temporary Shelter, Clothing, Construction Materials, Medical Supplies, Hygiene Kits, Canned Food)
- `hub_inventory` — junction: which categories a hub currently has (no quantities)
- `needs` — demand side. Lifecycle: `pending→verified→in_transit→confirmed`. Multi-select categories via `need_categories` junction. Uses `num_people` for beneficiary count
- `need_categories` — junction: multi-select aid types per need
- `donations` — cash or in-kind. Cash: `amount`. In-kind: categories via `donation_categories` junction. Has `donor_name`, `donor_type`
- `donation_categories` — junction: multi-select for in-kind donations
- `purchases` — org spending. Categories via `purchase_categories` junction. No quantities — just `cost`
- `purchase_categories` — junction: multi-select per purchase
- `hazards` — freeform `description` (no type enum). Status: `active`/`resolved`. Has lat/lng
- `deployments` — fulfillment record. Links a hub to a confirmed need via `hub_id` + `need_id`

Key relationships: Everything scoped by `events`. `deployments.need_id` (UNIQUE) links fulfillment to the specific need. Hub inventory is a manual category checklist, not calculated.

## RPC Functions

Defined in `supabase/rpc-functions.sql`. All multi-table inserts use Postgres functions for transaction safety — parent row + junction rows are atomic (all-or-nothing).

- `insert_need` — need + need_categories
- `insert_donation` — donation + donation_categories
- `insert_purchase` — purchase + purchase_categories
- `create_deployment` — deployment + need status update

Client calls via `supabase.rpc("function_name", { params })`. Deploy path: run `rpc-functions.sql` after `schema.sql`.

## Seed Data

Demo data: `supabase/seed-demo.sql` (self-contained, idempotent).
Deploy path: drop all tables, run `schema.sql`, then `rpc-functions.sql`, then `seed-demo.sql`.
