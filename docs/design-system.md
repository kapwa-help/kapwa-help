# Design System

Production reference for Kapwa Help's design tokens and styling patterns. Source of truth: `src/index.css` via Tailwind v4 `@theme inline`.

## Typography

Three font families, all loaded locally (no CDN — offline-first):

| Font | Weight | Usage | Package / Source |
|------|--------|-------|------------------|
| **Karla Variable** | Regular | Body text | `@fontsource-variable/karla` |
| **Rubik Variable** | Regular | Headings (`h1`–`h6`) | `@fontsource-variable/rubik` |
| **Kagitingan Bold** | Bold | Logo only (`font-logo` utility) | Custom, `public/fonts/Kagitingan-Bold.otf` |

Fallback stack: `"Karla", Arial, sans-serif` (body), `"Rubik", Arial, sans-serif` (headings).

## Color Tokens

Use semantic class names — **never arbitrary Tailwind colors** (e.g., `bg-blue-500`).

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

Single dark theme. No light mode.

- **Page background:** `bg-base` — deep navy
- **Card surfaces:** `bg-secondary` — midnight blue
- **Primary text:** `text-neutral-50` — white
- **Secondary text:** `text-neutral-100` — cool off-white
- **Muted text / borders:** `text-neutral-400` / `border-neutral-400` — soft teal

## Common Patterns

### Cards (default)

```
rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]
```

### Cards (status-coded, Needs page only)

```
rounded-2xl border-l-2 border-{status} bg-secondary p-5 shadow-[...]
```

Use a colored left accent border only when the color encodes a meaningful status (e.g., `error` = active need, `warning` = in transit, `success` = fulfilled).

### Buttons

```
bg-primary hover:bg-primary/80 text-neutral-50 rounded-lg px-4 py-2
```

### Opacity Variants

Use Tailwind's `/` opacity syntax for subtle variations:

- `text-neutral-400/60` — de-emphasized secondary text
- `border-neutral-400/20` — subtle card borders and dividers
- `bg-error/20` — light badge backgrounds (errors, alerts)
- `bg-success/20` — light badge backgrounds (positive indicators)

## Third-Party Overrides

| Selector | Override | Reason |
|----------|----------|--------|
| `.leaflet-popup-content-wrapper` | `color: var(--color-base)` | Leaflet popups default to dark text on white — uses `base` token so popup text stays on-brand |
| `.leaflet-control-zoom` | `display: none` on mobile (`max-width: 1023px`) | Touch devices use pinch-to-zoom; buttons waste space |

Leaflet CSS is imported globally in `src/index.css` via `@import "leaflet/dist/leaflet.css"`.

## Known Limitations

- **Bar chart palette (Issue #32):** `DonationsByOrg` uses 5 semantic colors + 3 opacity variants. With 6+ organizations, faded variants are hard to distinguish.
- **Neutral scale override:** `neutral-50`, `neutral-100`, `neutral-400` shadow Tailwind's built-in neutral palette with custom values. Only these three stops are defined.
