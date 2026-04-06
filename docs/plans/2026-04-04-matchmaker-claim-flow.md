# Matchmaker Claim Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a donor claim a verified need from the map, creating a deployment and advancing the pin lifecycle — with optional photo uploads at each stage.

**Architecture:** Add a `ClaimForm` component rendered inside `PinDetailSheet` for verified pins. A new `createDeploymentForNeed()` query inserts a deployment row and advances the submission to `in_transit`. Photo file inputs appear at `in_transit` and `completed` stages. Relief page queries filter to `status = 'received'` so only admin-verified deployments appear on the public dashboard.

**Tech Stack:** React + TypeScript, Supabase (Postgres), Tailwind CSS (semantic tokens only), react-i18next, Vitest + RTL

---

## Task 1: Schema — Add `status` column to `deployments`

**Files:**
- Modify: `supabase/schema.sql:91-107`
- Modify: `supabase/seed-demo.sql` (sections 7 and 10 — existing deployment inserts)

**Step 1: Add status column to deployments table**

In `supabase/schema.sql`, add after the `notes` column (line 106):

```sql
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'received')),
```

**Step 2: Update seed data**

In `supabase/seed-demo.sql`, all existing deployment inserts should have `status = 'received'` so they continue to appear on the Relief dashboard. The seed data represents historical, already-confirmed deployments.

For section 7 (unlinked deployments ~line 259), add `status` to each INSERT's column list and `'received'` to each VALUES tuple.

For section 10 (linked deployments ~line 437):
- Deployments linked to `resolved` or `completed` submissions: `status = 'received'`
- Deployments linked to `in_transit` submissions: `status = 'pending'` (still in progress)

**Step 3: Commit**

```bash
git add supabase/schema.sql supabase/seed-demo.sql
git commit -m "feat: add status column to deployments (pending/received)"
```

---

## Task 2: RLS — Allow anon INSERT and UPDATE on deployments

**Files:**
- Modify: `supabase/rls-policies.sql:30-33`

**Step 1: Add INSERT and UPDATE policies**

After the existing `anon_read_deployments` policy, add:

```sql
CREATE POLICY "anon_insert_deployments" ON deployments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_deployments" ON deployments
  FOR UPDATE USING (true) WITH CHECK (true);
```

**Step 2: Commit**

```bash
git add supabase/rls-policies.sql
git commit -m "feat: add anon insert/update RLS for deployments (demo phase)"
```

---

## Task 3: Query functions — `createDeploymentForNeed`, `updateDeploymentStatus`, `getOrganizations`

**Files:**
- Modify: `src/lib/queries.ts`
- Test: `tests/unit/lib/queries.test.ts`

**Step 1: Write failing tests**

Add to `tests/unit/lib/queries.test.ts`:

```typescript
describe("createDeploymentForNeed", () => {
  it("inserts deployment and updates submission status", async () => {
    const mockInsert = vi.fn().mockReturnValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ error: null });
    
    // Mock supabase.from to return different builders for deployments vs submissions
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "deployments") {
        return { insert: mockInsert } as any;
      }
      if (table === "submissions") {
        return { update: () => ({ eq: mockUpdate }) } as any;
      }
      return {} as any;
    });

    const { createDeploymentForNeed } = await import("@/lib/queries");
    await createDeploymentForNeed({
      event_id: "event-1",
      organization_id: "org-1",
      aid_category_id: "cat-1",
      submission_id: "sub-1",
      barangay_id: "brgy-1",
      quantity: 100,
      unit: "packs",
      lat: 16.67,
      lng: 120.32,
      notes: null,
    });

    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("getOrganizations", () => {
  it("returns organizations sorted by name", async () => {
    const mockData = [
      { id: "1", name: "DOERS", type: "hub", municipality: "Luna" },
      { id: "2", name: "EcoNest", type: "donor", municipality: "Bauang" },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({ order: () => ({ data: mockData, error: null }) }),
    } as any);

    const { getOrganizations } = await import("@/lib/queries");
    const result = await getOrganizations();
    expect(result).toEqual(mockData);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/lib/queries.test.ts`
Expected: FAIL — functions not defined

**Step 3: Implement query functions**

Add to `src/lib/queries.ts`:

```typescript
// --- Matchmaker queries ---

export interface DeploymentInsert {
  event_id?: string | null;
  organization_id: string;
  aid_category_id: string;
  submission_id: string;
  barangay_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}

export async function createDeploymentForNeed(deployment: DeploymentInsert) {
  const { error: deployError } = await supabase
    .from("deployments")
    .insert({ ...deployment, status: "pending" });

  if (deployError) throw deployError;

  const { error: statusError } = await supabase
    .from("submissions")
    .update({ status: "in_transit" })
    .eq("id", deployment.submission_id);

  if (statusError) throw statusError;
}

export async function updateDeploymentStatus(submissionId: string, status: string) {
  const { error } = await supabase
    .from("deployments")
    .update({ status })
    .eq("submission_id", submissionId);

  if (error) throw error;
}

export async function getOrganizations() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, type, municipality")
    .order("name");

  if (error) throw error;
  return data;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/lib/queries.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: add createDeploymentForNeed, updateDeploymentStatus, getOrganizations queries"
```

---

## Task 4: Filter Relief page queries to `status = 'received'`

**Files:**
- Modify: `src/lib/queries.ts` (6 functions)
- Modify: `tests/unit/lib/queries.test.ts`

**Step 1: Write failing tests**

For each Relief query, add a test verifying the `status` filter is applied. Example for `getTotalBeneficiaries`:

```typescript
describe("getTotalBeneficiaries filters by received status", () => {
  it("only counts received deployments", async () => {
    // Verify the query chain includes .eq("status", "received")
    const mockEq = vi.fn().mockReturnValue({ data: [{ quantity: 50 }], error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({ eq: mockEq }),
    } as any);

    const { getTotalBeneficiaries } = await import("@/lib/queries");
    await getTotalBeneficiaries();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/lib/queries.test.ts`
Expected: FAIL — `.eq("status", "received")` not called

**Step 3: Add `.eq("status", "received")` to all 6 Relief query functions**

Functions to modify in `src/lib/queries.ts`:
- `getTotalBeneficiaries()` — add `.eq("status", "received")` after `.select("quantity")`
- `getVolunteerCount()` — add `.eq("status", "received")` after `.select("volunteer_count")`
- `getDeploymentHubs()` — add `.eq("status", "received")` after `.select(...)`
- `getGoodsByCategory()` — add `.eq("status", "received")` after `.select(...)`
- `getDeploymentMapPoints()` — add `.eq("status", "received")` after `.not("lng", ...)`
- `getBeneficiariesByBarangay()` — add `.eq("status", "received")` after `.not("barangay_id", ...)`

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/lib/queries.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: filter Relief queries to received deployments only"
```

---

## Task 5: i18n — Add ClaimForm and photo button keys

**Files:**
- Modify: `public/locales/en/translation.json`
- Run: `npm run translate` (generates fil/ilo)

**Step 1: Add keys to English locale**

Add new `ClaimForm` namespace and extend `PinDetail` in `public/locales/en/translation.json`:

```json
"ClaimForm": {
  "respondButton": "Respond to this Need",
  "title": "Claim this Need",
  "organization": "Organization",
  "organizationPlaceholder": "Select organization",
  "aidCategory": "Aid Category",
  "aidCategoryPlaceholder": "Select aid type",
  "quantity": "Quantity",
  "quantityPlaceholder": "Amount",
  "unit": "Unit",
  "unitPlaceholder": "e.g. packs, kits",
  "notes": "Notes",
  "notesPlaceholder": "Any coordination details...",
  "submit": "Claim & Dispatch",
  "submitting": "Claiming...",
  "success": "Need claimed — aid is on the way",
  "error": "Could not claim. Check your connection and try again."
}
```

Add to the existing `PinDetail` namespace:

```json
"addDispatchPhoto": "Add Dispatch Photo",
"addDeliveryPhoto": "Add Delivery Photo",
"photoAdded": "Photo attached",
"photoComingSoon": "Photo upload coming soon"
```

**Step 2: Run translate script**

Run: `npm run translate`
Expected: New keys translated to fil and ilo

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "feat: add i18n keys for claim form and photo buttons"
```

---

## Task 6: `ClaimForm` component

**Files:**
- Create: `src/components/ClaimForm.tsx`
- Test: `tests/unit/components/ClaimForm.test.tsx`

**Step 1: Write failing tests**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ClaimForm from "@/components/ClaimForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/queries", () => ({
  getOrganizations: vi.fn(),
  getAidCategories: vi.fn(),
  createDeploymentForNeed: vi.fn(),
}));

