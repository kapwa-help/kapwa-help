# CLAUDE.md — LUaid.org

## Project Overview

LUaid.org is an open-source Progressive Web App for disaster relief operations in La Union, Philippines. It tracks and visualizes donations, volunteer deployments, and aid distribution. Designed for offline-first use in low-connectivity disaster zones.

## Architecture

- **Frontend**: Vite + React SPA with react-router v7, TypeScript (strict mode)
- **Database**: Supabase (Postgres) — browser-side via anon key (RLS required)
- **Maps**: Leaflet + react-leaflet + OpenStreetMap (interactive deployment map on dashboard)
- **PWA**: vite-plugin-pwa (Workbox GenerateSW) for offline caching
- **i18n**: react-i18next with i18next-http-backend (loads from `public/locales/`)
- **Testing**: Vitest + React Testing Library (unit), Playwright (UI verification)

See `docs/architecture.md` for system design details and schema overview.

## Contributing

Main repo: `r0droald/LUaid`. Feature branches (`feat/<name>`, `fix/<name>`) → PR to `main`.

See `docs/setup.md` for local development setup.

- **Before opening a PR**: If your changes affect architecture, schema, project structure, or the design system, update the relevant doc in `docs/` and the Project Structure / Architecture sections of this file.

## Key Constraints

- **Zero-budget first**: Prefer free-tier services. The project serves volunteer-driven disaster relief.
- **Offline-first**: Everything must work without internet. Cache aggressively, sync when online.
- **Non-technical users**: Volunteers, writers, and relief coordinators use this. Keep UX simple.
- **Multilingual**: Must support English, Filipino, and Ilocano at minimum.
- **Minimal dependencies**: Every dependency is a liability in disaster scenarios.

## Code Conventions

- TypeScript strict mode — all source, test, and config files use `.ts`/`.tsx`
- Vite SPA with client-side routing (react-router v7)
- Tailwind CSS for styling (via `@tailwindcss/vite` plugin)
- Components in `src/components/`, pages in `src/pages/`, query functions in `src/lib/queries.ts`
- Environment variables use `VITE_` prefix via `import.meta.env`

## Design System

All UI uses semantic design tokens defined in `src/index.css` via Tailwind v4 `@theme`. **Never use arbitrary Tailwind colors** (e.g., `bg-blue-500`) — use tokens instead (e.g., `bg-primary`).

- **Font**: Inter Variable loaded locally via `@fontsource-variable/inter` (offline-first)
- **Theme**: Single dark theme — dark base background with charcoal card surfaces
- **Tokens**: `primary`, `secondary`, `accent`, `success`, `warning`, `error`, `neutral-{50,100,400}`, `base`

See `docs/design-system.md` for the full token reference and component styling patterns.

## Commands

```bash
npm run dev          # Vite dev server (HMR, no service worker)
npm run build        # TypeScript check + Vite production build (generates SW)
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm test             # Run tests (Vitest, once)
npm run test:watch   # Run tests (watch mode)
npm run translate    # Machine-translate new i18n keys to fil/ilo
npm run verify       # Playwright smoke tests (headless)
npm run verify:headed # Playwright smoke tests (visible browser)
```

## Project Structure

```
src/
  main.tsx            # App entry point (ReactDOM + RouterProvider)
  index.css           # Global styles + Tailwind v4 @theme tokens
  i18n.ts             # i18next config (HTTP backend, language detection)
  router.tsx          # Client-side routes (react-router v7)
  vite-env.d.ts       # Vite type declarations
  components/
    RootLayout.tsx    # Locale-aware layout (syncs i18n + html lang)
    Header.tsx        # Site header with navigation + language switcher
    SummaryCards.tsx   # Dashboard summary cards
    DonationsByOrg.tsx
    DeploymentHubs.tsx
    GoodsByCategory.tsx
    AidDistributionMap.tsx
    StatusFooter.tsx
    SubmitForm.tsx    # Aid request / feedback form component
    dashboard/        # Dashboard-specific components (planned)
    forms/            # Form components (planned)
    maps/             # Map components (DeploymentMap.tsx, MapSkeleton.tsx)
    shared/           # Shared UI components (planned)
  pages/
    DashboardPage.tsx # Live dashboard (index route)
    SubmitPage.tsx    # Aid request / feedback form (/:locale/submit)
  hooks/              # Custom React hooks (planned)
  lib/
    supabase.ts       # Supabase client (anon key via import.meta.env)
    queries.ts        # Typed query functions for dashboard + submit form
    cache.ts          # IndexedDB cache for offline dashboard data
    form-cache.ts     # IndexedDB cache for form dropdown options (offline submit)
    outbox-context.tsx # React context + provider for offline submission queue
supabase/
  schema.sql          # Database schema (6 tables)
  rls-policies.sql    # Row-level security policies (anon read + submissions insert)
  seed-kml.ts         # KML parser → Supabase seed script
  seed-demo.sql       # Demo data for prototype dashboard
scripts/
  translate.ts        # Machine-translate i18n keys (google-translate-api-x)
data/                 # Real relief operation data (KML exports)
public/
  locales/            # Translation files ({en,fil,ilo}/translation.json)
  icons/              # PWA icons
index.html            # SPA entry point
vite.config.ts        # Vite config (React, Tailwind, PWA, tsconfig paths)
vitest.config.ts      # Vitest test runner config
eslint.config.mjs     # ESLint v9 config
tests/
  setup.ts            # Vitest setup
  unit/               # Vitest unit tests
  e2e/
    smoke.spec.ts     # Playwright smoke tests (9 tests)
    screenshots/      # Auto-generated screenshots (gitignored PNGs)
docs/                 # Architecture, setup guide, design system, i18n, plans
playwright.config.ts  # Playwright config (Chromium only, auto-starts dev server)
```

## Lessons Learned

- `Problem:` Supabase JS client returns nested relations as `unknown` types → `Rule:` Cast join results explicitly (e.g., `row.organizations as unknown as { name: string }`) in query functions
- `Problem:` PWA service worker only generated on production build → `Rule:` Use `npm run build && npm run preview` to test offline behavior
- `Problem:` UI changes can break silently across locales and routes → `Rule:` Run `npm run verify` after component, page, route, or i18n changes
