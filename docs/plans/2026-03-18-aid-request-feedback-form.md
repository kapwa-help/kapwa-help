# Aid Request & Feedback Form — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-in-one submission form (aid request / feedback) at `/:locale/submit` with Supabase insert, replacing the dead "Volunteer" button in the Header.

**Architecture:** New `submissions` table in Supabase. New `SubmitForm` component handles form state and submission via `insertSubmission()` in queries.ts. `SubmitPage` wraps the form with the Header. Route added as a child of `/:locale` in the existing RootLayout.

**Tech Stack:** React, TypeScript, Supabase (anon insert), react-router v7, react-i18next, Tailwind (semantic tokens), Vitest + RTL

**Design doc:** `docs/plans/2026-03-18-aid-request-feedback-form.md` (this file — design details in git history)

---

## Task 1: Database Schema + RLS Policies

**Files:**
- Modify: `supabase/schema.sql` (append after deployments table)
- Modify: `supabase/rls-policies.sql` (append after deployments policies)

**Step 1: Add submissions table to schema.sql**

Append to the end of `supabase/schema.sql`:

```sql
-- Submissions: aid requests and feedback from the field
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('request', 'feedback')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  contact_name    text NOT NULL,
  contact_phone   text,
  barangay_id     uuid NOT NULL REFERENCES barangays(id),
  aid_category_id uuid NOT NULL REFERENCES aid_categories(id),
  notes           text,
  quantity_needed integer,
  urgency         text CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  rating          integer CHECK (rating BETWEEN 1 AND 5),
  issue_type      text CHECK (issue_type IN ('none', 'insufficient', 'damaged', 'wrong_items', 'delayed')),
  lat             decimal(9,6),
  lng             decimal(9,6),
  created_at      timestamptz DEFAULT now()
);
```

**Step 2: Add submissions RLS policies to rls-policies.sql**

Append to the end of `supabase/rls-policies.sql`:

```sql
-- Submissions (anon read + insert for field reporting)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_submissions" ON submissions
  FOR SELECT USING (true);
CREATE POLICY "anon_insert_submissions" ON submissions
  FOR INSERT WITH CHECK (true);
```

**Step 3: Commit**

```bash
git add supabase/schema.sql supabase/rls-policies.sql
git commit -m "feat: add submissions table schema and RLS policies"
```

---

## Task 2: Translation Keys

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

**Step 1: Add English translation keys**

Add `"report"` to the existing `"Navigation"` object. Add a new `"SubmitForm"` section. The full new keys for `public/locales/en/translation.json`:

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

**Step 2: Add Filipino translation keys**

