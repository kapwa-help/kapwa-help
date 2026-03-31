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
| `/:locale` | Needs | Header (`Kapwa Help`), `<h1>`, locale `<select>`, `<nav>` |
| `/:locale/relief` | Relief | Header, `<h1>` |
| `/:locale/stories` | Stories | Header, `<h1>` |
| `/:locale/submit` | Submit Form | Header, `<h1>`, `<form>`, required fields (contact, barangay, access) |

Supported locales: `en`, `fil`, `ilo`

## Screenshots

Smoke tests save full-page screenshots to `tests/e2e/screenshots/`:
`needs-{en,fil,ilo}.png`, `relief-{en,fil,ilo}.png`, `stories-{en,fil,ilo}.png`, `submit-{en,fil,ilo}.png`

## Filtering Tests

```bash
npx playwright test --grep "needs"
npx playwright test --grep "relief"
npx playwright test --grep "stories"
npx playwright test --grep "submit"
npx playwright test --grep "locale switcher"
npx playwright test --grep "nav links"
```

## Troubleshooting

- Tests timeout -> Check dev server is running or let Playwright auto-start
- Chromium not found -> `npx playwright install chromium`
- Form fields not found -> Check Supabase env vars (form options load from Supabase or cache)
