# Deployments Page Redesign

## Goal

Replace the current card-based Deployments page with a full-screen map layout mirroring the Needs page. The map becomes the primary interface — barangays are labeled markers, recent deployments live in a right sidebar, and clicking a barangay reveals its full delivery history in a left detail panel.

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header (Needs | Deployments | Relief Ops)           │
├──────────────────────────────────────┬──────────────┤
│                                      │              │
│  [stats pills - top center]          │  Recent      │
│                                      │  Deployments │
│       Full-screen Leaflet Map        │  (10 items,  │
│    (labeled barangay markers)        │   scrollable)│
│                                      │              │
│  [barangay detail - left panel]      │              │
│  (appears on marker click)           │              │
│                                      │              │
├──────────────────────────────────────┴──────────────┤
│ StatusFooter                                        │
└─────────────────────────────────────────────────────┘
```

- **Desktop:** Two overlay panels on the map — right sidebar (always visible), left panel (on selection)
- **Mobile:** FAB toggles recent deployments bottom sheet. Marker tap opens barangay detail bottom sheet.

## Map Markers

Fixed-size dots with barangay name labels using Leaflet `DivIcon`. No size scaling by quantity — the dot says "this barangay received aid" and the detail panel provides the numbers. Use `primary` color for the dot, `neutral-50` for the label text on a `secondary/85` backdrop.

Clicking a marker:
1. Sets the selected barangay
2. Opens the left detail panel
3. Centers/flies the map to that barangay

## Right Sidebar — Recent Deployments

Overlay: `absolute top-4 right-4 bottom-4 w-[320px] bg-secondary/90 backdrop-blur-sm rounded-xl`

Content:
- Header: "Recent Deployments" with count
- Scrollable list of the 10 most recent deployments (reduced from 20)
- Each row: category icon + name, org -> barangay (municipality), quantity + unit, date
- Clicking a row flies the map to that barangay and opens its detail panel

Mobile:
- Hidden. FAB button (bottom-right) toggles a bottom sheet with the same list
- Tapping an item closes the sheet, flies to barangay, opens detail sheet

## Left Detail Panel — Barangay Breakdown

Overlay: `absolute top-4 left-4 bottom-4 w-[320px] bg-secondary/90 backdrop-blur-sm rounded-xl`

Content:
- Header: Barangay name + municipality, close button
- Summary: Total items delivered, number of distinct categories
- Category breakdown: Each aid category with icon, name, total quantity (from `barangayDistribution[].categories`)
- Deployment history: Full list of all `received` deployments to this barangay — org name, category icon + name, quantity + unit, date. Fetched from database (not limited to recent 10)

Mobile:
- Bottom sheet (same pattern as PinDetailSheet) with identical content

Both panels can coexist on desktop — the right sidebar stays visible when the left panel is open.

## Stats Pills

Horizontal row of compact pills overlaying the top center of the map (between the two sidebars on desktop). Same style as Needs page status legend: `bg-secondary/85 backdrop-blur-sm rounded-full px-3 py-1`.

Three pills:
- Total deliveries (count of all received deployments)
- People served (sum of resolved submissions' beneficiary counts)
- Barangays reached (count of distinct barangays with deployments)

## Data Layer Changes

### queries.ts

- `getBarangayDistribution(eventId)` — fetch all `received` deployments (no limit). Return per-barangay: id, name, municipality, lat, lng, categories (with totals), and individual deployments (org, category, quantity, unit, date) for the detail panel
- `getRecentDeployments(eventId)` — reduce `.limit(20)` to `.limit(10)`
- `getPeopleServed(eventId)` — unchanged

### cache.ts

- Update `DeploymentsData` type: `barangayDistribution` entries gain a `deployments` array for the detail panel history
- Remove `totalDeliveries` and `barangaysReached` from top level (derive from data)

## File Changes

### New files
- `src/components/DeploymentsCoordinationMap.tsx` — orchestrator component (parallel to NeedsCoordinationMap). Owns: map, right sidebar, left detail panel, stats pills, mobile sheets/FABs
- `src/components/BarangayDetailPanel.tsx` — left panel content (barangay breakdown + deployment history)

### Modified files
- `src/pages/DeploymentsPage.tsx` — simplify to match NeedsPage structure (h-dvh, flex-col, Header, main with overflow-hidden, StatusFooter)
- `src/components/maps/BarangayBubbleMap.tsx` — replace CircleMarkers with DivIcon labeled markers, remove bubble sizing, add click handler for barangay selection
- `src/components/RecentDeployments.tsx` — adapt into sidebar/bottom-sheet format with fly-to-barangay click handler
- `src/lib/queries.ts` — update getBarangayDistribution to include per-barangay deployments, reduce recent limit to 10
- `src/lib/cache.ts` — update DeploymentsData type

### Deleted files
- `src/components/DeploymentSummaryCards.tsx` — stats move to pills inside DeploymentsCoordinationMap

### Updated files
- `public/locales/{en,fil,ilo}/translation.json` — new i18n keys for detail panel, pills, mobile sheets
- Tests updated to match new component structure

## Implementation Order

1. **Data layer** — Update queries.ts (barangay distribution with deployments, limit 10) and cache.ts types
2. **Map markers** — Replace BarangayBubbleMap CircleMarkers with labeled DivIcon markers, add click handler
3. **DeploymentsCoordinationMap** — New orchestrator with stats pills, right sidebar (RecentDeployments adapted), left detail panel (BarangayDetailPanel), mobile FAB + bottom sheets
4. **DeploymentsPage** — Simplify to NeedsPage structure, render DeploymentsCoordinationMap
5. **Cleanup** — Delete DeploymentSummaryCards, update i18n, update tests
6. **Verify** — `npm test`, `npm run build`, `npm run verify`
