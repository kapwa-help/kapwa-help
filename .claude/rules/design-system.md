---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/index.css"
---

# Design System

Source of truth: `src/index.css` via Tailwind v4 `@theme inline`.

## Critical Rule

**Never use arbitrary Tailwind colors** (e.g., `bg-blue-500`). Always use semantic tokens (e.g., `bg-primary`).

## Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#007EA7` | Buttons, links, navigation highlights (cerulean) |
| `secondary` | `#003249` | Card backgrounds (midnight blue) |
| `accent` | `#80CED7` | Highlights, status indicators (light cyan) |
| `success` | `#10B981` | Positive values, online status, monetary amounts |
| `warning` | `#FBBF24` | Caution states |
| `error` | `#FF6B6B` | Errors, map markers |
| `neutral-50` | `#FFFFFF` | Primary text (headings, values) |
| `neutral-100` | `#CCDBDC` | Secondary text (cool off-white) |
| `neutral-400` | `#9AD1D4` | Muted text, borders, labels (soft teal) |
| `base` | `#001A26` | Page background (deep navy) |

## Theme

Single dark theme. Dark `bg-base` background with `bg-secondary` card surfaces.

## Common Patterns

- **Cards (default):** `rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]`
- **Cards (status-coded, Needs page only):** `rounded-2xl border-l-2 border-{status} bg-secondary p-5 shadow-[...]` — use colored left accent only when the color encodes a meaningful status (e.g., error=active, warning=transit, success=fulfilled)
- **Buttons:** `bg-primary hover:bg-primary/80 text-neutral-50 rounded-lg px-4 py-2`
- **Opacity variants:** Use `/` syntax — `text-neutral-400/60`, `border-neutral-400/20`, `bg-error/20`

## Fonts

- **Body + Headings:** System UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`). Zero bytes — uses OS-native fonts.
- **Logo:** Kagitingan Bold (custom, loaded from `public/fonts/Kagitingan-Bold.otf` via `@font-face`; use `font-logo` utility). Uses `font-display: swap`.
- **Not precached by SW** — Kagitingan is `.otf` and `workbox.globPatterns` in `vite.config.ts` matches only `woff2`. Intentional: saves ~45 kB on first install; logo degrades to sans-serif on rare cold-offline case.
- **No npm font packages** — do not reintroduce `@fontsource-variable/*` without a conscious reversal of this tradeoff.

## Leaflet Override

`.leaflet-popup-content-wrapper` uses `color: var(--color-base)` so popup text stays on-brand. Leaflet CSS imported globally in `src/index.css`.

## Known Limitations

- Bar chart palette (`DonationsByOrg`) uses 5 semantic colors + 3 opacity variants. With 6+ orgs, faded variants are hard to distinguish (Issue #32).
- `neutral-50`, `neutral-100`, `neutral-400` shadow Tailwind's built-in neutral palette.
