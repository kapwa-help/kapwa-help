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
| `primary` | `#0E9AA7` | Buttons, links, navigation highlights (warm teal) |
| `secondary` | `#24282e` | Card backgrounds (warm slate) |
| `accent` | `#F0C456` | Highlights, status indicators (soft gold) |
| `success` | `#388E3C` | Positive values, online status, monetary amounts |
| `warning` | `#FFA000` | Caution states |
| `error` | `#D32F2F` | Errors, map markers |
| `neutral-50` | `#FFFFFF` | Primary text (headings, values) |
| `neutral-100` | `#F3F0ED` | Secondary text (warm off-white) |
| `neutral-400` | `#9CA3AF` | Muted text, borders, labels (true gray) |
| `base` | `#1a1d21` | Page background (warm ink) |

## Theme

Single dark theme. Dark `bg-base` background with `bg-secondary` card surfaces.

## Common Patterns

- **Cards (default):** `rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]`
- **Cards (status-coded, Needs page only):** `rounded-2xl border-l-2 border-{status} bg-secondary p-5 shadow-[...]` — use colored left accent only when the color encodes a meaningful status (e.g., error=active, warning=transit, success=fulfilled)
- **Buttons:** `bg-primary hover:bg-primary/80 text-neutral-50 rounded-lg px-4 py-2`
- **Opacity variants:** Use `/` syntax — `text-neutral-400/60`, `border-neutral-400/20`, `bg-error/20`

## Font

Nunito Variable loaded locally via `@fontsource-variable/nunito` (no CDN — offline-first). Rounded terminals give approachable personality. Weight 700 (bold) for metric/KPI numbers.

## Leaflet Override

`.leaflet-popup-content-wrapper` uses `color: var(--color-base)` so popup text stays on-brand. Leaflet CSS imported globally in `src/index.css`.

## Known Limitations

- Bar chart palette (`DonationsByOrg`) uses 5 semantic colors + 3 opacity variants. With 6+ orgs, faded variants are hard to distinguish (Issue #32).
- `neutral-50`, `neutral-100`, `neutral-400` shadow Tailwind's built-in neutral palette.
