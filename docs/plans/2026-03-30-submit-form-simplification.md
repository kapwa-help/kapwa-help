# Submit Form Simplification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the submit form from a 3-tab multi-type form (need/request/feedback) into a single-purpose "Report a Need" form, and clean the database schema to remove dead columns.

**Architecture:** Remove `aid_category_id`, `rating`, `issue_type` from `submissions` table. Make `gap_category`, `access_status`, `urgency` NOT NULL. Drop `'request'` from type CHECK. Rewrite `SubmitForm.tsx` as a single-purpose form with no tabs. Update i18n, tests, and seed data.

**Tech Stack:** Supabase (Postgres), React + TypeScript, Vitest + RTL, Playwright, react-i18next

---

## Task 1: Clean the database schema

Remove dead columns and tighten constraints on the `submissions` table.

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Update the submissions table definition**

Replace the existing `CREATE TABLE IF NOT EXISTS submissions` block (lines 59-88) with:

```sql
-- Submissions: needs from the field
-- "Needs" follow the KapwaRelief pin lifecycle (docs/scope §5.B)
CREATE TABLE IF NOT EXISTS submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id),
  type            text NOT NULL CHECK (type IN ('need', 'feedback')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'in_transit', 'completed', 'resolved')),
  -- Contact
  contact_name    text NOT NULL,
  contact_phone   text,
  -- Location
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  gap_category    text NOT NULL CHECK (gap_category IN ('lunas', 'sustenance', 'shelter')),
  lat             decimal(9,6),
  lng             decimal(9,6),
  -- Access / passability (scope §5.A)
  access_status   text NOT NULL CHECK (access_status IN ('truck', '4x4', 'boat', 'foot_only', 'cut_off')),
  -- Need details
  quantity_needed integer,
  urgency         text NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  notes           text,
  photo_url       text,
  -- Timestamps
  verified_at     timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);
```

**Removed:** `aid_category_id`, `rating`, `issue_type`
**Made NOT NULL:** `gap_category`, `access_status`, `urgency`
**Updated CHECK:** `type` no longer allows `'request'`

**Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "refactor(schema): clean submissions table — drop dead columns, tighten NOT NULLs"
```

---

## Task 2: Update seed data for new schema

Remove `aid_category_id` from submission inserts since the column no longer exists.

**Files:**
- Modify: `supabase/seed-demo.sql`

**Step 1: Update the submissions INSERT block**

Replace lines 326-342 (the needs INSERT block). Remove `aid_category_id` from the column list and values:

```sql
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE type = 'need' LIMIT 1) THEN
    INSERT INTO submissions (event_id, type, status, contact_name, barangay_id, gap_category, lat, lng, access_status, quantity_needed, urgency, notes, created_at) VALUES
      -- Verified needs (live on map)
      (v_event, 'need', 'verified',   'Kap. Maria Santos',    v_brgy_urbiztondo,   'lunas',      16.6690, 120.3230, 'truck',     50, 'critical', 'Medical supplies for 50 families — multiple injuries from debris', '2024-11-11 08:00:00+08'),
      (v_event, 'need', 'verified',   'Kap. Jose Reyes',      v_brgy_bacnotan,     'sustenance', 16.7345, 120.3475, '4x4',       80, 'high',     'Food and water for 80 families — supplies running low',             '2024-11-11 09:30:00+08'),
      (v_event, 'need', 'verified',   'Ldr. Ana Cruz',        v_brgy_nalvo,        'shelter',    16.8090, 120.3690, 'foot_only', 30, 'critical', '30 homes destroyed — need tarps and building materials',            '2024-11-11 10:00:00+08'),
      (v_event, 'need', 'verified',   'Ldr. Pedro Gomez',     v_brgy_paringao,     'sustenance', 16.5150, 120.3290, 'boat',      60, 'high',     'Flooding cut road access — boat needed for food delivery',          '2024-11-12 07:00:00+08'),
      (v_event, 'need', 'verified',   'Vol. Rica Tan',        v_brgy_guerrero,     'lunas',      16.7260, 120.3550, 'truck',     25, 'medium',   'First aid kits needed for minor injuries',                          '2024-11-12 11:00:00+08'),
      -- In-transit (donor committed)
      (v_event, 'need', 'in_transit', 'Kap. Luis Aquino',     v_brgy_central_east, 'sustenance', 16.5380, 120.3400, 'truck',     100, 'high',    'EcoNest committed 420 relief packs — en route',                    '2024-11-11 14:00:00+08'),
      (v_event, 'need', 'in_transit', 'Ldr. Rosa Bautista',   v_brgy_dili,         'shelter',    16.7420, 120.3510, '4x4',       40, 'high',     'Art Relief deploying construction materials',                       '2024-11-12 08:00:00+08'),
      -- Completed (fulfilled)
      (v_event, 'need', 'completed',  'Kap. Elena Ramos',     v_brgy_poblacion_sj, 'sustenance', 16.6640, 120.3290, 'truck',     70, 'high',     'LU Citizen Volunteers delivered 480 meals',                        '2024-11-11 06:00:00+08'),
      (v_event, 'need', 'completed',  'Vol. Marco Diaz',      v_brgy_baccuit,      'lunas',      16.5462, 120.3312, 'truck',     35, 'medium',   'La Union Surf Club delivered 120 medical kits',                    '2024-11-12 09:00:00+08'),
      -- Pending (unverified, not yet visible on map)
      (v_event, 'need', 'pending',    'Caller: unknown',      v_brgy_poblacion_lu, 'sustenance', 16.8015, 120.3735, 'cut_off',   45, 'critical', 'Unverified report of cut-off community needing food — checking',   '2024-11-13 06:00:00+08');
  END IF;
