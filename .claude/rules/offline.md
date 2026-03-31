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

Stale-while-revalidate with IndexedDB:
- `getCachedDashboard()` / `setCachedDashboard(data)` — stores entire `DashboardData` blob + timestamp
- On load: cached data renders immediately, fresh data fetched in background
- Hero section shows "Last Updated: [timestamp]" + "Offline" when `navigator.onLine` is false
- Auto-refresh on `online` event

## Map Tile Caching (`vite.config.ts`)

OSM tiles use Workbox CacheFirst strategy (cache name: `map-tiles`, max 200 tiles, 30-day expiry). `DeploymentMap` shows fallback overlay after 3 consecutive `tileerror` events; clears when tiles load again.

## Offline Submit Form (`src/lib/form-cache.ts` + `src/lib/outbox-context.tsx`)

- Form dropdown options (barangays) cached in IndexedDB
- Submissions go into IndexedDB outbox queue with client-generated UUIDs (idempotent sync)
- `OutboxProvider` context manages queue and auto-syncs on `online` event
