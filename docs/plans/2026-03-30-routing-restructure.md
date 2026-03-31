# Routing Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the monolithic DashboardPage into audience-specific pages (Needs, Relief, Stories) with independent data fetching and caching.

**Architecture:** Each page owns its data — fetches only the queries it needs and caches to its own IndexedDB key. Header gains nav links. Router adds two new routes under `/:locale`. The app stays functional after every task (incremental migration).

**Tech Stack:** React 19 + react-router v7, TypeScript strict, Vitest + RTL, Playwright, react-i18next

---

## Route Map (target state)

| Route | Page | Fetches |
|-------|------|---------|
| `/:locale` | **NeedsPage** (index) | `getActiveEvent`, `getNeedsSummary`, `getNeedsMapPoints` |
| `/:locale/relief` | **ReliefPage** | `getTotalDonations`, `getTotalBeneficiaries`, `getVolunteerCount`, `getDonationsByOrganization`, `getDeploymentHubs`, `getGoodsByCategory`, `getBeneficiariesByBarangay`, `getDeploymentMapPoints` |
| `/:locale/stories` | **StoriesPage** (placeholder) | None |
| `/:locale/submit` | **SubmitPage** (unchanged) | Form options (existing) |

---

### Task 1: Add i18n keys for new pages

New pages need translation keys before they can be built.

**Files:**
- Modify: `public/locales/en/translation.json`

**Step 1: Add keys to English translation file**

Add to the `Navigation` namespace:

```json
"needs": "Needs",
"relief": "Relief Operations",
"stories": "Stories"
```

Add a new `Stories` namespace:

```json
"Stories": {
  "title": "Stories",
  "comingSoon": "Coming soon — community stories, learnings, and journals."
}
```

**Step 2: Run machine translation**

Run: `npm run translate`
Expected: `fil/` and `ilo/` translation files updated with new keys.

**Step 3: Commit**

```bash
git add public/locales/
git commit -m "i18n: add navigation and stories keys for routing restructure"
```

---

### Task 2: Split cache types

The current `DashboardData` is one monolithic blob. Split into `NeedsData` and `ReliefData` so each page caches independently. Keep the same IndexedDB store, use two keys instead of one.

**Files:**
- Modify: `src/lib/cache.ts`

**Step 1: Write failing test**

Create: `tests/unit/lib/cache.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";

// Cache uses IndexedDB — use fake-indexeddb for testing
import "fake-indexeddb/auto";
import {
  getCachedNeeds,
  setCachedNeeds,
  getCachedRelief,
  setCachedRelief,
  type NeedsData,
  type ReliefData,
} from "@/lib/cache";

const mockNeedsData: NeedsData = {
  activeEvent: null,
  needsPoints: [],
  needsSummary: {
    total: 0,
    byStatus: { pending: 0, verified: 0, in_transit: 0, completed: 0, resolved: 0 },
    byGap: { lunas: 0, sustenance: 0, shelter: 0 },
    byAccess: { truck: 0, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
    critical: 0,
  },
};

const mockReliefData: ReliefData = {
  totalDonations: 500000,
  totalBeneficiaries: 1200,
  volunteerCount: 50,
  donationsByOrg: [{ name: "Red Cross", amount: 300000 }],
  deploymentHubs: [{ name: "Hub A", municipality: "San Fernando", count: 5 }],
  goodsByCategory: [{ name: "Meals", icon: null, total: 800 }],
  barangays: [{ name: "Catbangen", municipality: "San Fernando", beneficiaries: 400 }],
  deploymentPoints: [],
};

describe("cache — needs", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  it("returns null when no cached needs data exists", async () => {
    expect(await getCachedNeeds()).toBeNull();
  });

  it("round-trips needs data", async () => {
    await setCachedNeeds(mockNeedsData);
    const cached = await getCachedNeeds();
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(mockNeedsData);
    expect(cached!.updatedAt).toBeTypeOf("number");
  });
});

describe("cache — relief", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  it("returns null when no cached relief data exists", async () => {
    expect(await getCachedRelief()).toBeNull();
  });

  it("round-trips relief data", async () => {
    await setCachedRelief(mockReliefData);
    const cached = await getCachedRelief();
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(mockReliefData);
    expect(cached!.updatedAt).toBeTypeOf("number");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/cache.test.ts`
Expected: FAIL — `getCachedNeeds` does not exist.

**Step 3: Implement split cache**

Rewrite `src/lib/cache.ts`:

