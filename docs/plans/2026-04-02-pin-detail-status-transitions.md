# Pin Detail Panel & Status Transitions (#60 + #61)

**Date:** 2026-04-02
**PR:** B (parallelizable with PR A / #59)
**Size:** Medium-large

## Overview

Replace the current lightweight Leaflet popup on the needs coordination map with a bottom sheet panel showing full submission details and status transition controls. This enables coordinators to view all need information and advance submissions through their lifecycle (`pending → verified → in_transit → completed → resolved`) directly from the map.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Form factor | Bottom sheet (slides up ~60% of viewport) | Standard mobile map pattern; keeps pin visible in context |
| Relationship to sidebar | Coexist | Sidebar serves browse/filter; sheet serves act-on-one-pin |
| Transition controls | All forward statuses shown as buttons | Coordinators may need to skip steps when reality moves ahead |
| Offline behavior | Block with message, disable buttons | Avoids sync/conflict complexity for demo phase |
| Pending pins on map | No — keep current filter (verified/in_transit/completed only) | Pending triage is #62's scope with its own UX requirements |
| RLS policy | Simple anon UPDATE on submissions | Demo phase, no auth yet; will be replaced when roles land |

## Component: PinDetailSheet

New file: `src/components/PinDetailSheet.tsx`

### Layout (top to bottom)

1. **Header** — Drag handle, status badge (colored dot + label matching pin color), close (X) button
2. **Location** — Barangay, municipality (bold, prominent)
3. **Details grid** — Two-column label/value pairs:
   - Gap category (Lunas / Sustenance / Shelter)
   - Urgency level
   - Access status
   - Family count
   - Contact name
   - Submitted (relative timestamp)
4. **Notes** — Full text, if present
5. **Photo** — Placeholder area (wired up in #64)
6. **Status actions** — Forward transition buttons

### Behavior

- Hidden by default. Slides up via CSS transition (`transform: translateY`) when a pin is selected.
- Max-width constrained on desktop; full-width on mobile.
- Content scrolls within the sheet if it overflows.
- Dismissed by: tapping close button, tapping the map background.

## Status Transition Controls

### Visual

- Horizontal step indicator: 5 small dots/labels showing the full lifecycle. Past = filled, current = highlighted with status color, future = grayed out. Decorative only (`aria-hidden`).
- Below the indicator: buttons for **all valid forward transitions** from current status. Each button uses the target status color.
- At `resolved` (terminal): display "This need has been resolved" with no buttons.

### Example states

| Current status | Buttons shown |
|---------------|---------------|
| `verified` | Mark In Transit, Mark Completed, Mark Resolved |
| `in_transit` | Mark Completed, Mark Resolved |
| `completed` | Mark Resolved |
| `resolved` | (none — resolved message) |

### Mutation flow

1. User taps a transition button
2. Button enters loading state (spinner, disabled)
3. Call `updateSubmissionStatus(id, newStatus)` → `supabase.from('submissions').update({ status }).eq('id', id)`
4. On success: update local state so pin color and sheet badge reflect new status immediately
5. On failure: inline error message below buttons

### Offline handling

- Check `navigator.onLine` before mutation
- If offline: disable all buttons, show inline message ("Status changes require an internet connection")
- Listen for `online` event to re-enable

## Data Flow & State Management

### Current flow
```
NeedsPage → NeedsCoordinationMap → NeedsMap (Leaflet popup on click)
```

### New flow
```
NeedsPage
  → NeedsCoordinationMap (holds selectedPoint state)
      → NeedsMap (onPinSelect callback, no Popup)
      → PinDetailSheet (reads selectedPoint, calls onStatusChange)
```

- `NeedsMap`: remove `<Popup>`, add `onPinSelect(point)` callback on `<Marker>` click.
- `NeedsCoordinationMap`: hold `selectedPoint: NeedPoint | null` in state. Render `<PinDetailSheet>` when non-null.
- Status change callback: `onStatusChange(id, newStatus)` updates the point in the local array — pin color changes without refetch.
- No global state, no context providers.

## Files Changed

| File | Change |
|------|--------|
| `src/components/maps/NeedsMap.tsx` | Remove Popup, add `onPinSelect` prop |
| `src/components/NeedsCoordinationMap.tsx` | Add selected state, render PinDetailSheet |
| `src/components/PinDetailSheet.tsx` | **New** — detail layout + status controls |
| `src/lib/queries.ts` | Add `updateSubmissionStatus(id, status)` |
| `supabase/rls-policies.sql` | Add anon UPDATE policy on submissions |
| `public/locales/{en,fil,ilo}/translation.json` | Add PinDetail.* keys |

## i18n

New keys under `PinDetail` namespace:
- `status_pending`, `status_verified`, `status_in_transit`, `status_completed`, `status_resolved`
- `markVerified`, `markInTransit`, `markCompleted`, `markResolved`
- `offlineMessage`, `resolved`, `contactName`, `submitted`, `notes`, `photo`
- Reuse existing `Dashboard.*` keys for gap category, urgency, and access status

Run `npm run translate` after adding English keys.

## Accessibility

- Sheet: `role="dialog"`, `aria-label` describing selected pin
- Transition buttons: descriptive `aria-label`s (e.g., "Change status to in transit")
- Step indicator: `aria-hidden` (decorative; status badge provides text)
- Close button: `aria-label="Close detail panel"`
- Focus trapped inside sheet while open

## Extensibility Notes

- **#62 (pending triage):** Will add pending pins to the map with distinct styling and a toggle. The detail sheet and status controls work unchanged — pending pins just gain the "Mark Verified" button.
- **#63 (matching UI):** Will add a "Respond to this Need" action in the sheet for `verified` pins. This replaces or supplements the generic "Mark In Transit" button with a form that creates a deployment record.
- **#64 (photo capture):** Will wire up the photo placeholder area in the sheet to display captured images.
