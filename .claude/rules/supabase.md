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
- **Anon insert**: INSERT on `submissions` only

## Schema

Seven tables, event-scoped. Full SQL in `supabase/schema.sql`.
All primary keys are UUIDs — designed for future offline sync with collision-free IDs.

- `events` — disaster operations that scope all data (e.g., "Typhoon Emong Relief")
- `organizations` — donors and deployment hubs
- `aid_categories` — 7 pre-seeded aid types
- `barangays` — geographic aggregation
- `donations` — monetary contributions
- `submissions` — needs from the field. Follow pin lifecycle: `pending→verified→in_transit→completed→resolved`. Required fields: `gap_category` NOT NULL (lunas/sustenance/shelter), `access_status` NOT NULL (truck/4x4/boat/foot_only/cut_off), `urgency` NOT NULL (low/medium/high/critical)
- `deployments` — aid delivery events, optionally linked to a specific need via `submission_id`

Key relationships: `deployments` and `submissions` both reference `events` for disaster scoping. `deployments.submission_id` links a relief action to the specific need it fulfills.

## Seed Data

Demo data: `supabase/seed-demo.sql` (self-contained, idempotent).
Deploy path: drop all tables, run `schema.sql`, then `seed-demo.sql`.
