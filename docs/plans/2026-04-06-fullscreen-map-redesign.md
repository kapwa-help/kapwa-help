# Full-Screen Needs Map Redesign

**Date:** 2026-04-06
**Status:** Design approved
**Inspiration:** [KapwaNow](https://github.com/Nesqyk/kapwanow) — full-screen map with overlaid UI controls

## Motivation

The current Needs page wastes space around the map. The hero section, card wrapper, max-width constraint, and fixed map height all shrink the map — the most important element on the page. Coordinators need maximum map visibility to scan pin clusters, assess regional coverage, and triage needs.

The map should be the focal point. Everything else overlays on top or moves to the footer.

## Design

### Page Layout

```
┌─────────────────────────────────────────────────────┐
│ [Header / Nav - sticky]                             │
├─────────────────────────────────────────────────────┤
│ ┌─ status bar ──────────────────────────────┐       │
│ │ ● 3 Verified  ● 1 In transit  ● 4 Comp.  │       │
│ └───────────────────────────────────────────┘       │
│                                           ┌───────┐ │
│              FULL-SCREEN MAP              │Sidebar│ │
│           (Leaflet / OSM)                 │ List  │ │
│                                           │  ...  │ │
│                                           └───────┘ │
├─────────────────────────────────────────────────────┤
│ ● Online · Typhoon Emong · Updated 12:51 PM        │
└─────────────────────────────────────────────────────┘
```

- `<main>` becomes `flex-1` with no padding, no `max-w-7xl`.
- Map fills all space between Header and StatusFooter.
- Hero section removed entirely.
- Active event name + "Last Updated" timestamp move to StatusFooter.

### Overlays (Desktop)

**Status bar** — top of map:
- `absolute top-4 left-4 right-4 z-[500]`
- `bg-secondary/85 backdrop-blur-sm rounded-xl px-4 py-2`
- Same colored dots + counts from `STATUS_CONFIG`
- When sidebar is open: `right-[340px]` to avoid overlap

**Sidebar** — right edge of map:
- `absolute top-4 right-4 bottom-4 z-[500]`
- `w-[320px]`, `bg-secondary/90 backdrop-blur-sm rounded-xl`
- `hidden lg:flex flex-col`
- Contains scrollable needs list (`overflow-y-auto flex-1`)
- When pin selected: `PinDetailSheet variant="panel"` replaces the list

### Mobile Layout

**Default state:** Full-screen map with two overlays:
- Status bar at top (same as desktop, full width)
- Floating list button at bottom-left (`absolute bottom-4 left-4 z-[500]`) showing total needs count

**List button tapped:** Bottom sheet slides up (~60% viewport height) with scrollable needs list. Dismiss via ✕ or swipe down.

**Pin tapped (map or list item):** `PinDetailSheet variant="sheet"` slides up (existing behavior). If list sheet was open, it closes first.

```
Default (map only)
  ├── tap list button → Needs List sheet
  │     ├── tap list item → Pin Detail sheet
  │     └── tap ✕ → Default
  └── tap map pin → Pin Detail sheet
        └── tap ✕ → Default
```

### State Changes

One new piece of state in NeedsCoordinationMap:
```typescript
const [listOpen, setListOpen] = useState(false); // mobile list sheet
```

All existing state unchanged: `selectedPoint`, `statusOverrides`, sorted/filtered points.

### Z-Index Hierarchy

- Leaflet internals: 200-400
- Map overlays (status bar, sidebar, list button): 500
- Bottom sheets (PinDetailSheet): 1000

## File Changes

| File | Change |
|------|--------|
| `NeedsPage.tsx` | Remove hero section. Remove `max-w-7xl` / padding. `<main>` becomes `flex-1`. Pass event + timestamp to StatusFooter. |
| `NeedsCoordinationMap.tsx` | Remove card wrapper + grid layout. Become `relative w-full h-full`. Render overlays as absolute children. Add `listOpen` state + mobile list button. |
| `NeedsMap.tsx` | `h-[28rem]` → `h-full w-full`. |
| `StatusFooter.tsx` | Accept + render active event name and "Last Updated" timestamp. |
| `PinDetailSheet.tsx` | No changes. |
| `index.css` | Ensure `.leaflet-container { height: 100% }` if not already set. |

No new components. No new dependencies. No new queries.
