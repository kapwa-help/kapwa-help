# Data Model V1 — Simplified Marketplace

> Decided 2026-04-08 (Jacob + Hannah call)

## Core Concept

A marketplace: where goods are (hubs), who needs them (needs), communication between those two, full transparency on the back end. Track **people served**, not quantities.

## Key Design Decisions

- **Orgs and hubs are independent entities** — loosely coupled, linked only through activity (donations, notes)
- **No quantity tracking** — inventory is a category checklist, not counts
- **Beneficiaries (num_people) is the core metric** — replaces quantity-based tracking
- **Photos only on confirmation** — delivery photo required to confirm a need
- **Anyone can submit needs** — pending until coordinator verifies
- **Hubs can submit needs too** — nullable `hub_id` on needs
- **Hazards are freeform** — description + photo, no type enum dropdown
- **Barangays stripped for prototype** — too many to manage Philippines-wide
- **Aid categories are multi-select** — needs, donations, and purchases can reference multiple categories via junction tables

## Entity Relationship Diagram

```
events (scopes everything)
  │
  ├── organizations ←── donations (financial ledger)
  │                        └── donation_categories (junction)
  │
  ├── deployment_hubs ←── hub_inventory (junction, available aid checklist)
  │       │
  │       ├── deployments ──→ needs (hub fulfills need, created at confirmation)
  │       │
  │       └── needs (hub_id set = hub's own need)
  │
  ├── needs (hub_id null = community need)
  │    └── need_categories (junction)
  │
  ├── purchases (org spending record)
  │    └── purchase_categories (junction)
  │
  ├── hazards (map layer, freeform)
  │
  └── aid_categories (shared vocabulary for all junction tables)
```

## Tables

### events
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | DEFAULT gen_random_uuid() |
| name | text | no | |
| slug | text (unique) | no | URL-safe identifier |
| description | text | yes | |
| region | text | yes | |
| started_at | date | yes | |
| ended_at | date | yes | |
| is_active | boolean | no | DEFAULT true |
| created_at | timestamptz | no | DEFAULT now() |

### organizations
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| event_id | uuid FK → events | no | |
| name | text | no | |
| description | text | yes | |
| contact_info | text | yes | |
| created_at | timestamptz | no | DEFAULT now() |

### deployment_hubs
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| event_id | uuid FK → events | no | |
| name | text | no | |
| lat | decimal(9,6) | no | |
| lng | decimal(9,6) | no | |
| description | text | yes | |
| notes | text | yes | Freeform, shown in hub popup |
| created_at | timestamptz | no | DEFAULT now() |

### aid_categories
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| name | text (unique) | no | |
| icon | text | no | Emoji |

### hub_inventory (junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| hub_id | uuid FK → deployment_hubs | no | |
| aid_category_id | uuid FK → aid_categories | no | |
| UNIQUE(hub_id, aid_category_id) | | | No duplicate entries |

### needs
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | Client-generated UUID for offline-first |
| event_id | uuid FK → events | no | |
| hub_id | uuid FK → deployment_hubs | yes | NULL = community need, set = hub's own need |
| lat | decimal(9,6) | no | |
| lng | decimal(9,6) | no | |
| access_status | enum | no | truck, 4x4, boat, foot_only, cut_off |
| urgency | enum | no | low, medium, high, critical |
| status | enum | no | pending, verified, in_transit, confirmed |
| num_people | integer | no | Required — core metric |
| contact_name | text | no | |
| contact_phone | text | yes | |
| notes | text | yes | |
| delivery_photo_url | text | yes | Required when status = confirmed |
| created_at | timestamptz | no | DEFAULT now() |

### need_categories (junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| need_id | uuid FK → needs | no | ON DELETE CASCADE |
| aid_category_id | uuid FK → aid_categories | no | |
| UNIQUE(need_id, aid_category_id) | | | |

### donations
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| event_id | uuid FK → events | no | |
| organization_id | uuid FK → organizations | no | Who received |
| donor_name | text | yes | Who gave |
| donor_type | enum | yes | individual, organization |
| type | enum | no | cash, in_kind |
| amount | decimal(12,2) | yes | Required for cash, null for in_kind |
| date | date | no | |
| notes | text | yes | |
| created_at | timestamptz | no | DEFAULT now() |

### donation_categories (junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| donation_id | uuid FK → donations | no | ON DELETE CASCADE |
| aid_category_id | uuid FK → aid_categories | no | |
| UNIQUE(donation_id, aid_category_id) | | | Used for in_kind donations |

### purchases
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| event_id | uuid FK → events | no | |
| organization_id | uuid FK → organizations | no | |
| cost | decimal(12,2) | no | |
| date | date | no | |
| notes | text | yes | |
| created_at | timestamptz | no | DEFAULT now() |

### purchase_categories (junction)
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| purchase_id | uuid FK → purchases | no | ON DELETE CASCADE |
| aid_category_id | uuid FK → aid_categories | no | |
| UNIQUE(purchase_id, aid_category_id) | | | |

### hazards
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| event_id | uuid FK → events | no | |
| description | text | no | Freeform — replaces type dropdown |
| photo_url | text | yes | |
| latitude | double precision | no | |
| longitude | double precision | no | |
| status | enum | no | active, resolved |
| reported_by | text | yes | |
| created_at | timestamptz | no | DEFAULT now() |

### deployments
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid PK | no | |
| event_id | uuid FK → events | no | |
| hub_id | uuid FK → deployment_hubs | no | Which hub fulfilled |
| need_id | uuid FK → needs (unique) | no | Which need was fulfilled (1:1) |
| date | date | no | |
| notes | text | yes | |
| created_at | timestamptz | no | DEFAULT now() |

## Enums

- **access_status:** truck | 4x4 | boat | foot_only | cut_off
- **urgency:** low | medium | high | critical
- **need_status:** pending | verified | in_transit | confirmed
- **donation_type:** cash | in_kind
- **donor_type:** individual | organization
- **hazard_status:** active | resolved

## Need Lifecycle

```
pending → verified → in_transit → confirmed (photo required)
```

- **Pending:** grayed out on map, awaiting coordinator verification
- **Verified:** active on map, needs fulfillment
- **In transit:** hub has deployed, aid en route
- **Confirmed:** delivery photo submitted, off the map, into transparency ledger. Deployment record created.

## Transparency Ledger (derived, no separate table)

Summary cards:
- **Total donations** — SUM(donations.amount) WHERE type = cash
- **Total spent** — SUM(purchases.cost)
- **Total beneficiaries** — SUM(needs.num_people) WHERE status = confirmed

All data public. No admin wall on transparency.

## Map Layers

1. **Needs** — colored by status (pending gray, verified red, in_transit yellow). Confirmed needs hidden.
2. **Deployment Hubs** — show available aid categories + hub needs + notes.
3. **Hazards** — active hazards with description + photo.

## Seed Categories (defaults, customizable per event)

| Name | Icon |
|------|------|
| Hot Meals | 🍲 |
| Drinking Water | 💧 |
| Water Filtration | 🚰 |
| Temporary Shelter | 🏕️ |
| Clothing | 👕 |
| Construction Materials | 🔨 |
| Medical Supplies | 🏥 |
| Hygiene Kits | 🧼 |
| Canned Food | 🥫 |
