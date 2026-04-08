---
paths:
  - "src/lib/cache.ts"
  - "src/lib/form-cache.ts"
  - "src/lib/outbox-context.tsx"
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

## Offline Submit Form (`src/lib/form-cache.ts` + `src/lib/outbox-context.tsx`)

- Form dropdown options (aid categories) cached in IndexedDB
- Needs go into IndexedDB outbox queue with client-generated UUIDs (idempotent sync)
- Outbox flush handles junction table inserts (need → need_categories)
- `OutboxProvider` context manages queue and auto-syncs on `online` event