- Keep `DB_NAME = "luaid"` and `STORE_NAME = "dashboard"`
- Bump `DB_VERSION` to `3` (triggers `onupgradeneeded` → clears stale monolithic data)
- Export `NeedsData` type (subset: `activeEvent`, `needsPoints`, `needsSummary`)
- Export `ReliefData` type (subset: all the relief fields)
- Keep `DashboardData = NeedsData & ReliefData` as a convenience union (used by nothing after migration, but harmless)
- Use cache keys `"needs"` and `"relief"` instead of `"latest"`
- Export: `getCachedNeeds`, `setCachedNeeds`, `getCachedRelief`, `setCachedRelief`
- Keep old `getCachedDashboard`/`setCachedDashboard` temporarily (DashboardPage still uses them until Task 8)

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/cache.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass (old exports preserved).

**Step 6: Commit**

```bash
git add src/lib/cache.ts tests/unit/lib/cache.test.ts
git commit -m "feat(cache): split into needs and relief cache keys"
```

**Note:** Install `fake-indexeddb` as a dev dependency if not already present: `npm install -D fake-indexeddb`

---

### Task 3: Create NeedsPage

Extract the hero section + NeedsSummaryCards + NeedsCoordinationMap from DashboardPage into a new page that fetches only needs data.

**Files:**
- Create: `src/pages/NeedsPage.tsx`
- Create: `tests/unit/pages/NeedsPage.test.tsx`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NeedsPage } from "@/pages/NeedsPage";

vi.mock("@/lib/cache", () => ({
  getCachedNeeds: vi.fn(),
  setCachedNeeds: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  getNeedsMapPoints: vi.fn(),
  getNeedsSummary: vi.fn(),
  getActiveEvent: vi.fn(),
}));

vi.mock("@/components/maps/NeedsMap", () => ({
  default: () => <div data-testid="needs-map" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/en", search: "", hash: "", state: null, key: "default" }),
  Link: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>{children}</a>
  ),
  NavLink: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string | Function }) => (
    <a href={props.to} className={typeof props.className === "function" ? "" : props.className}>{children}</a>
  ),
}));

import { getNeedsMapPoints, getNeedsSummary, getActiveEvent } from "@/lib/queries";
import { getCachedNeeds, setCachedNeeds } from "@/lib/cache";

