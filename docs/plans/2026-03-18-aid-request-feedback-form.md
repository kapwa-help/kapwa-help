# Aid Request & Feedback Form Design

**Issue:** #11 — Aid request and feedback form
**Date:** 2026-03-18
**Status:** Design approved, ready for implementation

## Overview

A two-in-one form where users submit either an **aid request** ("we need X") or **feedback** ("we received X, here's how it went"). A type toggle controls which fields appear. The form lives on a new page at `/:locale/submit` with a "Report" CTA button in the Header replacing the current dead "Volunteer" link.

This is a write-only feature — submitted data lands in Supabase for coordinators to review. The read-side (triage board) is issue #15.

## Data Model

New `submissions` table:

```sql
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('request', 'feedback')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  contact_name    text NOT NULL,
  contact_phone   text,
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  notes           text,
  -- request-only
  quantity_needed integer,
  urgency         text CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  -- feedback-only
  rating          integer CHECK (rating BETWEEN 1 AND 5),
  issue_type      text CHECK (issue_type IN ('none', 'insufficient', 'damaged', 'wrong_items', 'delayed')),
  -- auto-populated
  lat             decimal(9,6),
  lng             decimal(9,6),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON submissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON submissions FOR INSERT TO anon WITH CHECK (true);
```

### Why one table?

The two types share ~80% of fields. A single table with nullable type-specific columns is simpler to query, cache, and sync offline. The `type` column discriminates — the triage board (issue #15) filters by `type = 'request'`.

### Who submits?

Both barangay contacts (community leaders reporting needs) and LUaid volunteers/coordinators. Designed for the least technical user.

### Auth

No authentication for MVP. Anon INSERT + SELECT via RLS. Auth decision deferred — easy to add an RLS policy check later without changing the form.

## UI Design

### Navigation

- Replace the dead "Volunteer" `<a href="#">` in `Header.tsx` with a `<Link to="/:locale/submit">` labeled "Report" (translated via `t("Navigation.report")`)
- Styled as the existing primary CTA: `bg-primary hover:bg-primary/80 text-neutral-50 rounded-lg px-5 py-2`

### Route

Add to `router.tsx`:

```tsx
{ path: "submit", element: <SubmitPage /> }
```

As a child of `/:locale` inside `RootLayout` — inherits Header, locale sync, and i18n.

### Form Layout

Single centered card (`max-w-lg mx-auto`) matching the dashboard card pattern:

```
rounded-xl border border-neutral-400/20 bg-secondary p-6
```

**Structure:**

1. **Type toggle** — two pill-shaped buttons ("Request Aid" / "Give Feedback"). Active state uses `bg-primary`, inactive uses `bg-base`.
2. **Common fields:**
   - Contact name (text, required)
   - Contact phone (tel, optional)
   - Barangay (select dropdown from DB, required)
   - Aid category (select dropdown from DB, required)
   - Notes (textarea, optional)
3. **Request-only fields:**
   - Urgency (4 radio buttons: low/medium/high/critical with color coding)
   - Quantity needed (number input, optional)
4. **Feedback-only fields:**
   - Rating (1-5 tap targets, optional)
   - Issue type (select dropdown, optional)
5. **Submit button** — full-width `bg-primary`
6. **Success state** — confirmation message + "Submit another" link

### Input Styling

Dark theme inputs: `bg-base border-neutral-400/20 text-neutral-50 placeholder:text-neutral-400 focus:ring-primary`

### Validation

HTML5 attributes only (`required`, `type="tel"`, `type="number"`, `min`/`max`). Postgres CHECK constraints are the real validation layer.

### Geolocation

Silently request `navigator.geolocation.getCurrentPosition()` on form load. Attach `lat`/`lng` if available, null otherwise. No map picker.

## Data Flow

1. Page loads → `useEffect` fetches barangays and aid categories for dropdowns
2. User fills form → hits Submit
3. `insertSubmission()` calls `supabase.from('submissions').insert(data)`
4. Success → show confirmation, reset form
5. Failure → show inline error (`text-error`), form stays filled

Offline queue (write path of issue #10) will be layered on after the form works online.

## Component Structure

```
src/pages/SubmitPage.tsx          — page component (route handler)
src/components/SubmitForm.tsx     — form UI + state
src/lib/queries.ts                — insertSubmission(), getBarangays(), getAidCategories()
supabase/schema.sql               — add submissions table
supabase/rls-policies.sql         — add submissions policies
public/locales/{en,fil,ilo}/      — add SubmitForm.* and Navigation.report keys
```

## i18n Keys

New translation keys (English values shown):

```json
{
  "Navigation": {
    "report": "Report"
  },
  "SubmitForm": {
    "title": "Submit a Report",
    "typeRequest": "Request Aid",
    "typeFeedback": "Give Feedback",
    "contactName": "Your Name",
    "contactNamePlaceholder": "Full name",
    "contactPhone": "Phone Number",
    "contactPhonePlaceholder": "Optional — for follow-up",
    "barangay": "Barangay",
    "barangayPlaceholder": "Select your barangay",
    "aidCategory": "Type of Aid",
    "aidCategoryPlaceholder": "Select category",
    "notes": "Additional Notes",
    "notesPlaceholder": "Any details that would help...",
    "urgencyLabel": "Urgency",
    "urgencyLow": "Low",
    "urgencyMedium": "Medium",
    "urgencyHigh": "High",
    "urgencyCritical": "Critical",
    "quantityNeeded": "Quantity Needed",
    "quantityPlaceholder": "Estimated amount",
    "ratingLabel": "How was the aid?",
    "issueTypeLabel": "Any issues?",
    "issueNone": "No issues",
    "issueInsufficient": "Not enough",
    "issueDamaged": "Damaged goods",
    "issueWrongItems": "Wrong items",
    "issueDelayed": "Delayed delivery",
    "submit": "Submit Report",
    "submitting": "Submitting...",
    "successTitle": "Report Submitted",
    "successMessage": "Thank you. Your report has been received.",
    "submitAnother": "Submit Another Report",
    "errorMessage": "Could not submit. Check your connection and try again."
  }
}
```

Filipino and Ilocano files get English text as placeholders — proper translations from Rod's team.

## Testing

**SubmitForm.test.tsx:**

- Renders both form types (toggle switches fields)
- Required field validation (no insert called if name empty)
- Correct payload sent to `supabase.from().insert()`
- Success state (confirmation shown, form resets)
- Error state (error message shown, form preserved)

**queries.test.ts:**

- `insertSubmission()` with mocked Supabase
- `getBarangays()`, `getAidCategories()` with mocked responses

## Architecture — How This Connects

```
Issue #11 (this)     Issue #15 (future)     Issue #10 (future)
─────────────────    ──────────────────     ──────────────────
Form UI + insert  →  Triage board (read)    Offline write queue
submissions table     getSubmissions*()      IndexedDB → sync
write-only MVP        status workflow        background sync
```

The `status` field (`pending` → `reviewed` → `resolved`) is what connects the form to the triage board. The offline queue wraps the same `insertSubmission()` function.
