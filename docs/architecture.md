# Architecture

## System Overview

Kapwa Help is a Vite + React SPA that fetches data from Supabase (Postgres) client-side and caches the entire app shell for offline use via a Workbox service worker. The architecture prioritizes simplicity — client-side fetch, render, cache — with room to grow into real-time updates and auth.

```
┌─────────────────────┐   client fetch    ┌──────────────┐
│   React SPA         │ ──────────────→   │   Supabase   │
│   (Vite + Router)   │                   │  (Postgres)  │
│                     │ ← JSON ────────   │              │
└──────────┬──────────┘                   └──────────────┘
           │
           │  precached shell
           ▼
┌─────────────────────┐
│   Service Worker     │  Workbox GenerateSW
│   (vite-plugin-pwa)  │  precaches shell, NetworkFirst for API
└─────────────────────┘
```

**Data flow:** React components call query functions in `src/lib/queries.ts` → Supabase client (`src/lib/supabase.ts`) fetches from Postgres using the anon key → the app shell is precached by the Workbox service worker → Supabase API calls use NetworkFirst caching → OSM map tiles use CacheFirst (200 tiles, 30-day expiry).

The Supabase anon key is safe for browser use — Row Level Security (RLS) policies control access.

### Code Splitting

The map component (`ReliefMapLeaflet`) is lazy-loaded via `React.lazy` to keep the main bundle small. A `MapSkeleton` loading state displays while the chunk downloads. The PWA service worker precaches all chunks, so this primarily improves first-visit performance.

## Routes

Three pages, all under locale-prefixed routes (`/:locale`):

| Route | Page | Purpose |
|-------|------|---------|
| `/:locale` | Relief Map | Full-screen map with need pins, hazard markers, hub markers, legend, and summary bar |
| `/:locale/transparency` | Transparency | Donation summaries, inventory levels, barangay equity, recent purchases |
| `/:locale/report` | Report | Multi-form reporter — submit needs, donations, purchases, or hazards |

Supported locales: `en` (English), `fil` (Filipino), `ilo` (Ilocano). Root `/` redirects to `/en`.

## Database Schema

Nine tables, event-scoped. All primary keys are UUIDs — designed for offline sync with collision-free IDs. Full SQL: `supabase/schema.sql`.

```
events ──┬──→ submissions (needs) ←── aid_categories
         │         ↑                       ↑   ↑
         │         │ submission_id          │   │
         ├──→ deployments ←── organizations │   │
         │                        │         │   │
         │                        └──→ donations (cash or in-kind)
         │                        │         │
         │                        └──→ purchases
         ├──→ hazards                       │
         │                                  │
         └───────────────────── barangays ←─┘
```

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `events` | Disaster operations that scope all data | name, slug, region, started_at, is_active |
| `organizations` | Donors and deployment hubs (no type column — role derived from usage) | name, municipality, lat/lng (optional, for hub map markers) |
| `aid_categories` | 9 unified categories | name, icon |
| `barangays` | Geographic aggregation | name, municipality, lat/lng, population |
| `donations` | Monetary or in-kind contributions | type (`cash`/`in_kind`), organization_id, amount (cash) or aid_category_id + quantity + unit (in-kind), date, notes |
| `purchases` | Goods bought with donation money | event_id, organization_id, aid_category_id, quantity, unit, cost, date |
| `submissions` | Needs from the field — pin lifecycle | event_id, status (`pending→verified→in_transit→completed→resolved`), aid_category_id, access_status, urgency, num_adults/children/seniors_pwd, lat/lng, photo URLs |
| `deployments` | Aid delivery events — optionally fulfills a specific need | event_id, organization_id, submission_id (optional), aid_category_id, quantity, status (`pending`/`received`) |
| `hazards` | Field-reported hazard conditions | event_id, hazard_type (`flood`/`landslide`/`road_blocked`/`bridge_out`/`electrical_hazard`/`other`), status (`active`/`resolved`), lat/lng |