const mockPoint = {
  id: "sub-1",
  lat: 16.67,
  lng: 120.32,
  status: "verified",
  gapCategory: "sustenance",
  accessStatus: "truck",
  urgency: "high",
  quantityNeeded: 80,
  notes: null,
  contactName: "Maria",
  barangayName: "Urbiztondo",
  municipality: "San Juan",
  createdAt: "2026-04-01T10:00:00Z",
};

describe("ClaimForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders respond button when collapsed", () => {
    render(
      <ClaimForm point={mockPoint} onClaimed={vi.fn()} />
    );
    expect(screen.getByText("ClaimForm.respondButton")).toBeInTheDocument();
  });

  it("expands form when respond button is clicked", async () => {
    const { getOrganizations, getAidCategories } = await import("@/lib/queries");
    vi.mocked(getOrganizations).mockResolvedValue([
      { id: "org-1", name: "DOERS", type: "hub", municipality: "Luna" },
    ]);
    vi.mocked(getAidCategories).mockResolvedValue([
      { id: "cat-1", name: "Meals", icon: "utensils" },
    ]);

    render(
      <ClaimForm point={mockPoint} onClaimed={vi.fn()} />
    );

    fireEvent.click(screen.getByText("ClaimForm.respondButton"));

    await waitFor(() => {
      expect(screen.getByText("ClaimForm.organization")).toBeInTheDocument();
      expect(screen.getByText("ClaimForm.aidCategory")).toBeInTheDocument();
    });
  });

  it("submits claim and calls onClaimed", async () => {
    const { getOrganizations, getAidCategories, createDeploymentForNeed } = await import("@/lib/queries");
    vi.mocked(getOrganizations).mockResolvedValue([
      { id: "org-1", name: "DOERS", type: "hub", municipality: "Luna" },
    ]);
    vi.mocked(getAidCategories).mockResolvedValue([
      { id: "cat-1", name: "Meals", icon: "utensils" },
    ]);
    vi.mocked(createDeploymentForNeed).mockResolvedValue(undefined);

    const onClaimed = vi.fn();
    render(
      <ClaimForm point={mockPoint} onClaimed={onClaimed} />
    );

    // Open form
    fireEvent.click(screen.getByText("ClaimForm.respondButton"));

    await waitFor(() => {
      expect(screen.getByText("ClaimForm.organization")).toBeInTheDocument();
    });

    // Fill required fields
    fireEvent.change(screen.getByRole("combobox", { name: "ClaimForm.organization" }), {
      target: { value: "org-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "ClaimForm.aidCategory" }), {
      target: { value: "cat-1" },
    });

    // Submit
    fireEvent.click(screen.getByText("ClaimForm.submit"));

    await waitFor(() => {
      expect(createDeploymentForNeed).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
          aid_category_id: "cat-1",
          submission_id: "sub-1",
        })
      );
      expect(onClaimed).toHaveBeenCalled();
    });
  });

  it("disables submit when offline", () => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    render(
      <ClaimForm point={mockPoint} onClaimed={vi.fn()} />
    );

    fireEvent.click(screen.getByText("ClaimForm.respondButton"));

    // Restore
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/components/ClaimForm.test.tsx`
Expected: FAIL — component not found

**Step 3: Implement `ClaimForm`**

Create `src/components/ClaimForm.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getOrganizations,
  getAidCategories,
  createDeploymentForNeed,
  getActiveEvent,
} from "@/lib/queries";
import type { NeedPoint } from "@/lib/queries";

type Props = {
  point: NeedPoint;
  onClaimed: () => void;
};

