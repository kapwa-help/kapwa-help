# CLAUDE.md — LUaid.org

## Overview

Open-source PWA for disaster relief coordination in La Union, Philippines. Needs-first: field reporters submit needs (with gap category, access status, urgency), coordinators triage via map pins with lifecycle tracking (pending→verified→in_transit→completed→resolved). Also tracks donations, volunteer deployments, and aid distribution. Offline-first for low-connectivity disaster zones.

## Architecture

- **Frontend**: Vite + React SPA, react-router v7, TypeScript (strict)
- **Database**: Supabase (Postgres) — 7 tables, `events`-scoped, browser-side via anon key (RLS required)
- **Maps**: Leaflet + react-leaflet + OpenStreetMap — needs coordination map (status-colored pins, access filter) + deployment map
- **PWA**: vite-plugin-pwa (Workbox GenerateSW) for offline caching
- **i18n**: react-i18next with i18next-http-backend (`public/locales/`)
- **Testing**: Vitest + RTL (unit), Playwright (UI verification)

## Key Constraints

- **Zero-budget**: Free-tier services only. Volunteer-driven disaster relief.
- **Offline-first**: Everything works without internet. Cache aggressively, sync when online.
- **Non-technical users**: Keep UX simple for volunteers and relief coordinators.
- **Multilingual**: English, Filipino, and Ilocano at minimum.
- **Minimal dependencies**: Every dependency is a liability in disaster scenarios.

## Code Conventions

- TypeScript strict mode everywhere (`.ts`/`.tsx`)
- Tailwind CSS via `@tailwindcss/vite` — use semantic design tokens only, never arbitrary colors
- Environment variables use `VITE_` prefix via `import.meta.env`

## Commands

```bash
npm run dev            # Vite dev server (HMR, no service worker)
npm run build          # TypeScript check + production build (generates SW)
npm run preview        # Preview production build locally
npm run lint           # ESLint
npm test               # Vitest (once)
npm run test:watch     # Vitest (watch mode)
npm run translate      # Machine-translate new i18n keys to fil/ilo
npm run verify         # Playwright smoke tests (headless)
npm run verify:headed  # Playwright smoke tests (visible browser)
```

## Contributing

Main repo: `r0droald/LUaid`. Feature branches (`feat/<name>`, `fix/<name>`) -> PR to `main`.

## Lessons Learned

- `Problem:` Supabase JS client returns nested relations as `unknown` -> `Rule:` Cast join results explicitly in query functions
- `Problem:` PWA service worker only generated on production build -> `Rule:` Use `npm run build && npm run preview` to test offline behavior
- `Problem:` UI changes can break silently across locales and routes -> `Rule:` Run `npm run verify` after component, page, route, or i18n changes
