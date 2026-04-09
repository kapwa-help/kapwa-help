---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "tests/e2e/**"
  - "playwright.config.ts"
---

# UI Verification

## When to Run

Run `npm run verify` after changing:
- Components or pages
- Routes or navigation
- i18n translations or locale logic
- Design tokens or styling
- Form structure or validation

## Commands

```bash
npm run verify          # Headless — all smoke tests
npm run verify:headed   # Headed — watch in browser
```

## Routes

| Route | Page | Key Elements |
|-------|------|-------------|
| `/:locale` | Relief Map | Header, map with legend, summary bar, zoom controls |
| `/:locale/dashboard` | Dashboard | Header, `<h1>`, summary cards, inventory, barangay equity |
| `/:locale/report` | Report | Header, `<h1>`, form selector (need/donation/purchase/hazard) |

Supported locales: `en`, `fil`, `ilo`

## Screenshots

Smoke tests save full-page screenshots to `tests/e2e/screenshots/`:
`relief-map-{en,fil,ilo}.png`, `transparency-{en,fil,ilo}.png`, `report-{en,fil,ilo}.png`, `mobile-nav.png`

## Filtering Tests

```bash
npx playwright test --grep "relief map"
npx playwright test --grep "transparency"
npx playwright test --grep "report"
npx playwright test --grep "locale switcher"
npx playwright test --grep "nav links"
npx playwright test --grep "mobile hamburger"
```

## Troubleshooting

- Tests timeout -> Check dev server is running or let Playwright auto-start
- Chromium not found -> `npx playwright install chromium`
- Form fields not found -> Check Supabase env vars (form options load from Supabase or cache)
