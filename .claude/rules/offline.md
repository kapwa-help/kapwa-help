---
paths:
  - "src/lib/cache.ts"
  - "src/lib/form-cache.ts"
  - "src/lib/outbox-context.tsx"
  - "src/lib/eager-cache.ts"
  - "vite.config.ts"
  - "src/components/maps/**"
---

# Offline & PWA

## Critical Rule

Service worker is only generated on production build. Use `npm run build && npm run preview` to test offline behavior.

## Dashboard Caching (`src/lib/cache.ts`)

Stale-while-revalidate with IndexedDB (DB version 6):
- Two cache keys: `reliefMap` (map page data) and `transparency` (transparency page data)
- On load: cached data renders immediately, fresh data fetched in background
- Auto-refresh on `online` event

## Map Tile Caching (`vite.config.ts`)

OSM tiles use Workbox CacheFirst strategy (cache name: `map-tiles`, max 200 tiles, 30-day expiry). `ReliefMapLeaflet` shows fallback overlay after 3 consecutive `tileerror` events; clears when tiles load again.

## Eager Reference Data Cache (`src/lib/eager-cache.ts`)

`useEagerCache()` runs at app mount (in `RootLayout`) — pre-fetches activeEvent, organizations, and aidCategories into IndexedDB so forms work offline. Re-fetches on `online` event.

## Offline Form Outbox (`src/lib/form-cache.ts` + `src/lib/outbox-context.tsx`)

- All four creation forms (need, donation, purchase, hazard) support offline submission
- Discriminated union outbox in IndexedDB — entries typed by `{ type: "need" | "donation" | "purchase" | "hazard" }`
- Client-generated UUIDs on all forms for idempotent sync (duplicate 23505 errors silently removed)
- Hazard entries store compressed photo Blobs; uploaded to Supabase Storage during flush
- Form dropdown data (aid categories, organizations, active event) cached in IndexedDB with cache-first loading
- `OutboxProvider` dispatches flush by entry type and auto-syncs on `online` event
