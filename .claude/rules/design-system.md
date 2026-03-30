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
| `primary` | `#1976D2` | Buttons, links, navigation highlights |
| `secondary` | `#263238` | Card backgrounds |
| `accent` | `#FFC107` | Highlights, status indicators |
| `success` | `#388E3C` | Positive values, online status, monetary amounts |
| `warning` | `#FFA000` | Caution states |
| `error` | `#D32F2F` | Errors, map markers |
| `neutral-50` | `#FFFFFF` | Primary text (headings, values) |
| `neutral-100` | `#F5F5F5` | Secondary text |
| `neutral-400` | `#B0BEC5` | Muted text, borders, labels |
| `base` | `#1a252b` | Page background |

## Theme

Single dark theme. Dark `bg-base` background with `bg-secondary` card surfaces.

## Common Patterns

- **Cards:** `rounded-xl border border-neutral-400/20 bg-secondary p-6`
- **Buttons:** `bg-primary hover:bg-primary/80 text-neutral-50 rounded-lg px-4 py-2`
- **Opacity variants:** Use `/` syntax — `text-neutral-400/60`, `border-neutral-400/20`, `bg-error/20`

## Font

Inter Variable loaded locally via `@fontsource-variable/inter` (no CDN — offline-first).

## Leaflet Override

`.leaflet-popup-content-wrapper` uses `color: var(--color-base)` so popup text stays on-brand. Leaflet CSS imported globally in `src/index.css`.

## Known Limitations

- Bar chart palette (`DonationsByOrg`) uses 5 semantic colors + 3 opacity variants. With 6+ orgs, faded variants are hard to distinguish (Issue #32).
- `neutral-50`, `neutral-100`, `neutral-400` shadow Tailwind's built-in neutral palette.