Same keys in `public/locales/fil/translation.json`. Add `"report": "Report"` to Navigation, add full `"SubmitForm"` section with English values as placeholders (Rod's team will translate later).

**Step 3: Add Ilocano translation keys**

Same keys in `public/locales/ilo/translation.json`. Add `"report": "Report"` to Navigation, add full `"SubmitForm"` section with English values as placeholders.

**Step 4: Commit**

```bash
git add public/locales/
git commit -m "feat: add i18n keys for submit form (en/fil/ilo)"
```

---

## Task 3: Query Functions (TDD)

**Files:**
- Create: `tests/unit/lib/queries.test.ts`
- Modify: `src/lib/queries.ts`

### Step 1: Write failing tests

Create `tests/unit/lib/queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { getBarangays, getAidCategories, insertSubmission } from "@/lib/queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBarangays", () => {
  it("returns barangays ordered by name", async () => {
    const mockData = [
      { id: "b1", name: "Catbangen", municipality: "San Fernando" },
      { id: "b2", name: "Pagdalagan", municipality: "San Fernando" },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    } as never);

    const result = await getBarangays();
    expect(supabase.from).toHaveBeenCalledWith("barangays");
    expect(result).toEqual(mockData);
  });

  it("throws on Supabase error", async () => {
    const error = { message: "DB error", details: "", hint: "", code: "" };
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error }),
      }),
    } as never);

    await expect(getBarangays()).rejects.toEqual(error);
  });
});

describe("getAidCategories", () => {
  it("returns categories ordered by name", async () => {
    const mockData = [
      { id: "c1", name: "Drinking Water" },
      { id: "c2", name: "Meals" },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    } as never);

    const result = await getAidCategories();
    expect(supabase.from).toHaveBeenCalledWith("aid_categories");
    expect(result).toEqual(mockData);
  });
});

describe("insertSubmission", () => {
  it("inserts a submission and returns void", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    const payload = {
      type: "request" as const,
      contact_name: "Juan Dela Cruz",
      contact_phone: null,
      barangay_id: "b1",
      aid_category_id: "c1",
      notes: null,
      quantity_needed: 50,
      urgency: "high",
      rating: null,
      issue_type: null,
      lat: null,
      lng: null,
    };

    await expect(insertSubmission(payload)).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("submissions");
  });

  it("throws on Supabase error", async () => {
    const error = { message: "Insert failed", details: "", hint: "", code: "" };
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error }),
    } as never);

    const payload = {
      type: "request" as const,
      contact_name: "Juan",
      contact_phone: null,
      barangay_id: "b1",
      aid_category_id: "c1",
      notes: null,
      quantity_needed: null,
      urgency: "low",
      rating: null,
      issue_type: null,
      lat: null,
      lng: null,
    };

    await expect(insertSubmission(payload)).rejects.toEqual(error);
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run tests/unit/lib/queries.test.ts
```

Expected: FAIL — `getBarangays`, `getAidCategories`, `insertSubmission` are not exported from `@/lib/queries`.

### Step 3: Implement query functions

Add to the end of `src/lib/queries.ts`:

```ts
// --- Submission form queries ---

export interface SubmissionInsert {
  type: "request" | "feedback";
  contact_name: string;
  contact_phone: string | null;
  barangay_id: string;
  aid_category_id: string;
  notes: string | null;
  quantity_needed: number | null;
  urgency: string | null;
  rating: number | null;
  issue_type: string | null;
  lat: number | null;
  lng: number | null;
}

export async function getBarangays() {
  const { data, error } = await supabase
    .from("barangays")
    .select("id, name, municipality")
    .order("name");

  if (error) throw error;
  return data;
}

export async function getAidCategories() {
  const { data, error } = await supabase
    .from("aid_categories")
    .select("id, name")
    .order("name");

  if (error) throw error;
  return data;
}

export async function insertSubmission(submission: SubmissionInsert) {
  const { error } = await supabase.from("submissions").insert(submission);

  if (error) throw error;
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run tests/unit/lib/queries.test.ts
```

Expected: All 5 tests PASS.

### Step 5: Commit

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: add getBarangays, getAidCategories, insertSubmission queries"
```

---

## Task 4: SubmitForm Component (TDD)

This is the largest task. The component handles:
- Type toggle (request/feedback)
- Conditional fields based on type
- Form submission via `insertSubmission()`
- Success/error states
- Dropdown data loading (barangays, categories)
- Optional geolocation capture

**Files:**
- Create: `tests/unit/components/SubmitForm.test.tsx`
- Create: `src/components/SubmitForm.tsx`

### Step 1: Write failing tests

Create `tests/unit/components/SubmitForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SubmitForm from "@/components/SubmitForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/queries", () => ({
  getBarangays: vi.fn(),
  getAidCategories: vi.fn(),
  insertSubmission: vi.fn(),
}));

import {
  getBarangays,
  getAidCategories,
  insertSubmission,
} from "@/lib/queries";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBarangays).mockResolvedValue([
    { id: "brgy-1", name: "Catbangen", municipality: "San Fernando" },
    { id: "brgy-2", name: "Pagdalagan", municipality: "San Fernando" },
  ]);
  vi.mocked(getAidCategories).mockResolvedValue([
    { id: "cat-1", name: "Meals" },
    { id: "cat-2", name: "Drinking Water" },
  ]);
  vi.mocked(insertSubmission).mockResolvedValue(undefined);
});