const emptyNeedsSummary = {
  total: 0,
  byStatus: { pending: 0, verified: 0, in_transit: 0, completed: 0, resolved: 0 },
  byGap: { lunas: 0, sustenance: 0, shelter: 0 },
  byAccess: { truck: 0, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
  critical: 0,
};

describe("NeedsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNeedsSummary).mockResolvedValue(emptyNeedsSummary);
    vi.mocked(getNeedsMapPoints).mockResolvedValue([]);
    vi.mocked(getActiveEvent).mockResolvedValue(null);
    vi.mocked(getCachedNeeds).mockResolvedValue(null);
    vi.mocked(setCachedNeeds).mockResolvedValue(undefined);
  });

  it("shows loading state initially", () => {
    render(<NeedsPage />);
    expect(screen.getByText("Dashboard.loading")).toBeInTheDocument();
  });

  it("renders hero and needs components after data loads", async () => {
    render(<NeedsPage />);
    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });
    expect(screen.getByText("Dashboard.subtitle")).toBeInTheDocument();
  });

  it("only calls needs-related queries, not relief queries", async () => {
    render(<NeedsPage />);
    await waitFor(() => {
      expect(getNeedsSummary).toHaveBeenCalled();
    });
    expect(getNeedsMapPoints).toHaveBeenCalled();
    expect(getActiveEvent).toHaveBeenCalled();
    // These should NOT be imported or called
    expect(vi.mocked(getNeedsSummary).mock.calls.length).toBe(1);
  });

  it("renders error state with retry button on fetch failure", async () => {
    vi.mocked(getNeedsSummary).mockRejectedValue(new Error("Network error"));

    render(<NeedsPage />);
    await waitFor(() => {
      expect(screen.getByText("Dashboard.loadError")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Dashboard.retry" })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pages/NeedsPage.test.tsx`
Expected: FAIL — module not found.

**Step 3: Implement NeedsPage**

Create `src/pages/NeedsPage.tsx` following the same pattern as DashboardPage but with only:
- Imports: `Header`, `NeedsSummaryCards`, `NeedsCoordinationMap`, `StatusFooter`
- Queries: `getActiveEvent`, `getNeedsSummary`, `getNeedsMapPoints`
- Cache: `getCachedNeeds` / `setCachedNeeds`
- JSX: hero section (moved from DashboardPage), `<NeedsSummaryCards>`, `<NeedsCoordinationMap>`
- Same offline/cache pattern (stale-while-revalidate, online/offline listeners)

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pages/NeedsPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/NeedsPage.tsx tests/unit/pages/NeedsPage.test.tsx
git commit -m "feat: create NeedsPage with hero, summary cards, and coordination map"
```

---

### Task 4: Create ReliefPage

Extract relief operations components from DashboardPage into a new page.

**Files:**
- Create: `src/pages/ReliefPage.tsx`
- Create: `tests/unit/pages/ReliefPage.test.tsx`

**Step 1: Write failing test**

Same structure as NeedsPage test but asserting:
- Renders `SummaryCards`, `DonationsByOrg`, `DeploymentHubs`, `GoodsByCategory`, `AidDistributionMap`
- Calls only relief-related queries
- Uses `getCachedRelief` / `setCachedRelief`
- Has the "Relief Operations" heading (`Dashboard.reliefOperations`)
- Has its own loading/error states

Mock only relief queries: `getTotalDonations`, `getTotalBeneficiaries`, `getVolunteerCount`, `getDonationsByOrganization`, `getDeploymentHubs`, `getGoodsByCategory`, `getBeneficiariesByBarangay`, `getDeploymentMapPoints`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pages/ReliefPage.test.tsx`
Expected: FAIL

**Step 3: Implement ReliefPage**

Create `src/pages/ReliefPage.tsx`:
- Imports: `Header`, `SummaryCards`, `DonationsByOrg`, `DeploymentHubs`, `GoodsByCategory`, `AidDistributionMap`, `StatusFooter`
- Queries: the 8 relief queries from DashboardPage
- Cache: `getCachedRelief` / `setCachedRelief`
- JSX: page heading + all relief components (same layout as the "Relief Operations" section of DashboardPage)
- Same offline/cache pattern

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pages/ReliefPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/ReliefPage.tsx tests/unit/pages/ReliefPage.test.tsx
git commit -m "feat: create ReliefPage with donations, deployments, goods, and distribution map"
```

---

### Task 5: Create StoriesPage placeholder

**Files:**
- Create: `src/pages/StoriesPage.tsx`
- Create: `tests/unit/pages/StoriesPage.test.tsx`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoriesPage } from "@/pages/StoriesPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/en/stories" }),
  Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
  NavLink: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
}));

describe("StoriesPage", () => {
  it("renders heading and coming soon message", () => {
    render(<StoriesPage />);
    expect(screen.getByText("Stories.title")).toBeInTheDocument();
    expect(screen.getByText("Stories.comingSoon")).toBeInTheDocument();
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement StoriesPage**

Minimal page: `Header`, heading with `t("Stories.title")`, paragraph with `t("Stories.comingSoon")`, `StatusFooter`. No data fetching.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/pages/StoriesPage.tsx tests/unit/pages/StoriesPage.test.tsx
git commit -m "feat: add StoriesPage placeholder for future CMS content"
```

---

### Task 6: Update Header with navigation links

Add nav links so users can switch between Needs, Relief, and Stories pages.

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `tests/unit/components/Header.test.tsx`

**Step 1: Write failing test**

Add test cases to the existing Header test file:

```typescript
it("renders navigation links for needs, relief, and stories", () => {
  render(<Header />);
  expect(screen.getByRole("link", { name: "Navigation.needs" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Navigation.relief" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Navigation.stories" })).toBeInTheDocument();
});

it("links point to locale-prefixed routes", () => {
  render(<Header />);
  expect(screen.getByRole("link", { name: "Navigation.needs" })).toHaveAttribute("href", "/en");
  expect(screen.getByRole("link", { name: "Navigation.relief" })).toHaveAttribute("href", "/en/relief");
  expect(screen.getByRole("link", { name: "Navigation.stories" })).toHaveAttribute("href", "/en/stories");
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement nav links**

Update `Header.tsx`:
- Import `NavLink` from `react-router` (for active-state styling)
- Add a `<nav>` element between the brand link and the right-side controls
- Three `NavLink` elements: Needs (`/:locale`), Relief (`/:locale/relief`), Stories (`/:locale/stories`)
- Use `NavLink`'s `className` callback: active link gets `text-neutral-50 border-b-2 border-primary`, inactive gets `text-neutral-400 hover:text-neutral-100`
- For the Needs link, use `end` prop so it only matches the exact index route

**Step 4: Run test — expect PASS**

**Step 5: Run full Header tests**

Run: `npx vitest run tests/unit/components/Header.test.tsx`
Expected: All pass (existing + new).

**Step 6: Commit**

```bash
git add src/components/Header.tsx tests/unit/components/Header.test.tsx
git commit -m "feat(header): add navigation links for needs, relief, and stories"
```

---

### Task 7: Update router and remove DashboardPage

Wire new pages into the router, remove old DashboardPage.

**Files:**
- Modify: `src/router.tsx`
- Delete: `src/pages/DashboardPage.tsx`
- Delete: `tests/unit/pages/DashboardPage.test.tsx`

**Step 1: Update router**

```typescript
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { NeedsPage } from "./pages/NeedsPage";
import { ReliefPage } from "./pages/ReliefPage";
import { StoriesPage } from "./pages/StoriesPage";
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
      { index: true, element: <NeedsPage /> },
      { path: "relief", element: <ReliefPage /> },
      { path: "stories", element: <StoriesPage /> },
      { path: "submit", element: <SubmitPage /> },
    ],
  },
]);
```

**Step 2: Delete old files**

```bash
rm src/pages/DashboardPage.tsx
rm tests/unit/pages/DashboardPage.test.tsx
```

**Step 3: Remove old cache exports**

In `src/lib/cache.ts`, remove `getCachedDashboard`, `setCachedDashboard`, and `DashboardData` (no longer used by anything).

**Step 4: Run unit tests**

Run: `npm test`
Expected: All pass. No remaining imports of DashboardPage or old cache functions.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(router): wire needs, relief, stories routes; remove DashboardPage"
```

---

### Task 8: Update E2E smoke tests

The Playwright tests reference `/:locale` expecting the old dashboard. Update them for the new route structure.

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

**Step 1: Update smoke tests**

Replace the single "dashboard renders" loop with tests for each page:

- **Needs page** (`/:locale`): Header brand, locale switcher, `<h1>`, nav links visible
- **Relief page** (`/:locale/relief`): Header brand, `<h1>`, relief content renders
- **Stories page** (`/:locale/stories`): Header brand, `<h1>`, coming soon text
- **Submit page** (`/:locale/submit`): Keep existing tests unchanged
- **Navigation tests**: Keep root redirect, invalid locale redirect, locale switcher. Add: clicking Relief nav link navigates to `/:locale/relief`

**Step 2: Run E2E tests**

Run: `npm run verify`
Expected: All pass.

**Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(e2e): update smoke tests for multi-page routing"
```

---

### Task 9: Update docs and verification rules

**Files:**
- Modify: `docs/routing-restructure.md` — mark status as "Implemented"
- Modify: `.claude/rules/verification.md` — update routes table

**Step 1: Update routing-restructure.md**

Change status line to: `**Status:** Implemented — see docs/plans/2026-03-30-routing-restructure.md`

**Step 2: Update verification.md routes table**

```markdown
| Route | Page | Key Elements |
|-------|------|-------------|
| `/:locale` | Needs | Header (`Kapwa Help`), nav links, `<h1>`, needs summary cards, needs map |
| `/:locale/relief` | Relief Operations | Header, `<h1>`, summary cards, donations, deployments, goods, distribution map |
| `/:locale/stories` | Stories | Header, `<h1>`, coming soon message |
| `/:locale/submit` | Submit Form | Header, `<h1>`, `<form>`, required fields |
```

**Step 3: Commit**

```bash
git add docs/routing-restructure.md .claude/rules/verification.md
git commit -m "docs: mark routing restructure as implemented, update verification routes"
```

---

### Task 10: Final verification

**Step 1: Run full unit test suite**

Run: `npm test`
Expected: All pass.

**Step 2: Run lint**

Run: `npm run lint`
Expected: Clean.

**Step 3: Build production**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

**Step 4: Run E2E smoke tests**

Run: `npm run verify`
Expected: All pass.

**Step 5: Visual spot-check**

Run: `npm run dev`
Manually verify:
- `localhost:5173/en` shows Needs page (hero + needs cards + map)
- `localhost:5173/en/relief` shows Relief page (donations, deployments, goods, distribution map)
- `localhost:5173/en/stories` shows Stories placeholder
- Nav links highlight correctly for current page
- Locale switcher preserves current page (e.g., `/en/relief` → `/fil/relief`)