```

**Step 2: Remove gap category variable lookups that are no longer needed**

Remove these lines from the DECLARE block (lines 35-37) since gap_category is now a text value, not an FK:
```sql
  v_lunas          uuid;
  v_sustenance     uuid;
  v_shelter        uuid;
```

And remove these lines from the BEGIN block (lines 87-89):
```sql
  SELECT id INTO v_lunas      FROM aid_categories WHERE name = 'Lunas';
  SELECT id INTO v_sustenance FROM aid_categories WHERE name = 'Sustenance';
  SELECT id INTO v_shelter    FROM aid_categories WHERE name = 'Shelter';
```

**Step 3: Commit**

```bash
git add supabase/seed-demo.sql
git commit -m "refactor(seed): update submissions inserts for cleaned schema"
```

---

## Task 3: Update SubmissionInsert type and queries

Slim the TypeScript type to match the new schema.

**Files:**
- Modify: `src/lib/queries.ts` (lines 206-224)

**Step 1: Replace the SubmissionInsert interface**

```typescript
export interface SubmissionInsert {
  id?: string; // Client-generated UUID for idempotent sync
  event_id?: string | null;
  type: "need";
  contact_name: string;
  contact_phone: string | null;
  barangay_id: string;
  gap_category: string;
  access_status: string;
  notes: string | null;
  quantity_needed: number | null;
  urgency: string;
  lat: number | null;
  lng: number | null;
  photo_url?: string | null;
}
```

**Removed:** `aid_category_id`, `rating`, `issue_type`
**Made required:** `gap_category`, `access_status`, `urgency` (no longer `| null`)
**Simplified type:** `"need"` only (not union)

**Step 2: Commit**

```bash
git add src/lib/queries.ts
git commit -m "refactor(queries): slim SubmissionInsert to needs-only schema"
```

---

## Task 4: Simplify the form component

Rewrite `SubmitForm.tsx` as a single-purpose "Report a Need" form — no tabs, no type toggle, no feedback fields.

**Files:**
- Modify: `src/components/SubmitForm.tsx`

**Step 1: Rewrite the component**

Key changes:
- Remove `SubmissionType` type and `type` state — always `"need"`
- Remove `categories` state and `getAidCategories` import/fetch/cache
- Remove the 3-button type toggle
- Remove all conditional `{type === "request" && ...}` and `{type === "feedback" && ...}` blocks
- Make gap_category, access_status, and urgency always visible (they were conditional on `type === "need"`)
- Remove `aid_category_id` dropdown
- Simplify payload — no `rating`, `issue_type`, `aid_category_id`
- Add `required` to gap_category radio group and access_status dropdown

The full rewritten component:

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getBarangays,
  insertSubmission,
  type SubmissionInsert,
} from "@/lib/queries";
import {
  getCachedOptions,
  setCachedOptions,
  addToOutbox,
  getOutboxEntries,
  removeFromOutbox,
} from "@/lib/form-cache";
import { useOutbox } from "@/lib/outbox-context";

interface Barangay {
  id: string;
  name: string;
  municipality: string;
}

export default function SubmitForm() {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    let hadCache = false;
    let cancelled = false;

    // Step 1: Try loading from IndexedDB cache first
    getCachedOptions<Barangay>("barangays").then((cachedB) => {
      if (cancelled) return;
      if (cachedB?.data.length) {
        hadCache = true;
        setBarangays(cachedB.data);
        setLoading(false);
      }

      // Step 2: Fetch fresh data from Supabase
      getBarangays()
        .then((freshB) => {
          if (cancelled) return;
          setBarangays(freshB);
          setLoading(false);
          setCachedOptions("barangays", freshB);
        })
        .catch(() => {
          if (cancelled) return;
          if (!hadCache) {
            setError(t("SubmitForm.loadError"));
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => {} // silently ignore denial
      );
    }
  };

  const flushingRef = useRef(false);

  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const entries = await getOutboxEntries();
      for (const entry of entries) {
        try {
          await insertSubmission(entry.payload);
          await removeFromOutbox(entry.key);
        } catch (err: unknown) {
          const isUniqueViolation =
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "23505";
          if (isUniqueViolation) {
            await removeFromOutbox(entry.key);
          }
        }
      }
      refreshCount();
    } finally {
      flushingRef.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      flushOutbox();
    };
    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      flushOutbox();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushOutbox]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();

    const payload: SubmissionInsert = {
      id,
      type: "need",
      contact_name: formData.get("contact_name") as string,
      contact_phone: (formData.get("contact_phone") as string) || null,
      barangay_id: formData.get("barangay_id") as string,
      gap_category: formData.get("gap_category") as string,
      access_status: formData.get("access_status") as string,
      urgency: formData.get("urgency") as string,
      quantity_needed: formData.get("quantity_needed")
        ? Number(formData.get("quantity_needed"))
        : null,
      notes: (formData.get("notes") as string) || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };

    try {
      await insertSubmission(payload);
      setSubmitted(true);
    } catch {
      try {
        await addToOutbox(payload);
        refreshCount();
        setSavedOffline(true);
        setSubmitted(true);
      } catch {
        setError(t("SubmitForm.errorMessage"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2
          className={`text-xl font-bold ${savedOffline ? "text-warning" : "text-success"}`}
        >
          {t(savedOffline ? "SubmitForm.savedTitle" : "SubmitForm.successTitle")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t(
            savedOffline
              ? "SubmitForm.savedMessage"
              : "SubmitForm.successMessage"
          )}
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setSavedOffline(false);
            setFormKey((k) => k + 1);
            setCoords(null);
          }}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80"
        >
          {t("SubmitForm.submitAnother")}
        </button>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      {/* Contact name */}
      <div>
        <label htmlFor="contact_name" className="block text-sm text-neutral-400">
          {t("SubmitForm.contactName")}
        </label>
        <input
          id="contact_name"
          name="contact_name"
          type="text"
          required
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.contactNamePlaceholder")}
        />
      </div>

      {/* Contact phone */}
      <div>
        <label htmlFor="contact_phone" className="block text-sm text-neutral-400">
          {t("SubmitForm.contactPhone")}
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.contactPhonePlaceholder")}
        />
      </div>

      {/* Barangay */}
      <div>
        <label htmlFor="barangay_id" className="block text-sm text-neutral-400">
          {t("SubmitForm.barangay")}
        </label>
        <select
          id="barangay_id"
          name="barangay_id"
          required
          disabled={loading}
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {loading ? t("SubmitForm.loadingOptions") : t("SubmitForm.barangayPlaceholder")}
          </option>
          {barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.municipality}
            </option>
          ))}
        </select>
      </div>

      {/* Gap category */}
      <fieldset>
        <legend className="text-sm text-neutral-400">
          {t("SubmitForm.gapCategory")}
        </legend>
        <div className="mt-2 flex gap-2">
          {(["lunas", "sustenance", "shelter"] as const).map((gap) => (
            <label key={gap} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="gap_category"
                value={gap}
                required
                className="peer sr-only"
              />
              <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                {t(`SubmitForm.gap_${gap}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Access status */}
      <div>
        <label htmlFor="access_status" className="block text-sm text-neutral-400">
          {t("SubmitForm.accessStatus")}
        </label>
        <select
          id="access_status"
          name="access_status"
          required
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("SubmitForm.accessPlaceholder")}</option>
          <option value="truck">{t("SubmitForm.accessTruck")}</option>
          <option value="4x4">{t("SubmitForm.access4x4")}</option>
          <option value="boat">{t("SubmitForm.accessBoat")}</option>
          <option value="foot_only">{t("SubmitForm.accessFootOnly")}</option>
          <option value="cut_off">{t("SubmitForm.accessCutOff")}</option>
        </select>
      </div>

      {/* Urgency */}
      <fieldset>
        <legend className="text-sm text-neutral-400">
          {t("SubmitForm.urgencyLabel")}
        </legend>
        <div className="mt-2 flex gap-2">
          {(["low", "medium", "high", "critical"] as const).map((level) => (
            <label key={level} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="urgency"
                value={level}
                required
                className="peer sr-only"
              />
              <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                {t(`SubmitForm.urgency${level.charAt(0).toUpperCase() + level.slice(1)}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Quantity */}
      <div>
        <label htmlFor="quantity_needed" className="block text-sm text-neutral-400">
          {t("SubmitForm.quantityNeeded")}
        </label>
        <input
          id="quantity_needed"
          name="quantity_needed"
          type="number"
          min="1"
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.quantityPlaceholder")}
        />
      </div>

      {/* Location */}
      <div>
        {coords ? (
          <p className="text-sm text-success">
            {t("SubmitForm.locationCaptured")}
          </p>
        ) : (
          <button
            type="button"
            onClick={requestLocation}
            className="rounded-lg border border-neutral-400/20 bg-base px-4 py-2.5 text-sm text-neutral-400 hover:border-primary hover:text-neutral-50 transition-colors"
          >
            {t("SubmitForm.shareLocation")}
          </button>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm text-neutral-400">
          {t("SubmitForm.notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.notesPlaceholder")}
        />
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-error">{error}</p>}

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("SubmitForm.submit")}
      </button>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SubmitForm.tsx
git commit -m "refactor(form): simplify to single-purpose needs form"
```

---

## Task 5: Update i18n translation files

Remove dead keys, update title.

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

**Step 1: Update English**

In the `SubmitForm` section:
- Change `"title"` to `"Report a Need"`
- Remove keys: `typeRequest`, `typeFeedback`, `typeNeed`, `aidCategory`, `aidCategoryPlaceholder`, `ratingLabel`, `issueTypeLabel`, `issueNone`, `issueInsufficient`, `issueDamaged`, `issueWrongItems`, `issueDelayed`

**Step 2: Update Filipino**

Same key removals. Change `"title"` to `"Mag-ulat ng Pangangailangan"`

**Step 3: Update Ilocano**

Same key removals. Change `"title"` to `"Ireport ti Kasapulan"`

**Step 4: Commit**

```bash
git add public/locales/
git commit -m "refactor(i18n): remove dead form keys, update title to 'Report a Need'"
```

---

## Task 6: Update unit tests

Rewrite SubmitForm tests for the single-purpose form. Update fixture payloads in other test files.

**Files:**
- Modify: `tests/unit/components/SubmitForm.test.tsx`
- Modify: `tests/unit/lib/form-cache.test.ts`
- Modify: `tests/unit/lib/queries.test.ts`

**Step 1: Rewrite SubmitForm.test.tsx**

Key changes:
- Remove `getAidCategories` from mock and imports
- Remove tests for type toggle, feedback fields switching
- All tests use needs fields (gap_category, access_status, urgency) directly
- Payload assertions use `type: "need"`, no `aid_category_id`, `rating`, `issue_type`
- Remove `aid_category_id` combobox interactions from all tests
- Update outbox fixture payloads to match new schema

**Step 2: Update form-cache.test.ts**

Change `samplePayload` to match new `SubmissionInsert`:
```typescript
const samplePayload: SubmissionInsert = {
  type: "need",
  contact_name: "Juan Dela Cruz",
  contact_phone: null,
  barangay_id: "b1",
  gap_category: "sustenance",
  access_status: "truck",
  notes: null,
  quantity_needed: 50,
  urgency: "high",
  lat: null,
  lng: null,
};
```

**Step 3: Update queries.test.ts**

Change the `insertSubmission` test payload to match new schema (lines 69-82):
```typescript
const payload = {
  type: "need" as const,
  contact_name: "Juan Dela Cruz",
  contact_phone: null,
  barangay_id: "b1",
  gap_category: "sustenance",
  access_status: "truck",
  notes: null,
  quantity_needed: 50,
  urgency: "high",
  lat: null,
  lng: null,
};
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add tests/
git commit -m "test: update all tests for needs-only form schema"
```

---

## Task 7: Update e2e smoke test

Remove the `#aid_category_id` assertion from the submit form smoke test since that field no longer exists.

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

**Step 1: Update the submit form assertions**

At line 52, remove:
```typescript
    await expect(page.locator("#aid_category_id")).toBeVisible();
```

At line 45-46, update the comment about toggle buttons since there's no toggle anymore. The `formButtons` assertion can stay — it now just checks for the share location button.

**Step 2: Run smoke tests**

```bash
npm run verify
```

Expected: All 9 smoke tests pass.

**Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(e2e): remove aid_category_id assertion from submit smoke test"
```

---

## Task 8: Update rules and documentation

Update the Supabase rule file and offline rule file that reference the old schema.

**Files:**
- Modify: `.claude/rules/supabase.md` — update `submissions` description (remove "aid requests", mention gap_category/access_status are NOT NULL)
- Modify: `.claude/rules/offline.md` — remove mention of "aid categories" from form cache description

**Step 1: Update rule files**

**Step 2: Commit**

```bash
git add .claude/rules/
git commit -m "docs: update rules for needs-only form schema"
```

---

## Verification

After all tasks:

```bash
npm test              # Unit tests pass
npm run build         # TypeScript compiles clean
npm run verify        # E2e smoke tests pass (9/9)
```
