# Architecture

## System Overview

Kapwa Help is a Vite + React SPA that fetches data from Supabase (Postgres) client-side and caches the app shell for offline use via a Workbox service worker. The architecture prioritizes simplicity — client-side fetch, render, cache — with magic-link auth gating admin writes.

```
┌─────────────────────┐   client fetch    ┌──────────────┐
│   React SPA         │ ──────────────→   │   Supabase   │
│   (Vite + Router)   │                   │  (Postgres)  │
│                     │ ← JSON ────────   │  + Auth      │
└──────────┬──────────┘                   └──────────────┘
           │
           │  precached shell
           ▼
┌─────────────────────┐
│   Service Worker     │  Workbox GenerateSW
│   (vite-plugin-pwa)  │  precaches shell and public map tiles
└─────────────────────┘
```

**Data flow:** React components call query functions in `src/lib/queries.ts` → Supabase client (`src/lib/supabase.ts`) fetches from Postgres using the anon key → the app shell is precached by the Workbox service worker → OSM map tiles use CacheFirst caching. Supabase requests are never cached by the service worker because their responses can depend on the caller's authorization token.

The Supabase anon key is safe for browser use — Row Level Security (RLS) policies control access. Admins authenticate via Supabase magic link; the `admin_users` table gates write access to sensitive records (donations, purchases, deployments, need-lifecycle updates).

### Code Splitting

Route pages (`ReliefMapPage`, `TransparencyPage`, `ReportPage`, `LoginPage`, `AuthCallbackPage`) are lazy-loaded via `React.lazy` + `lazyWithReload` to keep the main bundle small and to recover gracefully from stale chunk hashes after a deploy. The PWA service worker precaches all chunks, so splitting primarily improves first-visit performance.

## Routes

Client-side routing via react-router v7. Locale-prefixed under `/:locale`.

| Route | Page | Purpose |
|-------|------|---------|
| `/` | redirect | → `/en` |
| `/:locale` | Relief Map | Full-screen map: need pins, hazard markers, hub markers, legend, summary bar |
| `/:locale/dashboard` | Transparency | Donation totals, inventory levels, barangay equity, recent activity |
| `/:locale/transparency` | redirect | → `/:locale/dashboard` (legacy URL, preserved for external links) |
| `/:locale/report` | Report | Multi-form reporter — need / hazard, plus donation / purchase for admins |
| `/:locale/login` | Login | Magic-link sign-in for admins |
| `/auth/callback` | Auth callback | Supabase OAuth redirect target |

Supported locales: `en` (English), `fil` (Filipino), `ilo` (Ilocano).

## Database Schema

Fourteen tables total — thirteen event-scoped + `admin_users` (global). All primary keys are UUIDs for collision-free IDs across offline devices. Full SQL: `supabase/schema.sql`.

### Tables

| Table | Purpose |
|-------|---------|
| `events` | Disaster operations that scope all other data |
| `admin_users` | Keyed by `auth.uid()`; presence grants admin via `is_admin()` RLS helper |
| `organizations` | Financial/accountability layer (donors, implementing partners) |
| `deployment_hubs` | Operational/map layer with lat/lng — independent from orgs |
| `hub_inventory` | Junction: which aid categories a hub currently has (checklist, no quantities) |
| `aid_categories` | 9 unified categories |
| `needs` | Field-reported demand. Lifecycle: `pending → verified → in_transit → confirmed`. `num_people` for beneficiary count |
| `need_categories` | Junction: multi-select aid types per need |
| `donations` | Cash (`amount`) or in-kind. `donor_type` = `individual` / `organization` |
| `donation_categories` | Junction: multi-select for in-kind donations |
| `purchases` | Org spending. No quantities — just `cost` |
| `purchase_categories` | Junction: multi-select per purchase |
| `hazards` | Freeform `description` (no type enum). Status: `active` / `resolved` |
| `deployments` | Fulfillment record linking a hub to a confirmed need. Schema-only — no active UI renders deployments today |