describe("SubmitForm", () => {
  it("renders type toggle with request active by default", async () => {
    render(<SubmitForm />);

    const requestBtn = screen.getByText("SubmitForm.typeRequest");
    const feedbackBtn = screen.getByText("SubmitForm.typeFeedback");

    expect(requestBtn.className).toContain("bg-primary");
    expect(feedbackBtn.className).not.toContain("bg-primary");
  });

  it("shows urgency field for request type and hides feedback fields", async () => {
    render(<SubmitForm />);

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.urgencyLabel")).toBeInTheDocument();
    });
    expect(screen.getByText("SubmitForm.quantityNeeded")).toBeInTheDocument();
    expect(screen.queryByText("SubmitForm.ratingLabel")).not.toBeInTheDocument();
    expect(screen.queryByText("SubmitForm.issueTypeLabel")).not.toBeInTheDocument();
  });

  it("switches to feedback fields when toggle is clicked", async () => {
    render(<SubmitForm />);

    fireEvent.click(screen.getByText("SubmitForm.typeFeedback"));

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.ratingLabel")).toBeInTheDocument();
    });
    expect(screen.getByText("SubmitForm.issueTypeLabel")).toBeInTheDocument();
    expect(screen.queryByText("SubmitForm.urgencyLabel")).not.toBeInTheDocument();
    expect(screen.queryByText("SubmitForm.quantityNeeded")).not.toBeInTheDocument();
  });

  it("loads dropdown options from queries on mount", async () => {
    render(<SubmitForm />);

    await waitFor(() => {
      expect(getBarangays).toHaveBeenCalledOnce();
      expect(getAidCategories).toHaveBeenCalledOnce();
    });

    // Barangay options should appear in select
    const barangaySelect = screen.getByRole("combobox", { name: "SubmitForm.barangay" });
    expect(barangaySelect).toBeInTheDocument();

    const options = barangaySelect.querySelectorAll("option");
    // placeholder + 2 barangays
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveTextContent("Catbangen");
    expect(options[2]).toHaveTextContent("Pagdalagan");
  });

  it("submits request form with correct payload", async () => {
    render(<SubmitForm />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    // Fill required fields
    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan Dela Cruz" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.aidCategory" }),
      { target: { value: "cat-1" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));

    // Submit
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(insertSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "request",
          contact_name: "Juan Dela Cruz",
          barangay_id: "brgy-1",
          aid_category_id: "cat-1",
          urgency: "high",
          rating: null,
          issue_type: null,
        })
      );
    });
  });

  it("shows success state after successful submission", async () => {
    render(<SubmitForm />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.aidCategory" }),
      { target: { value: "cat-1" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.successTitle")).toBeInTheDocument();
      expect(screen.getByText("SubmitForm.successMessage")).toBeInTheDocument();
      expect(screen.getByText("SubmitForm.submitAnother")).toBeInTheDocument();
    });
  });

  it("shows error message on submission failure", async () => {
    vi.mocked(insertSubmission).mockRejectedValue(new Error("Network error"));

    render(<SubmitForm />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.aidCategory" }),
      { target: { value: "cat-1" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.errorMessage")).toBeInTheDocument();
    });

    // Form should still be visible (not replaced by success)
    expect(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder")
    ).toBeInTheDocument();
  });

  it("resets to form view when 'submit another' is clicked", async () => {
    render(<SubmitForm />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.aidCategory" }),
      { target: { value: "cat-1" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.submitAnother")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("SubmitForm.submitAnother"));

    // Form should be visible again
    expect(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder")
    ).toBeInTheDocument();
    expect(screen.getByText("SubmitForm.typeRequest")).toBeInTheDocument();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run tests/unit/components/SubmitForm.test.tsx
```

Expected: FAIL — `@/components/SubmitForm` does not exist.

### Step 3: Implement SubmitForm component

Create `src/components/SubmitForm.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getBarangays,
  getAidCategories,
  insertSubmission,
} from "@/lib/queries";

type SubmissionType = "request" | "feedback";

interface Barangay {
  id: string;
  name: string;
  municipality: string;
}

interface AidCategory {
  id: string;
  name: string;
}

export default function SubmitForm() {
  const { t } = useTranslation();
  const [type, setType] = useState<SubmissionType>("request");
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([getBarangays(), getAidCategories()]).then(([b, c]) => {
      setBarangays(b);
      setCategories(c);
    });
  }, []);

  useEffect(() => {
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
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      await insertSubmission({
        type,
        contact_name: formData.get("contact_name") as string,
        contact_phone: (formData.get("contact_phone") as string) || null,
        barangay_id: formData.get("barangay_id") as string,
        aid_category_id: formData.get("aid_category_id") as string,
        notes: (formData.get("notes") as string) || null,
        quantity_needed:
          type === "request" && formData.get("quantity_needed")
            ? Number(formData.get("quantity_needed"))
            : null,
        urgency:
          type === "request"
            ? (formData.get("urgency") as string) || null
            : null,
        rating:
          type === "feedback" && formData.get("rating")
            ? Number(formData.get("rating"))
            : null,
        issue_type:
          type === "feedback"
            ? (formData.get("issue_type") as string) || null
            : null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
      setSubmitted(true);
    } catch {
      setError(t("SubmitForm.errorMessage"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-success">
          {t("SubmitForm.successTitle")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t("SubmitForm.successMessage")}
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/80"
        >
          {t("SubmitForm.submitAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("request")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "request"
              ? "bg-primary text-white"
              : "bg-base text-neutral-400"
          }`}
        >
          {t("SubmitForm.typeRequest")}
        </button>
        <button
          type="button"
          onClick={() => setType("feedback")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "feedback"
              ? "bg-primary text-white"
              : "bg-base text-neutral-400"
          }`}
        >
          {t("SubmitForm.typeFeedback")}
        </button>
      </div>

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
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("SubmitForm.barangayPlaceholder")}</option>
          {barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.municipality}
            </option>
          ))}
        </select>
      </div>

      {/* Aid category */}
      <div>
        <label htmlFor="aid_category_id" className="block text-sm text-neutral-400">
          {t("SubmitForm.aidCategory")}
        </label>
        <select
          id="aid_category_id"
          name="aid_category_id"
          required
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("SubmitForm.aidCategoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Request-only fields */}
      {type === "request" && (
        <>
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
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                    {t(
                      `SubmitForm.urgency${level.charAt(0).toUpperCase() + level.slice(1)}`
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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
        </>
      )}

      {/* Feedback-only fields */}
      {type === "feedback" && (
        <>
          <fieldset>
            <legend className="text-sm text-neutral-400">
              {t("SubmitForm.ratingLabel")}
            </legend>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-center text-sm peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary">
                    {n}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="issue_type" className="block text-sm text-neutral-400">
              {t("SubmitForm.issueTypeLabel")}
            </label>
            <select
              id="issue_type"
              name="issue_type"
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("SubmitForm.issueNone")}</option>
              <option value="insufficient">{t("SubmitForm.issueInsufficient")}</option>
              <option value="damaged">{t("SubmitForm.issueDamaged")}</option>
              <option value="wrong_items">{t("SubmitForm.issueWrongItems")}</option>
              <option value="delayed">{t("SubmitForm.issueDelayed")}</option>
            </select>
          </div>
        </>
      )}

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
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("SubmitForm.submit")}
      </button>
    </form>
  );
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run tests/unit/components/SubmitForm.test.tsx
```

Expected: All 8 tests PASS.

**Troubleshooting:** If tests fail due to `getByRole("combobox", { name: "..." })` not matching, check that the `<label htmlFor>` attribute matches the `<select id>`. RTL uses the label text as the accessible name for the select.

### Step 5: Commit

```bash
git add src/components/SubmitForm.tsx tests/unit/components/SubmitForm.test.tsx
git commit -m "feat: add SubmitForm component with type toggle and validation"
```

---

## Task 5: Header Update (TDD)

Replace the dead "Volunteer" `<a href="#">` with a `<Link>` to the submit page.

**Files:**
- Modify: `tests/unit/components/Header.test.tsx`
- Modify: `src/components/Header.tsx`

### Step 1: Update the Header test

Replace the volunteer assertion in `tests/unit/components/Header.test.tsx`. In the first test ("renders logo, language switcher, and volunteer button"), change:

```ts
expect(screen.getByText("Navigation.volunteer")).toBeInTheDocument();
```

To:

```ts
const reportLink = screen.getByRole("link", { name: "Navigation.report" });
expect(reportLink).toBeInTheDocument();
expect(reportLink).toHaveAttribute("href", "/en/submit");
```

### Step 2: Run test to verify it fails

```bash
npx vitest run tests/unit/components/Header.test.tsx
```

Expected: FAIL — "Navigation.report" link not found (still shows "Navigation.volunteer").

### Step 3: Update Header component

In `src/components/Header.tsx`:

1. Add `Link` to the react-router import:

```ts
import { useNavigate, useParams, Link } from "react-router";
```

2. Replace the `<a href="#">` volunteer button with:

```tsx
<Link
  to={`/${locale}/submit`}
  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/80"
>
  {t("Navigation.report")}
</Link>
```

### Step 4: Run test to verify it passes

```bash
npx vitest run tests/unit/components/Header.test.tsx
```

Expected: All 3 tests PASS.

### Step 5: Commit

```bash
git add src/components/Header.tsx tests/unit/components/Header.test.tsx
git commit -m "feat: replace Volunteer button with Report link to submit page"
```

---

## Task 6: SubmitPage + Router

**Files:**
- Create: `src/pages/SubmitPage.tsx`
- Modify: `src/router.tsx`

### Step 1: Create SubmitPage

Create `src/pages/SubmitPage.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SubmitForm from "@/components/SubmitForm";

export function SubmitPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-lg px-6 py-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-neutral-50">
          {t("SubmitForm.title")}
        </h1>
        <div className="rounded-xl border border-neutral-400/20 bg-secondary p-6">
          <SubmitForm />
        </div>
      </main>
    </div>
  );
}
```

### Step 2: Add route to router.tsx

Modify `src/router.tsx` — add the import and route:

```tsx
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { SubmitPage } from "./pages/SubmitPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/en" replace />,
  },
  {
    path: "/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "submit", element: <SubmitPage /> },
    ],
  },
]);
```

### Step 3: Commit

```bash
git add src/pages/SubmitPage.tsx src/router.tsx
git commit -m "feat: add submit page and route at /:locale/submit"
```

---

## Task 7: Final Verification + Docs

### Step 1: Run full test suite

```bash
npx vitest run
```

Expected: All tests pass (existing + new). If any existing tests break (e.g., DashboardPage test due to query mock changes), fix them.

### Step 2: Run TypeScript build check

```bash
npm run build
```

Expected: Clean build with no TypeScript errors. The new page will be included in the service worker precache automatically.

### Step 3: Update architecture.md

In `docs/architecture.md`, update the "What's Built vs Planned" section. Move the relevant items from Planned to Built:

Under **Built**, add:
```
- Submit form page (SubmitForm + SubmitPage) with aid request / feedback toggle (#11)
- Submissions table with anon INSERT + SELECT RLS policies
```

Under **Planned**, update the entries for #10 and #11:
```
- Offline form submissions (#10) — IndexedDB write queue + background sync for submit form
- Barangay triage (#15) — status board reading from submissions table
```

Also add `submissions` to the Database Schema table:

```
| `submissions` | Aid requests and field feedback | type (request/feedback), contact info, barangay_id, aid_category_id, urgency, rating, status |
```

### Step 4: Update CLAUDE.md Project Structure

Add the new files to the Project Structure section:

```
  pages/
    DashboardPage.tsx # Live dashboard (index route)
    SubmitPage.tsx    # Aid request / feedback form (/:locale/submit)
```

### Step 5: Commit

```bash
git add docs/architecture.md CLAUDE.md
git commit -m "docs: update architecture and project structure for submit form"
```

---

## Summary

| Task | Files Changed | Tests |
|------|--------------|-------|
| 1. Schema + RLS | `supabase/schema.sql`, `supabase/rls-policies.sql` | — |
| 2. i18n Keys | 3 translation JSON files | — |
| 3. Query Functions | `src/lib/queries.ts`, `tests/unit/lib/queries.test.ts` | 5 tests |
| 4. SubmitForm | `src/components/SubmitForm.tsx`, `tests/unit/components/SubmitForm.test.tsx` | 8 tests |
| 5. Header Update | `src/components/Header.tsx`, `tests/unit/components/Header.test.tsx` | 3 tests (updated) |
| 6. SubmitPage + Router | `src/pages/SubmitPage.tsx`, `src/router.tsx` | — |
| 7. Verify + Docs | `docs/architecture.md`, `CLAUDE.md` | Full suite |

**Total new tests:** 13 (5 query + 8 form)
**Total commits:** 7
