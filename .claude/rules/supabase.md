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
- **Anon read**: SELECT on all tables
- **Anon insert**: INSERT on `submissions`, `deployments`, `purchases`, and `hazards`
- **Anon update**: UPDATE on `submissions` and `deployments` (demo phase — tighten when auth is implemented)

## Schema

Nine tables, event-scoped. Full SQL in `supabase/schema.sql`.
All primary keys are UUIDs — designed for future offline sync with collision-free IDs.

- `events` — disaster operations that scope all data (e.g., "Typhoon Emong Relief")
- `organizations` — donors and deployment hubs (no type column — role derived from usage). Has optional `lat`/`lng` for hub map markers
- `aid_categories` — 9 unified categories (Hot Meals, Drinking Water, Water Filtration, Temporary Shelter, Clothing, Construction Materials, Medical Supplies, Hygiene Kits, Canned Food)
- `barangays` — geographic aggregation (lat/lng for map display)
- `donations` — monetary contributions
- `purchases` — goods bought with donation money, linked to org + aid category
- `submissions` — needs from the field. Follow pin lifecycle: `pending→verified→in_transit→completed→resolved`. Uses `aid_category_id` FK (not text). Includes `num_adults`, `num_children`, `num_seniors_pwd` for beneficiary counts. Required fields: `access_status` NOT NULL (truck/4x4/boat/foot_only/cut_off), `urgency` NOT NULL (low/medium/high/critical)
- `deployments` — aid delivery events, optionally linked to a specific need via `submission_id`
- `hazards` — field-reported hazard conditions (flood, landslide, road_blocked, bridge_out, electrical_hazard, other). Status: `active`/`resolved`. Has lat/lng for map display

Key relationships: `deployments` and `submissions` both reference `events` for disaster scoping. `deployments.submission_id` links a relief action to the specific need it fulfills. `purchases` track goods bought with donations — inventory = purchased minus deployed.

## Seed Data

Demo data: `supabase/seed-demo.sql` (self-contained, idempotent).
Deploy path: drop all tables, run `schema.sql`, then `seed-demo.sql`.
