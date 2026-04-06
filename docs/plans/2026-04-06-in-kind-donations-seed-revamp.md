# In-Kind Donations & Seed Data Revamp

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support in-kind (physical goods) donations alongside cash donations, fix the inventory model so inflow always covers outflow, and revamp seed data with recent dates and richer variety.

**Architecture:** Expand the `donations` table with a `type` column (`cash` / `in_kind`) plus optional `aid_category_id`, `quantity`, and `unit` fields. Update the inventory formula to: `available = (in-kind donations + purchases) - deployments`. The Transparency page's "Total Donations" stays cash-only; "Goods Available" includes in-kind inflow. The DonationForm gets a type toggle that conditionally shows either amount fields (cash) or category/quantity fields (in-kind).

**Tech Stack:** Supabase (Postgres), React + TypeScript, react-i18next, Vitest + RTL, Playwright

---

### Task 1: Schema migration — expand `donations` table

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `supabase/rls-policies.sql`

**Step 1: Update `supabase/schema.sql` — modify the donations table definition**

Change the donations table (lines 47-55) to:

```sql
-- Donations: monetary or in-kind contributions
CREATE TABLE IF NOT EXISTS donations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type            text NOT NULL DEFAULT 'cash' CHECK (type IN ('cash', 'in_kind')),
  -- Cash donations
  amount          decimal(12,2),
  -- In-kind donations
  aid_category_id uuid REFERENCES aid_categories(id),
  quantity        integer,
  unit            text,
  -- Common fields
  date            date NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);
```

**Step 2: Verify RLS policies**

Check `supabase/rls-policies.sql` — the existing donations policies (anon read) should still work unchanged since we're only adding columns. No changes needed.

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: expand donations table for in-kind support (type, category, quantity, unit)"
```

---

### Task 2: Update TypeScript types and queries

**Files:**
- Modify: `src/lib/queries.ts:260-270` (DonationInsert interface + insertDonation)
- Modify: `src/lib/queries.ts:3-10` (getTotalDonations — filter cash only)
- Modify: `src/lib/queries.ts:22-38` (getDonationsByOrganization — filter cash only)
- Modify: `src/lib/queries.ts:526-564` (getAvailableInventory — add in-kind inflow)
- Modify: `src/lib/queries.ts:283-337` (getDeploymentHubs — add in-kind inflow to per-org inventory)

**Step 1: Write failing tests for the updated query behavior**

In `tests/unit/lib/queries.test.ts`, add tests:

```typescript
describe("getTotalDonations", () => {
  it("sums only cash donations, excluding in-kind", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ amount: 100 }, { amount: 200 }],
          error: null,
        }),
      }),
    } as never);

    const total = await getTotalDonations();
    expect(total).toBe(300);
    // Verify it called .eq("type", "cash")
    const selectFn = vi.mocked(supabase.from("donations").select);
    expect(selectFn).toHaveBeenCalledWith("amount");
  });
});