**Aid categories** (Hannah's unified 9-category list): Hot Meals, Drinking Water, Water Filtration, Temporary Shelter, Clothing, Construction Materials, Medical Supplies, Hygiene Kits, Canned Food.

**Inventory formula:** Available inventory = (in-kind donations + purchases) − deployments.

### RLS Policies

Defined in `supabase/rls-demo.sql` (demo project) and `supabase/rls-prod.sql` (prod project):
- **Anon read:** SELECT on all tables
- **Anon insert:** INSERT on submissions, deployments, donations, purchases, hazards
- **Anon update:** UPDATE on submissions and deployments

Demo phase — write policies will be tightened when auth is implemented.

### Query Functions

`src/lib/queries.ts` provides 25 typed functions organized by domain:

**Relief Map:**
- `getNeedsMapPoints()` — need pins with lat/lng, status, category, access, urgency
- `getDeploymentHubs()` — hub markers with org info and deployment counts
- `getHazards()` — hazard markers with type and status

**Transparency Dashboard:**
- `getTotalDonations()` — sum of cash donations
- `getTotalSpent()` — sum of purchase costs
- `getTotalBeneficiaries()` / `getPeopleServed()` — beneficiary counts
- `getDonationsByOrganization()` — donations grouped by org
- `getGoodsByCategory()` — quantities by aid category
- `getBarangayDistribution()` — distribution equity across barangays
- `getAvailableInventory()` — current inventory levels (donations + purchases − deployments)
- `getRecentDeployments()` / `getRecentPurchases()` — recent activity feeds

**Form Support:**
- `getActiveEvent()` — current active disaster event
- `getBarangays()` — all barangays (form dropdowns)
- `getAidCategories()` — all aid categories
- `getOrganizations()` — all organizations

**Writes:**
- `insertSubmission()` — field need report
- `insertDonation()` — cash or in-kind donation
- `insertPurchase()` — purchase record
- `insertHazard()` — hazard report
- `createDeploymentForNeed()` — link a deployment to a need (claim flow)
- `updateSubmissionStatus()` / `updateDeploymentStatus()` — lifecycle transitions

## Seed Data

Demo data: `supabase/seed-demo.sql` (self-contained, idempotent). Deploy path: drop all tables → run `schema.sql` → run `seed-demo.sql`.

Historical KML data from Typhoon Emong relief operations is in `data/Emong_relief_operations.kml` (55 deployment points across 6 organizations).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Vite + React SPA | Client-side routing works offline natively; no server required |
| Backend | Supabase (free tier) | Postgres + Auth + Realtime at zero cost |
| Data fetching | Client-side (anon key + RLS) | Entire app shell precacheable; API calls cached via Workbox |
| Routing | react-router v7 | Client-side routing, locale via URL params, works offline |
| PWA | vite-plugin-pwa (Workbox GenerateSW) | Precaches shell, navigateFallback to index.html, runtime caching |
| Primary keys | UUIDs | Collision-free IDs for offline sync from multiple devices |
| Schema | Needs-first, event-scoped | Events scope all data. Submissions (needs) are primary with pin lifecycle. Deployments fulfill needs |
| Data entry | Report form + Supabase table editor | Field-facing multi-form with offline outbox; table editor for admin bulk entry |
| Categories | 9 unified list | Hannah's consolidated list replaces separate dashboard/gap categories |
| Donations model | Cash + in-kind | Single `donations` table with type discriminator and CHECK constraints |

## Offline Strategy

- **App shell:** Workbox precaches all JS/CSS/HTML chunks. NavigateFallback to `index.html`.
- **Dashboard data:** Stale-while-revalidate via IndexedDB (`src/lib/cache.ts`). Cached data renders immediately; fresh data fetched in background.
- **Map tiles:** CacheFirst for OSM tiles (200 tiles, 30-day expiry). Fallback overlay after 3 consecutive tile errors.
- **Submit form:** Dropdown options cached in IndexedDB. Submissions queued in IndexedDB outbox with client-generated UUIDs. `OutboxProvider` context auto-syncs on `online` event.
- **Offline indicator:** Shows "Offline" when `navigator.onLine` is false. Auto-refreshes on reconnect.

## Internationalization

Locale-based routing via react-router: `/:locale` (`en`, `fil`, `ilo`). Translation files in `public/locales/`. `RootLayout` syncs i18n language with URL param. Language switcher in Header navigates between locale routes.

Machine translation: `npm run translate` uses `google-translate-api-x` (free, no API key) to incrementally translate new keys. Human review via Crowdin.

## Further Reading

- `docs/plans/` — Design documents for each implementation phase
- `docs/project-history.md` — Origin story and project direction
- `docs/scope.md` — KapwaRelief charter and product scope