**Aid categories** (Hannah's unified 9-category list): Hot Meals, Drinking Water, Water Filtration, Temporary Shelter, Clothing, Construction Materials, Medical Supplies, Hygiene Kits, Canned Food.

### RLS Policies

Two policy sets:

- **`supabase/rls-demo.sql`** — demo project, permissive. Anon can SELECT/INSERT/UPDATE across all tables.
- **`supabase/rls-prod.sql`** — prod project, auth-gated. Anon reads go through PII-stripped views (`needs_public`, `hazards_public`); anon can only INSERT `needs` / `need_categories` / `hazards`; donations, purchases, deployments, and need-lifecycle updates are admin-only via the `is_admin()` helper.

Admins are provisioned via an invite-only flow: edge function → `auth.admin.inviteUserByEmail` → `handle_new_user` trigger (gated on `invited_at IS NOT NULL`) inserts into `admin_users`.

### RPC Functions

Defined in `supabase/rpc-functions.sql`. All multi-table inserts use Postgres functions for transaction safety — parent row + junction rows are atomic.

- `insert_need` — need + need_categories
- `insert_donation` — donation + donation_categories
- `insert_purchase` — purchase + purchase_categories
- `create_deployment` — deployment + need status update

Clients call via `supabase.rpc("function_name", { params })`.

### Query Functions

`src/lib/queries.ts` exposes typed functions organized by domain. See the file for the full list; highlights:

- **Relief Map:** `getNeedsMapPoints`, `getDeploymentHubs`, `getHazards`
- **Transparency:** `getTotalDonations`, `getTotalSpent`, `getTotalBeneficiaries`, `getDonationsByOrganization`, `getBarangayDistribution`
- **Form support:** `getActiveEvent`, `getAidCategories`, `getOrganizations`

## Seed Data

Demo data: `supabase/seed-demo.sql` (self-contained, idempotent).

**Deploy path (bootstrapping a fresh Supabase project):**

1. Drop all tables
2. Run `supabase/schema.sql`
3. Run `supabase/rpc-functions.sql`
4. Run `supabase/rls-demo.sql` (or `rls-prod.sql` for auth-gated)
5. Run `supabase/seed-demo.sql`

Historical KML data from Typhoon Emong relief operations is archived under `data/Emong_relief_operations.kml`.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Vite + React SPA | Client-side routing works offline natively; no server required |
| Backend | Supabase (free tier) | Postgres + Auth + Realtime at zero cost |
| Data fetching | Client-side (anon key + RLS) | Entire app shell precacheable; API calls cached via Workbox |
| Routing | react-router v7 | Client-side routing, locale via URL params, works offline |
| PWA | vite-plugin-pwa (Workbox GenerateSW) | Precaches shell, navigateFallback to index.html, runtime caching |
| Primary keys | UUIDs | Collision-free IDs for offline sync from multiple devices |
| Schema shape | Event-scoped, junction-table categories | Events scope all data. Multi-category selects via junctions avoid denormalization |
| Multi-row writes | Postgres RPC functions | Transaction safety — parent + junction rows insert atomically |
| Auth | Supabase magic link + `admin_users` gate | No password UX; admin status is a DB-level concern not a claim in the JWT |
| Categories | 9 unified aid categories | Hannah's consolidated list replaces separate dashboard/gap categories |

## Offline Strategy

- **App shell:** Workbox precaches JS/CSS/HTML chunks. NavigateFallback to `index.html`.
- **Dashboard data:** Stale-while-revalidate via IndexedDB (`src/lib/cache.ts`). Cached data renders immediately; fresh data fetched in background.
- **Map tiles:** CacheFirst for OSM tiles (200 tiles, 30-day expiry). Fallback overlay after 3 consecutive tile errors.
- **Report form:** Dropdown options cached in IndexedDB. Submissions queued in IndexedDB outbox with client-generated UUIDs. `OutboxProvider` auto-syncs on `online` event.
- **Offline indicator:** Shows "Offline" when `navigator.onLine` is false. Auto-refreshes on reconnect.

## Internationalization

Locale-based routing via react-router: `/:locale` (`en`, `fil`, `ilo`). Translation files in `public/locales/`. `RootLayout` syncs i18n language with URL param. Language switcher in Header navigates between locale routes.

Machine translation: `npm run translate` uses `google-translate-api-x` (free, no API key) to incrementally translate new keys. Human review via Crowdin.

## Further Reading

- `docs/project-history.md` — Origin story and project direction
- `docs/scope.md` — KapwaRelief charter and product scope
- `docs/loading-performance-findings.md` — Performance investigation reference
- `.claude/rules/` — Agent-scoped how-to files (supabase, design-system, i18n, offline, verification)