describe("getDonationsByOrganization", () => {
  it("groups only cash donations by org", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { amount: 500, organizations: { name: "Org A" } },
              { amount: 300, organizations: { name: "Org A" } },
            ],
            error: null,
          }),
        }),
      }),
    } as never);

    const result = await getDonationsByOrganization();
    expect(result).toEqual([{ name: "Org A", amount: 800 }]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --grep "getTotalDonations|getDonationsByOrganization"`
Expected: FAIL (current queries don't filter by type)

**Step 3: Update DonationInsert interface and insertDonation**

In `src/lib/queries.ts`, replace lines 260-270:

```typescript
export interface DonationInsert {
  organization_id: string;
  type: "cash" | "in_kind";
  amount: number | null;
  aid_category_id: string | null;
  quantity: number | null;
  unit: string | null;
  date: string;
  notes: string | null;
}

export async function insertDonation(donation: DonationInsert) {
  const { error } = await supabase.from("donations").insert(donation);
  if (error) throw error;
}
```

**Step 4: Update getTotalDonations to filter cash only**

In `src/lib/queries.ts`, replace lines 3-10:

```typescript
export async function getTotalDonations() {
  const { data, error } = await supabase
    .from("donations")
    .select("amount")
    .eq("type", "cash");

  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}
```

**Step 5: Update getDonationsByOrganization to filter cash only**

In `src/lib/queries.ts`, replace lines 22-38:

```typescript
export async function getDonationsByOrganization() {
  const { data, error } = await supabase
    .from("donations")
    .select("amount, organizations(name)")
    .eq("type", "cash");

  if (error) throw error;

  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    const name = (row.organizations as unknown as { name: string })?.name ?? "Unknown";
    acc[name] = (acc[name] ?? 0) + Number(row.amount);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}
```

**Step 6: Update getAvailableInventory to include in-kind donations**

In `src/lib/queries.ts`, replace lines 526-564:

```typescript
export async function getAvailableInventory(eventId: string) {
  // Purchased goods
  const { data: purchaseData, error: purchaseError } = await supabase
    .from("purchases")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("event_id", eventId);
  if (purchaseError) throw purchaseError;

  // In-kind donated goods
  const { data: inKindData, error: inKindError } = await supabase
    .from("donations")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("type", "in_kind");
  if (inKindError) throw inKindError;

  // Deployed goods
  const { data: deployData, error: deployError } = await supabase
    .from("deployments")
    .select("quantity, aid_categories(id, name, icon)")
    .eq("event_id", eventId)
    .eq("status", "received");
  if (deployError) throw deployError;

  const inventory = new Map<string, { name: string; icon: string | null; received: number; deployed: number }>();

  // Helper to upsert into inventory map
  const upsert = (catId: string, name: string, icon: string | null) => {
    if (!inventory.has(catId)) {
      inventory.set(catId, { name, icon, received: 0, deployed: 0 });
    }
    return inventory.get(catId)!;
  };

  for (const row of purchaseData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    upsert(cat.id, cat.name, cat.icon).received += row.quantity ?? 0;
  }

  for (const row of inKindData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    upsert(cat.id, cat.name, cat.icon).received += row.quantity ?? 0;
  }

  for (const row of deployData ?? []) {
    const cat = row.aid_categories as unknown as { id: string; name: string; icon: string | null };
    if (!cat) continue;
    upsert(cat.id, cat.name, cat.icon).deployed += row.quantity ?? 0;
  }

  return Array.from(inventory.values()).map((item) => ({
    ...item,
    available: item.received - item.deployed,
  }));
}
```

**Step 7: Update getDeploymentHubs similarly**

In `src/lib/queries.ts` lines 283-337, add an in-kind donations query alongside the purchases query and merge both into the `orgInventory` map. Same pattern — fetch in-kind donations, loop through and add to `purchased` (or rename to `received`) counts.

**Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 9: Commit**

```bash
git add src/lib/queries.ts tests/unit/lib/queries.test.ts
git commit -m "feat: update queries for in-kind donations (filter cash, add in-kind to inventory)"
```

---

### Task 3: Update cache types and AvailableInventory component

**Files:**
- Modify: `src/lib/cache.ts:87-93` (OperationsData.availableInventory type)
- Modify: `src/components/AvailableInventory.tsx` (rename "purchased" → "received")
- Modify: `public/locales/en/translation.json` (update i18n key)

**Step 1: Update OperationsData type**

In `src/lib/cache.ts`, change lines 87-93:

```typescript
  availableInventory: {
    name: string;
    icon: string | null;
    received: number;
    deployed: number;
    available: number;
  }[];
```

**Step 2: Update AvailableInventory component**

In `src/components/AvailableInventory.tsx`, rename `purchased` → `received` in the type and template:

```typescript
type InventoryItem = {
  name: string;
  icon: string | null;
  received: number;
  deployed: number;
  available: number;
};
```

And line 33:
```typescript
{item.received} {t("ReliefOps.received")} · {item.deployed} {t("ReliefOps.deployed")}
```

**Step 3: Update i18n key**

In `public/locales/en/translation.json`, change `"purchased": "purchased"` → `"received": "received"` in the ReliefOps section.

**Step 4: Run `npm run translate`** to propagate to fil/ilo locales.

**Step 5: Update existing tests**

In `tests/unit/components/BarangayEquity.test.tsx` or any test referencing `purchased`, update to `received`.

**Step 6: Run tests**

Run: `npm test && npm run verify`
Expected: All pass

**Step 7: Commit**

```bash
git add src/lib/cache.ts src/components/AvailableInventory.tsx public/locales/ tests/
git commit -m "feat: rename purchased→received in inventory display for in-kind clarity"
```

---

### Task 4: Update DonationForm with type toggle

**Files:**
- Modify: `src/components/DonationForm.tsx`
- Modify: `public/locales/en/translation.json` (add new i18n keys)

**Step 1: Write failing test for the new form behavior**

In `tests/unit/components/DonationForm.test.ts` (create if doesn't exist):

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import DonationForm from "@/components/DonationForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/queries", () => ({
  getOrganizations: vi.fn().mockResolvedValue([]),
  getAidCategories: vi.fn().mockResolvedValue([]),
  insertDonation: vi.fn(),
}));

describe("DonationForm", () => {
  it("shows amount field for cash type by default", async () => {
    render(<DonationForm />);
    expect(screen.getByLabelText("DonationForm.amount")).toBeInTheDocument();
  });

  it("shows category and quantity fields when in_kind is selected", async () => {
    render(<DonationForm />);
    fireEvent.change(screen.getByLabelText("DonationForm.type"), {
      target: { value: "in_kind" },
    });
    expect(screen.getByLabelText("DonationForm.category")).toBeInTheDocument();
    expect(screen.getByLabelText("DonationForm.quantity")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "DonationForm"`
Expected: FAIL

**Step 3: Add i18n keys**

In `public/locales/en/translation.json`, add to the DonationForm section:

```json
"DonationForm": {
  "type": "Donation Type",
  "typeCash": "Cash",
  "typeInKind": "In-Kind (Physical Goods)",
  "organization": "Organization",
  "amount": "Amount (₱)",
  "category": "Aid Category",
  "quantity": "Quantity",
  "unit": "Unit (optional)",
  "date": "Date",
  "notes": "Notes (optional)",
  "submit": "Report Donation",
  "success": "Donation reported successfully!",
  "error": "Failed to report donation"
}
```

**Step 4: Rewrite DonationForm.tsx**

Add state for `donationType` (`"cash" | "in_kind"`). Import `getAidCategories`. Conditionally render:
- When `cash`: show amount input (existing)
- When `in_kind`: show aid category dropdown + quantity input + unit input

Update `handleSubmit` to build the correct `DonationInsert` based on type:
- Cash: `{ type: "cash", amount, aid_category_id: null, quantity: null, unit: null, ... }`
- In-kind: `{ type: "in_kind", amount: null, aid_category_id, quantity, unit, ... }`

**Step 5: Run tests**

Run: `npm test && npm run verify`
Expected: All pass

**Step 6: Run `npm run translate`**

**Step 7: Commit**

```bash
git add src/components/DonationForm.tsx public/locales/ tests/
git commit -m "feat: add in-kind donation type toggle to DonationForm"
```

---

### Task 5: Revamp seed data

**Files:**
- Rewrite: `supabase/seed-demo.sql`

**Step 1: Rewrite seed-demo.sql with these requirements:**

- **Event:** "Typhoon Emong Relief" — started 2026-03-24, active
- **Timeline:** All dates between 2026-03-24 and 2026-04-06 (recent, shows as "1d ago" to "13d ago")
- **Organizations:** Keep existing 14 orgs. Set lat/lng on 8 of them (hub markers)
- **Barangays:** Keep existing 10 barangays
- **Cash donations:** 12-15 entries across ~8 orgs, totaling ~₱3.5M, dates spread across the timeline
- **In-kind donations:** 8-10 entries using `type = 'in_kind'` with aid_category_id, quantity, unit
- **Purchases:** 12-15 entries, balanced so that `(in-kind + purchases) > deployments` per category
- **Deployments:** ~20 unlinked + 8 linked (to submissions), all with `status = 'received'` except 3 pending
- **Submissions:** 15 total — 3 pending, 4 verified, 3 in_transit, 3 completed, 2 resolved (same lifecycle narrative structure)
- **Hazards:** 5-6 entries (mix of active/resolved, varied types, spread across barangays)

**Inventory balance targets (all positive):**

| Category | In-Kind + Purchased | Deployed | Available |
|----------|-------------------|----------|-----------|
| Hot Meals | ~5500 | ~4200 | ~1300 |
| Drinking Water | ~2500 | ~1800 | ~700 |
| Water Filtration | ~250 | ~180 | ~70 |
| Temporary Shelter | ~400 | ~280 | ~120 |
| Clothing | ~500 | ~300 | ~200 |
| Construction Materials | ~600 | ~420 | ~180 |
| Medical Supplies | ~800 | ~580 | ~220 |
| Hygiene Kits | ~700 | ~480 | ~220 |
| Canned Food | ~3500 | ~2600 | ~900 |

**Step 2: Verify seed is self-contained and idempotent**

Review that all INSERT statements use `WHERE NOT EXISTS` or `ON CONFLICT` guards.

**Step 3: Commit**

```bash
git add supabase/seed-demo.sql
git commit -m "feat: revamp seed data with recent dates, in-kind donations, balanced inventory"
```

---

### Task 6: Update Supabase rules and documentation

**Files:**
- Modify: `.claude/rules/supabase.md` (update schema description for donations table)
- Modify: `CLAUDE.md` if needed

**Step 1: Update `.claude/rules/supabase.md`**

In the Schema section, update the `donations` entry:

```
- `donations` — monetary or in-kind contributions. `type` is `cash` or `in_kind`. Cash: `amount` (pesos). In-kind: `aid_category_id` + `quantity` + `unit`. Both: `organization_id`, `date`, `notes`
```

**Step 2: Commit**

```bash
git add .claude/rules/supabase.md
git commit -m "docs: update supabase rule for in-kind donations schema"
```

---

### Task 7: End-to-end verification

**Step 1:** Run `npm test` — all unit tests pass

**Step 2:** Run `npm run build` — TypeScript compiles cleanly

**Step 3:** Run `npm run verify` — Playwright smoke tests pass

**Step 4:** Deploy to Supabase:
- Drop all tables
- Run updated `schema.sql`
- Run `rls-policies.sql`
- Run updated `seed-demo.sql`

**Step 5:** Run `npm run dev` and manually verify:
- Transparency page: all inventory values positive, Total Donations is cash-only
- Relief Map: 8 hub markers visible, needs pins show recent dates
- Report page: Donation form has type toggle, in-kind shows category/quantity
- Hazards layer: 5-6 markers visible

**Step 6: Final commit if any fixes needed, then branch is ready for PR**
