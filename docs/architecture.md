# Architecture

## System Overview

LUaid is a Vite + React SPA that fetches data from Supabase (Postgres) client-side and caches the entire app shell for offline use via a Workbox service worker. Content comes from a WordPress CMS. The architecture prioritizes simplicity — client-side fetch, render, cache — with room to grow into forms, real-time updates, and offline sync.

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

**Data flow:** React components call query functions in `src/lib/queries.ts` → Supabase client (`src/lib/supabase.ts`) fetches from Postgres using the anon key → the entire app shell is precached by the Workbox service worker → Supabase API calls use NetworkFirst caching strategy.

The Supabase anon key is safe for browser use — it relies on Row Level Security (RLS) policies to control access.

### Code Splitting

The DeploymentMap component (Leaflet + react-leaflet) is lazy-loaded via `React.lazy` to keep the main bundle under 600 KB. A `MapSkeleton` loading state displays while the map chunk downloads. The PWA service worker precaches all chunks, so this primarily improves first-visit performance.

## Database Schema

Six tables, centered around the `deployments` table which represents individual aid delivery events.

```
organizations ──┬──→ donations
                │
                └──→ deployments ←── aid_categories
                         │
                         └──→ barangays (optional grouping)
```

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `organizations` | Donors and deployment hubs | name, type (donor/hub/both), municipality, lat/lng |
| `aid_categories` | Lookup table for aid types | name, icon (7 pre-seeded categories) |
| `barangays` | Geographic aggregation | name, municipality, lat/lng, population |
| `donations` | Monetary contributions | organization_id, amount, date |
| `deployments` | Aid delivery events (core table) | organization_id, aid_category_id, barangay_id, quantity, unit, recipient, lat/lng, date |
| `submissions` | Aid requests and field feedback | type (request/feedback), contact info, barangay_id, aid_category_id, urgency, rating, status |

All primary keys are UUIDs — designed for future offline sync where multiple devices need collision-free IDs.

Full SQL schema: `supabase/schema.sql`

### Query Functions

`src/lib/queries.ts` provides 11 typed functions — 8 for the dashboard and 3 for the submit form:

| Function | Returns |
|----------|---------|
| `getTotalDonations()` | Sum of all donation amounts |
| `getTotalBeneficiaries()` | Sum of deployment quantities |
| `getVolunteerCount()` | Sum of volunteer counts |
| `getDonationsByOrganization()` | Donations grouped by org, sorted by amount |
| `getDeploymentHubs()` | Deployment count per org + municipality |
| `getGoodsByCategory()` | Quantities grouped by aid category |
| `getDeploymentMapPoints()` | Lat/lng points with metadata for map pins |
| `getBeneficiariesByBarangay()` | Beneficiary totals grouped by barangay |
| `getBarangays()` | All barangays ordered by name (for form dropdowns) |
| `getAidCategories()` | All aid categories ordered by name (for form dropdowns) |
| `insertSubmission(data)` | Inserts an aid request or feedback submission |

## Seed Data

Real deployment data from Typhoon Emong relief operations is stored in `data/Emong_relief_operations.kml` — 55 deployment points across 6 organizations. The seed script (`supabase/seed-kml.ts`) parses the KML and inserts organizations + deployments into Supabase.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Vite + React SPA | Client-side routing works offline natively; no server required. Next.js RSC payload fetches on every navigation conflict with offline-first. |
| Backend | Supabase (free tier) | Postgres + Auth + Realtime at zero cost. Google Sheets had 60 req/min limits, no relational queries, no auth |
| Data fetching | Client-side (anon key + RLS) | Entire app shell precacheable; API calls cached via Workbox NetworkFirst |
| Routing | react-router v7 | Client-side routing, locale via URL params (`/:locale`), works offline |
| PWA | vite-plugin-pwa (Workbox GenerateSW) | Precaches entire shell, navigateFallback to index.html, runtime caching for API |
| Primary keys | UUIDs | Collision-free IDs for future offline sync from multiple devices |
| Schema design | Deployment-centric | Real KML data shows every aid delivery is a located event — one core table |
| Data entry (MVP) | Supabase table editor | No forms to build yet, fastest path to real data |

## Internationalization

Locale-based routing via react-router URL params: `/:locale` (en, fil, ilo). Translation files in `public/locales/`. Client-side language detection via `i18next-browser-languagedetector` with path-based lookup. `RootLayout` component syncs the i18n language with the URL param. A language switcher dropdown in the Header lets users switch between English, Filipino, and Ilocano — navigating to the corresponding `/:locale` route.

## Offline Caching

The dashboard uses a stale-while-revalidate pattern backed by IndexedDB:

- **Cache utility** (`src/lib/cache.ts`): Two functions — `getCachedDashboard()` and `setCachedDashboard(data)`. Stores the entire `DashboardData` blob + timestamp in a single IndexedDB object store.
- **Data flow**: On page load, cached data renders immediately. Fresh data is fetched in the background and replaces the cache on success.
- **Offline indicator**: The hero section shows "Last Updated: [timestamp]" and appends "· Offline" when `navigator.onLine` is false.
- **Auto-refresh**: When the browser regains connectivity (`online` event), the dashboard automatically re-fetches.
- **Map tiles** (`vite.config.ts` runtimeCaching): OSM tiles use CacheFirst strategy (cache name: `map-tiles`, max 200 tiles, 30-day expiry). When tiles fail to load, `DeploymentMap` shows a fallback overlay after 3 consecutive `tileerror` events; the overlay clears automatically when tiles load again.
- **Future**: Per-query caching can be added when additional pages (barangay triage board, forms) need to share cached query results.

## What's Built vs Planned

**Built:**
- Vite + React SPA with vite-plugin-pwa service worker
- Client-side locale routing (en, fil, ilo) via react-router v7
- Supabase schema, client, query functions, and RLS policies (anon read access)
- KML seed script with real Typhoon Emong data
- Vitest testing framework
- Dashboard page with client-side data fetching wired to all components
- 7 dashboard components (Header, SummaryCards, DonationsByOrg, DeploymentHubs, GoodsByCategory, AidDistributionMap, StatusFooter) with tests
- i18n wired into all dashboard components — all user-facing strings use `t()` translation keys
- Language switcher in Header (English / Filipino / Ilocano dropdown)
- Interactive Leaflet map (`DeploymentMap`) with deployment markers, popups, and empty-state handling (#7)
- Offline dashboard caching (#10) — IndexedDB stale-while-revalidate with auto-refresh
- Offline map tile caching (#37) — Workbox CacheFirst for OSM tiles with fallback overlay
- Submit form page (SubmitForm + SubmitPage) with aid request / feedback toggle (#11)
- Submissions table with anon INSERT + SELECT RLS policies

**Planned (see GitHub Issues):**
- Offline form submissions (#10) — IndexedDB write queue + background sync for submit form
- Barangay triage (#15) — status board reading from submissions table
- CMS integration (#13) — WordPress content via REST API

## Further Reading

- `docs/plans/` — Design documents for each implementation phase
- `docs/project-history.md` — Origin story and project direction
