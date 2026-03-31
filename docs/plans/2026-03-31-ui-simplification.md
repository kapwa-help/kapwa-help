# UI Simplification — Selective Rollback of Aesthetic Upgrade

**Date:** 2026-03-31
**Branch:** `feat/ui-simplification` (off `main`)
**Context:** The `feat/aesthetic-upgrade` branch introduced visual polish across all pages. Some changes add value (Nunito font, teal palette, button glows, header shadow). Others add unnecessary complexity for a mobile-first disaster relief app. This branch selectively rolls back the overreach.

## Principle

**Left-accent borders only where color encodes status.** Everywhere else, use the uniform subtle border. Animations that delay data visibility get removed entirely.

## Changes

### Remove globally
- **Grain texture overlay** (`body::after` in index.css) — extra compositing layer for no visual payoff on mobile
- **fadeSlideUp animation** (keyframes + `.animate-fade-slide-up` class in index.css) — 400ms delay before data is readable
- **Card hover lift** (`hover:-translate-y-0.5` + hover shadow) — useless on touch devices
- **Font weight bump** (`font-extrabold` → `font-bold`) — extrabold is heavier than needed

### Needs page — keep left accents, soften
- **NeedsSummaryCards**: Keep color-coded left borders (red=active, yellow=transit, green=fulfilled, red=critical) but reduce from 3px to 2px
- **NeedsCoordinationMap**: Revert to subtle border — map pins already carry status colors

### Relief Operations page — revert borders
- **SummaryCards**: Revert to `border border-neutral-400/20`
- **DonationsByOrg**: Revert to `border border-neutral-400/20`
- **DeploymentHubs**: Revert to `border border-neutral-400/20`
- **GoodsByCategory**: Revert to `border border-neutral-400/20`
- **AidDistributionMap**: Revert to `border border-neutral-400/20`

### Submit Form — revert borders
- **SubmitForm container** (in SubmitPage.tsx): Revert to subtle border — yellow accent reads as warning state

### Keep as-is
- Nunito font
- Teal color palette
- Header shadow (replaces old border-bottom)
- Report button glow
- Pinging status dot in footer
- `rounded-2xl` card corners
- Form input padding (`px-4 py-3`) and `rounded-xl` inputs
- Card box shadows (non-hover)

## Files to modify
1. `src/index.css` — remove grain texture, animation keyframes, animation class
2. `src/components/NeedsSummaryCards.tsx` — soften border to 2px, remove animation/hover classes
3. `src/components/NeedsCoordinationMap.tsx` — revert to subtle border
4. `src/components/SummaryCards.tsx` — revert border, remove animation/hover
5. `src/components/DonationsByOrg.tsx` — revert border
6. `src/components/DeploymentHubs.tsx` — revert border, revert extrabold
7. `src/components/GoodsByCategory.tsx` — revert border, revert extrabold
8. `src/components/AidDistributionMap.tsx` — revert border
9. `src/components/SubmitForm.tsx` — revert border on container (via SubmitPage.tsx if needed)
