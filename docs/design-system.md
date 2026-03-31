# Design System

Production reference for Kapwa Help's implemented design tokens and styling patterns. Source of truth is `src/index.css`.

## Typography

**Font:** Inter Variable, loaded locally via `@fontsource-variable/inter` (no CDN — offline-first).

Fallback stack: `"Inter Variable", Inter, Arial, sans-serif`

## Color Tokens

Defined in `src/index.css` via Tailwind v4 `@theme inline`. Use semantic class names — never arbitrary Tailwind colors.

| Token | Hex | Tailwind Classes | Usage |
|-------|-----|------------------|-------|
| `primary` | `#1976D2` | `bg-primary`, `text-primary` | Buttons, links, navigation highlights |
| `secondary` | `#263238` | `bg-secondary` | Card backgrounds |
| `accent` | `#FFC107` | `bg-accent`, `text-accent` | Highlights, status indicators |
| `success` | `#388E3C` | `bg-success`, `text-success` | Positive values, online status, monetary amounts, live indicators |
| `warning` | `#FFA000` | `bg-warning`, `text-warning` | Caution states |
| `error` | `#D32F2F` | `bg-error`, `text-error` | Errors, map markers |
| `neutral-50` | `#FFFFFF` | `text-neutral-50` | Primary text (headings, values) |
| `neutral-100` | `#F5F5F5` | `text-neutral-100` | Secondary text |
| `neutral-400` | `#B0BEC5` | `text-neutral-400`, `border-neutral-400` | Muted text, borders, labels |
| `base` | `#1a252b` | `bg-base` | Page background |

## Theme

Single dark theme. No light mode currently implemented.

- **Page background:** `bg-base` (#1a252b)
- **Card surfaces:** `bg-secondary` (#263238) with `border-neutral-400/20` borders
- **Primary text:** `text-neutral-50` (white)
- **Muted text:** `text-neutral-400`
- **Dividers:** `divide-neutral-400/20`

## Common Patterns

### Cards

All dashboard cards follow this pattern:

```
rounded-xl border border-neutral-400/20 bg-secondary p-6
```

### Buttons

```
bg-primary hover:bg-primary/80 text-neutral-50 rounded-lg px-4 py-2
```

### Opacity Variants

Use Tailwind's `/` opacity syntax for subtle variations:

- `text-neutral-400/60` — de-emphasized secondary text (percentages, timestamps)
- `border-neutral-400/20` — subtle card borders and dividers
- `bg-base/30` — faint background tints
- `bg-error/20` — light badge backgrounds (errors, alerts)
- `bg-success/20` — light badge backgrounds (live status, positive indicators)

## Third-Party Overrides

| Selector | Override | Reason |
|----------|----------|--------|
| `.leaflet-popup-content-wrapper` | `color: var(--color-base)` | Leaflet popups default to dark text on white background — uses the `base` token so popup text stays on-brand |

Leaflet CSS is imported globally in `src/index.css` via `@import "leaflet/dist/leaflet.css"`.

## Known Limitations

- **Bar chart palette (Issue #32):** `DonationsByOrg` uses 5 semantic colors + 3 opacity variants. With 6+ organizations, the faded variants are hard to distinguish from the originals.
- **Neutral scale override:** `neutral-50`, `neutral-100`, `neutral-400` shadow Tailwind's built-in neutral palette with custom values. Only these three stops are defined.
- **No light mode:** The dashboard is dark-only. A light theme would require a separate design pass.
