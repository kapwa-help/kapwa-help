# UI Verification Protocol

How to verify UI changes with Playwright. Human-readable reference — see `.claude/rules/verification.md` for the agent-scoped version.

## Quick Verification

```bash
npm run verify          # Headless — all smoke tests
npm run verify:headed   # Headed — watch tests run in browser
```

All smoke tests should pass. Any failure means a UI regression.

## Route Reference

| Route | Page | Key Elements |
|-------|------|-------------|
| `/:locale` | Relief Map | Header, map with legend, summary bar, zoom controls |
| `/:locale/dashboard` | Transparency | Header, `<h1>`, summary cards, inventory, barangay equity |
| `/:locale/report` | Report | Header, `<h1>`, form-type selector (need / hazard / donation / purchase) |
| `/:locale/login` | redirect | → Flood Watch login (`/floodwatch/login`), an email+password form |
| `/auth/callback` | redirect | → Flood Watch login (`/floodwatch/login`), an email+password form |

Supported locales: `en`, `fil`, `ilo`. The `/:locale/transparency` path 302s to `/:locale/dashboard` for legacy links.

## Taking Screenshots

Smoke tests save full-page screenshots to `tests/e2e/screenshots/`:

- `relief-map-{en,fil,ilo}.png`
- `transparency-{en,fil,ilo}.png`
- `report-{en,fil,ilo}.png`
- `mobile-nav.png`

For ad-hoc screenshots of a specific URL:

```bash
npx playwright screenshot http://localhost:5173/en screenshot.png
```

## Filtering Tests

```bash
npx playwright test --grep "relief map"
npx playwright test --grep "dashboard"
npx playwright test --grep "report"
npx playwright test --grep "locale switcher"
npx playwright test --grep "nav links"
npx playwright test --grep "mobile hamburger"
npx playwright test --grep "redirect"
```

## Form Interaction Verification

Use Playwright's codegen tool to interactively test form flows:

```bash
npx playwright codegen http://localhost:5173/en/report
```

The report page is a type selector that renders one of four forms (need, hazard, donation, purchase). Donation and purchase forms only render for signed-in admins.

## Offline Behavior Testing

Offline testing requires a production build — the Vite dev server does not generate a service worker:

```bash
npm run build && npm run preview
# Then test against http://localhost:4173 instead of :5173
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
| Tests timeout | Check dev server is running (`npm run dev`) or let Playwright auto-start it |
| Port 5173 in use | Stop other dev servers or use `reuseExistingServer: true` (default) |
| Chromium not found | Run `npx playwright install chromium` |
| Screenshots not generated | Tests must pass — screenshots are taken at the end of each test |
| Form fields not found | Check Supabase env vars are set (form options load from Supabase or cache) |
| Flaky locale tests | Ensure translation JSON files exist in `public/locales/{en,fil,ilo}/` |
