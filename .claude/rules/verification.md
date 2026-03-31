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
npm run verify          # Headless — all 9 smoke tests
npm run verify:headed   # Headed — watch in browser
```

## Routes

| Route | Page | Key Elements |
|-------|------|-------------|
| `/:locale` | Dashboard | Header (`Kapwa Help`), `<h1>`, locale `<select>`, summary cards |
| `/:locale/submit` | Submit Form | Header, `<h1>`, `<form>`, required fields (contact, barangay, gap category, access, urgency) |

Supported locales: `en`, `fil`, `ilo`

## Screenshots

Smoke tests save full-page screenshots to `tests/e2e/screenshots/`:
`dashboard-{en,fil,ilo}.png`, `submit-{en,fil,ilo}.png`

## Filtering Tests

```bash
npx playwright test --grep "dashboard"
npx playwright test --grep "submit"
npx playwright test --grep "locale switcher"
```

## Troubleshooting

- Tests timeout -> Check dev server is running or let Playwright auto-start
- Chromium not found -> `npx playwright install chromium`
- Form fields not found -> Check Supabase env vars (form options load from Supabase or cache)
