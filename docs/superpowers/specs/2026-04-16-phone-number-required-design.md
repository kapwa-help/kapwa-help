# Phone number required on Need form, optional on Hazard form

**Date:** 2026-04-16
**Status:** Design approved
**Author:** Jacob (with Claude)

## Summary

Make the `Phone Number` field required on the Need submission form (it is currently optional). Add a new optional `Phone Number` field to the Hazard submission form, store it in the database, and render it as a tap-to-call `tel:` link in the hazard detail panel.

## Motivation

Coordinators need a reliable way to follow up with the person who reported a need. Needs drive deployments, so a missing phone number on a need is operationally costly — a truck can roll to a barangay and have no one to call for access details. Hazards are informational (debris, flooding, downed line), so follow-up contact is helpful but not required; a passing reporter may not want to leave a number.

## Scope

### In scope

1. **Need form** (`src/components/SubmitForm.tsx`)
   - Add `required` to the phone `FormInput` and `required` prop on `FormLabel`.
   - Update placeholder text from `"Optional — for follow-up"` to `"Required — for follow-up"`.
   - Drop the `|| undefined` fallback in the payload so the string always goes through.

2. **Hazard form** (`src/components/HazardForm.tsx`)
   - Add a `contactPhone` state variable.
   - Add a new optional `FormInput` of `type="tel"` directly below the "Reported by" field.
   - Thread the value into the payload (falling back to `undefined` when empty, matching the existing `reported_by` pattern).

3. **Database**
   - Add `contact_phone TEXT` (nullable) to the `hazards` table in `supabase/schema.sql`.
   - User runs `ALTER TABLE hazards ADD COLUMN contact_phone TEXT;` against the live Supabase project.

4. **Query layer** (`src/lib/queries.ts`)
   - Add `contact_phone?: string` to the `HazardInsert` interface.
   - Add `contactPhone: string | null` to the `HazardPoint` type.
   - Include `contact_phone` in the `SELECT` list of `getHazards()`.
   - Map `row.contact_phone` to `contactPhone` in the result mapper.
   - `insertHazard` already spreads the payload, so the new field flows through automatically once it is on the interface.

5. **Hazard detail panel** (`src/components/HazardDetailPanel.tsx`)
   - Add a `{hazard.contactPhone && ...}` block after the existing `reportedBy` block.
   - Render the number as an `<a href="tel:${hazard.contactPhone}">` link so coordinators can tap to call on mobile.

6. **i18n** (`public/locales/en/translation.json`)
   - Update `SubmitForm.contactPhonePlaceholder` → `"Required — for follow-up"`.
   - Add `HazardForm.contactPhone` → `"Phone Number"`.
   - Add `HazardForm.contactPhonePlaceholder` → `"Optional — for follow-up"`.
   - Add `HazardDetail.contactPhone` → `"Phone"` (label in the detail panel).
   - Run `npm run translate` to fill `fil` and `ilo` locales.

### Explicit non-goals

- **No format validation.** `type="tel"` only; any non-empty string is accepted on the Need form.
- **No phone-number display in the Need popup or Needs list.** Out of scope — this change only adds display for hazards, where we are already editing the detail panel.
- **No backfill or migration of existing data.** The `contact_phone` columns on both `needs` and `hazards` stay nullable. Historical rows from before this change remain valid.
- **No outbox migration.** Offline payloads queued before this change lack `contact_phone`; because the DB columns are nullable, sync continues to work.
- **No RPC changes.** Only `insert_need` uses an RPC and it already accepts `p_contact_phone`; hazards are inserted via a direct table write.

## Architecture and data flow

### Need form (existing path, unchanged structure)

```
User input
  → SubmitForm validates (HTML required attribute)
  → payload built with contact_phone as a plain string
  → insertNeed(payload)
  → supabase.rpc("insert_need", { p_contact_phone, ... })
  → needs.contact_phone column (already exists, nullable)
```

### Hazard form (new phone field)

```
User input
  → HazardForm captures contactPhone state
  → payload.contact_phone = contactPhone || undefined
  → insertHazard(payload) — direct .from("hazards").insert(...)
  → hazards.contact_phone column (newly added, nullable)
```

### Hazard display

```
getHazards(eventId)
  → SELECT ..., contact_phone, ... from hazards
  → mapper produces HazardPoint { contactPhone: string | null, ... }
  → HazardDetailPanel renders tel: link when contactPhone is truthy
```

## Error handling

- **Need form**: the HTML `required` attribute blocks client-side submission. No custom validation UI needed. The existing offline-outbox fallback applies unchanged.
- **Hazard form**: phone is optional; no new failure modes.
- **DB**: `ALTER TABLE ... ADD COLUMN` is non-destructive and safe to run on a populated table. No downtime.

## Testing

### Automated

- `npm test` — existing unit tests must still pass. No new unit tests required; the changes are either a single HTML attribute (`required`) or a plain pass-through field.
- `npm run verify` — smoke tests. Required per the project verification rule because form structure changed.

### Manual (Playwright CLI)

1. Open `/en/report`, Need tab.
2. Leave phone empty, fill all other fields, click Submit — browser native validation should block with a tooltip on the phone input.
3. Fill phone with any string, submit — succeeds.
4. Open the Change tab (Hazard form). Submit without phone — succeeds.
5. Submit with a phone number — succeeds.
6. Open the map, click the new hazard's pin — detail panel shows `Phone: <number>` as a tap-to-call `tel:` link.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| A coordinator submits a Need via the offline outbox before pulling the new code, then syncs later. | Outbox payloads always matched the nullable DB column; no risk. |
| Field reporter submitting a hazard does not want to share their number. | Field is optional — no change to the reporting flow for them. |
| User adds the DB column to staging but forgets production, or vice versa. | Call out the exact `ALTER TABLE` statement in the implementation plan and in the PR description; the user runs it manually per the project's Supabase write policy. |

## Rollback

- Revert the PR.
- Optionally run `ALTER TABLE hazards DROP COLUMN contact_phone;` against Supabase. Existing needs rows with phone values are retained regardless.

## Open questions

None at design time.