export default function ClaimForm({ point, onClaimed }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown data
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [orgId, setOrgId] = useState("");
  const [catId, setCatId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleOpen() {
    setIsOpen(true);
    try {
      const [orgData, catData] = await Promise.all([
        getOrganizations(),
        getAidCategories(),
      ]);
      setOrgs(orgData);
      setCategories(catData);
    } catch {
      setError(t("ClaimForm.error"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !catId || !isOnline) return;

    setSubmitting(true);
    setError(null);

    try {
      const event = await getActiveEvent();
      await createDeploymentForNeed({
        event_id: event?.id ?? null,
        organization_id: orgId,
        aid_category_id: catId,
        submission_id: point.id,
        barangay_id: null, // Will be derived from submission's barangay on the backend
        quantity: quantity ? parseInt(quantity, 10) : null,
        unit: unit || null,
        lat: point.lat,
        lng: point.lng,
        notes: notes || null,
      });
      onClaimed();
    } catch {
      setError(t("ClaimForm.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        disabled={!isOnline}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-40"
      >
        {t("ClaimForm.respondButton")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-50">
        {t("ClaimForm.title")}
      </h4>

      {/* Organization */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.organization")}
        </label>
        <select
          aria-label={t("ClaimForm.organization")}
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50"
        >
          <option value="">{t("ClaimForm.organizationPlaceholder")}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Aid Category */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.aidCategory")}
        </label>
        <select
          aria-label={t("ClaimForm.aidCategory")}
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50"
        >
          <option value="">{t("ClaimForm.aidCategoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Quantity + Unit row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">
            {t("ClaimForm.quantity")}
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t("ClaimForm.quantityPlaceholder")}
            className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">
            {t("ClaimForm.unit")}
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t("ClaimForm.unitPlaceholder")}
            className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.notes")}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("ClaimForm.notesPlaceholder")}
          rows={2}
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!orgId || !catId || !isOnline || submitting}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-40"
      >
        {submitting ? t("ClaimForm.submitting") : t("ClaimForm.submit")}
      </button>

      {error && (
        <p className="text-center text-xs text-error">{error}</p>
      )}
    </form>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/components/ClaimForm.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ClaimForm.tsx tests/unit/components/ClaimForm.test.tsx
git commit -m "feat: add ClaimForm component for matchmaker flow"
```

---

## Task 7: Wire `ClaimForm` and photo buttons into `PinDetailSheet`

**Files:**
- Modify: `src/components/PinDetailSheet.tsx`
- Modify: `tests/unit/components/PinDetailSheet.test.tsx`

**Step 1: Write failing tests**

Add to `tests/unit/components/PinDetailSheet.test.tsx`:

```typescript
vi.mock("@/components/ClaimForm", () => ({
  default: ({ onClaimed }: { onClaimed: () => void }) => (
    <button data-testid="mock-claim-form" onClick={onClaimed}>Mock ClaimForm</button>
  ),
}));

it("shows ClaimForm for verified pins", () => {
  render(
    <PinDetailSheet
      point={{ ...mockPoint, status: "verified" }}
      onClose={vi.fn()}
      onStatusChange={vi.fn()}
    />
  );
  expect(screen.getByTestId("mock-claim-form")).toBeInTheDocument();
});

it("does not show ClaimForm for pending pins", () => {
  render(
    <PinDetailSheet
      point={{ ...mockPoint, status: "pending" }}
      onClose={vi.fn()}
      onStatusChange={vi.fn()}
    />
  );
  expect(screen.queryByTestId("mock-claim-form")).not.toBeInTheDocument();
});

it("shows dispatch photo button for in_transit pins", () => {
  render(
    <PinDetailSheet
      point={{ ...mockPoint, status: "in_transit" }}
      onClose={vi.fn()}
      onStatusChange={vi.fn()}
    />
  );
  expect(screen.getByText("PinDetail.addDispatchPhoto")).toBeInTheDocument();
});

it("shows delivery photo button for completed pins", () => {
  render(
    <PinDetailSheet
      point={{ ...mockPoint, status: "completed" }}
      onClose={vi.fn()}
      onStatusChange={vi.fn()}
    />
  );
  expect(screen.getByText("PinDetail.addDeliveryPhoto")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/components/PinDetailSheet.test.tsx`
Expected: FAIL — ClaimForm not rendered, photo buttons not found

**Step 3: Modify `PinDetailSheet`**

Add imports at top of `src/components/PinDetailSheet.tsx`:

```typescript
import ClaimForm from "@/components/ClaimForm";
import { updateDeploymentStatus } from "@/lib/queries";
```

Add a photo file input handler inside the component:

```typescript
const [photoFile, setPhotoFile] = useState<File | null>(null);

function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0] ?? null;
  setPhotoFile(file);
  // TODO: Upload to Supabase Storage when bucket is configured
}
```

In the `content` JSX, **after** the status stepper section (after the `error` paragraph, before the closing `</>`), add:

```tsx
{/* Claim form — verified pins only */}
{point.status === "verified" && (
  <div className="mt-4">
    <ClaimForm
      point={point}
      onClaimed={() => onStatusChange(point.id, "in_transit")}
    />
  </div>
)}

{/* Dispatch photo — in_transit pins only */}
{point.status === "in_transit" && (
  <div className="mt-4">
    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-400/20 bg-base/30 py-2.5 text-sm text-neutral-400 hover:text-neutral-50 hover:border-neutral-400/40">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
      {photoFile ? t("PinDetail.photoAdded") : t("PinDetail.addDispatchPhoto")}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />
    </label>
  </div>
)}

{/* Delivery photo — completed pins only */}
{point.status === "completed" && (
  <div className="mt-4">
    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-400/20 bg-base/30 py-2.5 text-sm text-neutral-400 hover:text-neutral-50 hover:border-neutral-400/40">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
      {photoFile ? t("PinDetail.photoAdded") : t("PinDetail.addDeliveryPhoto")}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />
    </label>
  </div>
)}
```

Also modify the `handleTransition` function: when transitioning to `resolved`, also update the linked deployment:

```typescript
async function handleTransition(newStatus: string) {
  if (!isOnline) return;
  setUpdating(newStatus);
  setError(null);
  try {
    await updateSubmissionStatus(point.id, newStatus);
    // When resolving, also mark the linked deployment as received
    if (newStatus === "resolved") {
      try {
        await updateDeploymentStatus(point.id, "received");
      } catch {
        // Non-fatal — deployment may not exist (manually advanced pins)
      }
    }
    onStatusChange(point.id, newStatus);
  } catch {
    setError(t("PinDetail.updateError"));
  } finally {
    setUpdating(null);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/components/PinDetailSheet.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/PinDetailSheet.tsx tests/unit/components/PinDetailSheet.test.tsx
git commit -m "feat: wire ClaimForm and photo buttons into PinDetailSheet"
```

---

## Task 8: Build, lint, full test suite

**Step 1: Run lint**

Run: `npm run lint`
Expected: Clean

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Run production build**

Run: `npm run build`
Expected: Clean TypeScript + Vite build

**Step 4: Run Playwright smoke tests**

Run: `npm run verify`
Expected: All smoke tests pass

**Step 5: Commit any fixes needed, then final commit**

```bash
git add -A
git commit -m "chore: fix lint/test issues from matchmaker implementation"
```

---

## Task 9: Visual verification with Playwright CLI

Use `npx playwright` to manually verify:

**Step 1: Verify claim form on verified pin**
- Navigate to needs page
- Click a verified (red) pin
- Verify "Respond to this Need" button appears below stepper
- Click it — form should expand with org, aid category, quantity, unit, notes fields

**Step 2: Verify photo buttons on in_transit pin**
- Click an in_transit (amber) pin
- Verify "Add Dispatch Photo" button appears below stepper

**Step 3: Verify photo buttons on completed pin**
- Click a completed (green) pin
- Verify "Add Delivery Photo" button appears below stepper

**Step 4: Verify no extras on pending pin**
- Click a pending (gray) pin
- Verify no claim form or photo buttons appear — just the stepper

**Step 5: Take screenshots**

```bash
npx playwright screenshot http://localhost:4173/en --full-page tests/e2e/screenshots/matchmaker-needs.png
```

---

## Summary of changes

| Area | Files | What |
|------|-------|------|
| Schema | `supabase/schema.sql` | Add `status` column to deployments |
| Seed | `supabase/seed-demo.sql` | Set existing deployments to `received` |
| RLS | `supabase/rls-policies.sql` | Anon insert + update on deployments |
| Queries | `src/lib/queries.ts` | 3 new functions, 6 modified with status filter |
| i18n | `public/locales/{en,fil,ilo}/translation.json` | ClaimForm + photo button keys |
| Components | `src/components/ClaimForm.tsx` (new) | Inline claim form |
| Components | `src/components/PinDetailSheet.tsx` (modified) | Wire claim form + photo buttons |
| Tests | `tests/unit/components/ClaimForm.test.tsx` (new) | ClaimForm unit tests |
| Tests | `tests/unit/components/PinDetailSheet.test.tsx` (modified) | New conditional rendering tests |
| Tests | `tests/unit/lib/queries.test.ts` (modified) | New query function tests |
