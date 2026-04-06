# Unified Relief Map Redesign

## Motivation

The current app splits map views across two pages (Needs, Deployments) with a third data-only page (Relief Operations). In disaster relief, coordinators need a single "common operating picture" — one map showing all relevant layers. This redesign consolidates map views into a unified Relief Map and merges non-map data into a Relief Transparency page.

Inspired by KapwaNow's single-map approach with legend-driven filtering.

## Page Structure

### Before (4 pages)
| Route | Page |
|-------|------|
| `/:locale` | Needs (map) |
| `/:locale/deployments` | Deployments (map) |
| `/:locale/relief-operations` | Relief Operations (data) |
| `/:locale/report` | Report (forms) |

### After (3 pages)
| Route | Page |
|-------|------|
| `/:locale` | **Relief Map** — unified full-screen map |
| `/:locale/transparency` | **Relief Transparency** — all public data |
| `/:locale/report` | **Report** — forms (need, donation, purchase, hazard) |

Header nav: Relief Map | Transparency | Report (button, right side)

---

## Relief Map

Full-screen Leaflet map with three marker layers, all ON by default.

### Marker Layers

| Layer | Marker Style | Data Source | Toggle |
|-------|-------------|-------------|--------|
| Needs | Colored dots by status (pending=gray, verified=red, in_transit=yellow, completed=green) | `submissions` | Checkbox |
| Deployment Hubs | Distinct warehouse/box icon | `organizations` where lat/lng is not null | Checkbox |
| Hazards | Warning triangle icon | `hazards` | Checkbox |

### UI Overlays

**Summary Bar** (top center, always visible):
- "X Active Needs · Y Hubs · Z Hazards"
- "Active Needs" = submissions with status `verified` or `in_transit`

**Legend Panel** (bottom left):
- Three toggleable layers (checkbox per layer)
- Needs sub-legend shows status colors (display-only, not individually filterable)
- Deployment Hubs shows hub icon
- Hazards shows hazard icon

**Zoom Controls** (bottom right on desktop, top right on mobile):
- Stays visible even when detail panel is open

**Detail Panel** (right side desktop / bottom sheet mobile):
- Empty by default — no panel until a marker is tapped
- Slides in on marker tap, adapts content by marker type:
  - **Need**: same pin detail sheet (status, urgency, contact, claim actions)
  - **Hub**: org name, barangay, inventory summary (purchased minus deployed)
  - **Hazard**: type, description, photo, reported by, status
- Close via X button or clicking the map

### Desktop Layout

```
Default:
┌──────────────────────────────────────────┐
│  [Header]                                │
├──────────────────────────────────────────┤
│           [Summary Bar]                  │
│                                          │
│                 MAP                      │
│                                          │
│  ┌─────────┐                    ┌───┐    │
│  │ Legend   │                    │ + │    │
│  └─────────┘                    │ - │    │
│                                 └───┘    │
├──────────────────────────────────────────┤
│  [StatusFooter]                          │
└──────────────────────────────────────────┘

Marker selected:
┌──────────────────────────────┬───────────┐
│  [Header]                    │           │
├──────────────────────────────┤  Detail   │
│           [Summary Bar]      │  Panel    │
│                       ┌───┐  │  (320px)  │
│  ┌─────────┐          │ + │  │           │
│  │ Legend   │          │ - │  │           │
│  └─────────┘          └───┘  │           │
├──────────────────────────────┤           │
│  [StatusFooter]              │           │
└──────────────────────────────┴───────────┘
```

---

## Relief Transparency Page

Scrollable data page, no map. Public-facing accountability view.

### Layout (top to bottom)

1. **Summary Cards** (3 cards, horizontal row)
   - Total Donations (sum of monetary donations)
   - Total Spent (sum of purchase costs)
   - Available Balance (donations minus spent)

2. **Available Inventory** (full-width table)
   - Grid by aid category: purchased minus deployed = available

3. **Barangay Equity** (full-width table)
   - Each barangay, aid categories received, total quantities

4. **Two-column grid**
   - Left: **Donations by Organization**
   - Right: **Recent Purchases**

Mobile: everything stacks single-column.

---

## Data Model Changes

### Modified: `organizations`

Add lat/lng back (removed in PR #79). Any org with coordinates displays as a hub on the map.

```sql
ALTER TABLE organizations
  ADD COLUMN lat decimal(9,6),
  ADD COLUMN lng decimal(9,6);
```

### New: `hazards`

```sql
CREATE TABLE IF NOT EXISTS hazards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id),
  hazard_type text NOT NULL CHECK (hazard_type IN (
                'flood', 'landslide', 'road_blocked',
                'bridge_out', 'electrical_hazard', 'other'
              )),
  description text,
  photo_url   text,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  reported_by text,
  created_at  timestamptz DEFAULT now()
);
```

RLS: anon SELECT + INSERT (same pattern as submissions).

### No changes to:
- `events`, `aid_categories`, `barangays`, `donations`, `purchases`, `submissions`, `deployments`

---

## Report Page Changes

Add fourth form type to the form selector:

1. Need (existing `SubmitForm`)
2. Donation (existing `DonationForm`)
3. Purchase (existing `PurchaseForm`)
4. **Hazard** (new `HazardForm`)

### HazardForm fields:
- **Hazard type** — dropdown: Flood, Landslide, Road Blocked, Bridge Out, Electrical Hazard, Other
- **Description** — text area
- **Photo** — file input (stores URL in `photo_url`, upload deferred)
- **Location** — lat/lng via geolocation (same pattern as need submission)
- **Reported by** — text, optional

---

## Components to Create
- `ReliefMap.tsx` — unified coordination map wrapper (replaces `NeedsCoordinationMap` + `DeploymentsCoordinationMap`)
- `MapLegend.tsx` — toggleable legend panel
- `HubDetailPanel.tsx` — hub detail content for the unified detail panel
- `HazardDetailPanel.tsx` — hazard detail content for the unified detail panel
- `HazardForm.tsx` — report page form
- `BarangayEquity.tsx` — transparency page table

## Components to Remove
- `DeploymentsCoordinationMap.tsx`
- `DeploymentsPage.tsx`
- `BarangayBubbleMap.tsx`
- `BarangayDetailPanel.tsx`

## Components to Move
- `OperationsSummaryCards.tsx` — stays, used by Relief Transparency page

## Components Unchanged
- `NeedsMap.tsx` — still renders need markers, now as one layer in unified map
- `PinDetailSheet.tsx` — still renders need details in the unified detail panel
- `SubmitForm.tsx`, `DonationForm.tsx`, `PurchaseForm.tsx` — unchanged
