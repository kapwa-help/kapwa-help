# UI Verification Protocol

How to verify UI changes with Playwright.

## Quick Verification

```bash
npm run verify          # Headless — all smoke tests
npm run verify:headed   # Headed — watch tests run in browser
```

All 9 smoke tests should pass. Any failure means a UI regression.

## Route Reference

| Route | Page | Key Elements |
|-------|------|-------------|
| `/:locale` | Dashboard | Header (`LUaid.org`), `<h1>`, locale `<select>`, summary cards |
| `/:locale/submit` | Submit Form | Header, `<h1>`, `<form>`, type toggle buttons, required fields (`#contact_name`, `#barangay_id`, `#aid_category_id`), submit button |

Supported locales: `en`, `fil`, `ilo`

## Taking Screenshots

Smoke tests automatically save full-page screenshots to `tests/e2e/screenshots/`:

| File | Content |
|------|---------|
| `dashboard-en.png` | Dashboard in English |
| `dashboard-fil.png` | Dashboard in Filipino |
| `dashboard-ilo.png` | Dashboard in Ilocano |
| `submit-en.png` | Submit page in English |
| `submit-fil.png` | Submit page in Filipino |
| `submit-ilo.png` | Submit page in Ilocano |

For ad-hoc screenshots of a specific URL:

```bash
npx playwright screenshot http://localhost:5173/en screenshot.png
```

## Checking Specific Tests

Use `--grep` to filter tests:

```bash
npx playwright test --grep "dashboard"       # Only dashboard tests
npx playwright test --grep "submit"          # Only submit page tests
npx playwright test --grep "locale switcher" # Only locale switcher test
npx playwright test --grep "redirect"        # Only redirect tests
```

## Form Interaction Verification

Use Playwright's codegen tool to interactively test form flows:

```bash
npx playwright codegen http://localhost:5173/en/submit
```

This opens a browser with a recording panel — interact with the form and Playwright generates the test code.

## Locale Switching Verification

The smoke tests verify locale switching automatically. To manually test:

```bash
npx playwright test --grep "locale switcher" --headed
```

## Offline Behavior Testing

Offline testing requires a production build (service worker is only generated on build):

```bash
npm run build && npm run preview
# Then test against http://localhost:4173 instead of :5173
```

Note: The Playwright config's `webServer` targets the dev server on :5173. For offline testing, start the preview server manually and run Playwright with a different base URL:

```bash
npx playwright test --config=playwright.config.ts --grep "dashboard" \
  --project=chromium
```

## When to Verify

Run `npm run verify` after changing:
- Components or pages
- Routes or navigation
- i18n translations or locale logic
- Design tokens or styling
- Form structure or validation

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests timeout | Check that dev server is running (`npm run dev`) or let Playwright auto-start it |
| Port 5173 in use | Stop other dev servers or use `reuseExistingServer: true` (default) |
| Chromium not found | Run `npx playwright install chromium` |
| Screenshots not generated | Tests must pass — screenshots are taken at the end of each test |
| Flaky locale tests | Ensure translation JSON files exist in `public/locales/{en,fil,ilo}/` |
| Form fields not found | Check that Supabase env vars are set (form options load from Supabase or cache) |
