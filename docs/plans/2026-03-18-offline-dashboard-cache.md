# Offline Dashboard Cache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cache the dashboard data in IndexedDB so the dashboard renders instantly from cache and works fully offline.

**Architecture:** Single-blob caching at the dashboard level. On mount, read cached `DashboardData` + timestamp from IndexedDB and render immediately. Fetch fresh data from Supabase in the background. On success, update the UI and cache. On failure, keep showing cached data with an "Offline" indicator. When the browser comes back online, auto-refetch.

**Tech Stack:** IndexedDB (browser API, no libraries), React state, `navigator.onLine` + `online`/`offline` events.

**Closes:** GitHub issue #10 (read-cache portion)

---

### Task 1: Create the IndexedDB cache utility

**Files:**
- Create: `src/lib/cache.ts`

**Step 1: Write the cache module**

```ts
const DB_NAME = "luaid";
const DB_VERSION = 1;
const STORE_NAME = "dashboard";
const CACHE_KEY = "latest";

type CachedDashboard = {
  data: {
    totalDonations: number;
    totalBeneficiaries: number;
    volunteerCount: number;
    donationsByOrg: { name: string; amount: number }[];
    deploymentHubs: { name: string; municipality: string; count: number }[];
    goodsByCategory: { name: string; icon: string | null; total: number }[];
    barangays: { name: string; municipality: string; beneficiaries: number }[];
    deploymentPoints: {
      lat: number;
      lng: number;
      quantity: number | null;
      unit: string | null;
      orgName: string;
      categoryName: string;
    }[];
  };
  updatedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedDashboard(): Promise<CachedDashboard | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedDashboard(
  data: CachedDashboard["data"]
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, updatedAt: Date.now() } satisfies CachedDashboard, CACHE_KEY);
  } catch {
    // Cache write failure is non-critical — silently ignore
  }
}
```

**Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`
Expected: Clean build, no TypeScript errors.

**Step 3: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat: add IndexedDB cache utility for dashboard data"
```

---

### Task 2: Wire cache into DashboardPage

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

This is the core change. The new data flow:

1. On mount → read cache → if found, set `data` + `updatedAt` and skip loading state
2. Fetch from Supabase in background (regardless of cache hit)
3. On fetch success → update `data` + `updatedAt`, write to cache
4. On fetch failure → if cached data exists, keep showing it; if no cache, show error state
5. Listen for `online` event → re-fetch automatically

**Step 1: Update DashboardPage with cache integration**

Replace the entire `DashboardPage.tsx` with:

```tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SummaryCards from "@/components/SummaryCards";
import DonationsByOrg from "@/components/DonationsByOrg";
import DeploymentHubs from "@/components/DeploymentHubs";
import GoodsByCategory from "@/components/GoodsByCategory";
import AidDistributionMap from "@/components/AidDistributionMap";
import StatusFooter from "@/components/StatusFooter";
import { getCachedDashboard, setCachedDashboard } from "@/lib/cache";
import {
  getTotalDonations,
  getTotalBeneficiaries,
  getVolunteerCount,
  getDonationsByOrganization,
  getDeploymentHubs,
  getGoodsByCategory,
  getBeneficiariesByBarangay,
  getDeploymentMapPoints,
} from "@/lib/queries";

type DashboardData = {
  totalDonations: number;
  totalBeneficiaries: number;
  volunteerCount: number;
  donationsByOrg: { name: string; amount: number }[];
  deploymentHubs: { name: string; municipality: string; count: number }[];
  goodsByCategory: { name: string; icon: string | null; total: number }[];
  barangays: { name: string; municipality: string; beneficiaries: number }[];
  deploymentPoints: {
    lat: number;
    lng: number;
    quantity: number | null;
    unit: string | null;
    orgName: string;
    categoryName: string;
  }[];
};

export function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [
        totalDonations,
        totalBeneficiaries,
        volunteerCount,
        donationsByOrg,
        deploymentHubs,
        goodsByCategory,
        barangays,
        deploymentPoints,
      ] = await Promise.all([
        getTotalDonations(),
        getTotalBeneficiaries(),
        getVolunteerCount(),
        getDonationsByOrganization(),
        getDeploymentHubs(),
        getGoodsByCategory(),
        getBeneficiariesByBarangay(),
        getDeploymentMapPoints(),
      ]);

      const freshData: DashboardData = {
        totalDonations,
        totalBeneficiaries,
        volunteerCount,
        donationsByOrg,
        deploymentHubs,
        goodsByCategory,
        barangays,
        deploymentPoints,
      };

      setData(freshData);
      setUpdatedAt(new Date());
      setError(null);
      setCachedDashboard(freshData);
    } catch (e) {
      // Only set error if we have no data at all (no cache)
      if (!hasFetchedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: load cache, then fetch fresh data
  useEffect(() => {
    async function init() {
      const cached = await getCachedDashboard();
      if (cached) {
        setData(cached.data);
        setUpdatedAt(new Date(cached.updatedAt));
        setLoading(false);
        hasFetchedRef.current = true;
      }
      fetchData();
    }
    init();
  }, [fetchData]);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchData();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">{t("Dashboard.loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-error">{t("Dashboard.loadError")}</p>
        <button
          onClick={fetchData}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/80"
        >
          {t("Dashboard.retry")}
        </button>
      </div>
    );
  }

  const totalDeployments = data.deploymentHubs.reduce(
    (sum, h) => sum + h.count,
    0
  );

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-50">
            {t("Dashboard.hero")}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {t("Dashboard.subtitle")}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            {updatedAt
              ? `${t("Dashboard.lastUpdated")}: ${updatedAt.toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}`
              : ""}
            {isOffline && (
              <span className="ml-2 text-warning">· Offline</span>
            )}
          </p>
        </div>
        <SummaryCards
          totalDonations={data.totalDonations}
          totalBeneficiaries={data.totalBeneficiaries}
          volunteerCount={data.volunteerCount}
          orgCount={data.donationsByOrg.length}
          locationCount={data.barangays.length}
          deploymentCount={totalDeployments}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DonationsByOrg donations={data.donationsByOrg} />
          <DeploymentHubs hubs={data.deploymentHubs} />
          <GoodsByCategory categories={data.goodsByCategory} />
        </div>
        <AidDistributionMap
          barangays={data.barangays}
          deploymentPoints={data.deploymentPoints}
        />
      </main>
      <StatusFooter />
    </div>
  );
}
```

**Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: integrate IndexedDB cache with stale-while-revalidate"
```

---

### Task 3: Add i18n key for offline indicator

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

**Step 1: Add the `offline` key to all three locale files**

In `en/translation.json`, add to the `Dashboard` object:
```json
"offline": "Offline"
```

In `fil/translation.json`, add:
```json
"offline": "Offline"
```

In `ilo/translation.json`, add:
```json
"offline": "Offline"
```

Note: "Offline" is commonly used as-is in Filipino and Ilocano (tech loanword). Can be localized later via issue #34.

**Step 2: Update DashboardPage to use the i18n key**

In `src/pages/DashboardPage.tsx`, change the hardcoded "Offline" string:

```tsx
// Change this:
<span className="ml-2 text-warning">· Offline</span>

// To this:
<span className="ml-2 text-warning">· {t("Dashboard.offline")}</span>
```

**Step 3: Commit**

```bash
git add public/locales/ src/pages/DashboardPage.tsx
git commit -m "feat: add offline indicator i18n key"
```

---

### Task 4: Update DashboardPage tests

**Files:**
- Modify: `tests/unit/pages/DashboardPage.test.tsx`

**Step 1: Add cache mock and new test cases**

Add a mock for the cache module alongside the existing query mock:

```ts
vi.mock("@/lib/cache", () => ({
  getCachedDashboard: vi.fn(),
  setCachedDashboard: vi.fn(),
}));
```

Import it:

```ts
import { getCachedDashboard, setCachedDashboard } from "@/lib/cache";
```

Update `beforeEach` to default the cache to empty:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  mockQueries();
  vi.mocked(getCachedDashboard).mockResolvedValue(null);
  vi.mocked(setCachedDashboard).mockResolvedValue(undefined);
});
```

Add these test cases:

```tsx
it("renders cached data immediately when cache exists", async () => {
  vi.mocked(getCachedDashboard).mockResolvedValue({
    data: {
      totalDonations: 500000,
      totalBeneficiaries: 1200,
      volunteerCount: 50,
      donationsByOrg: [
        { name: "Red Cross", amount: 300000 },
        { name: "LGU", amount: 200000 },
      ],
      deploymentHubs: [
        { name: "Hub A", municipality: "San Fernando", count: 5 },
      ],
      goodsByCategory: [{ name: "Meals", icon: null, total: 800 }],
      barangays: [
        { name: "Catbangen", municipality: "San Fernando", beneficiaries: 400 },
      ],
      deploymentPoints: [
        { lat: 16.62, lng: 120.35, quantity: 200, unit: "meals", orgName: "Red Cross", categoryName: "Meals" },
      ],
    },
    updatedAt: Date.now(),
  });

  render(<DashboardPage />);

  await waitFor(() => {
    expect(screen.getByText("₱500,000")).toBeInTheDocument();
  });

  expect(screen.getByText(/Dashboard.lastUpdated/)).toBeInTheDocument();
});

it("shows cached data when fetch fails but cache exists", async () => {
  vi.mocked(getCachedDashboard).mockResolvedValue({
    data: {
      totalDonations: 500000,
      totalBeneficiaries: 1200,
      volunteerCount: 50,
      donationsByOrg: [{ name: "Red Cross", amount: 300000 }],
      deploymentHubs: [
        { name: "Hub A", municipality: "San Fernando", count: 5 },
      ],
      goodsByCategory: [{ name: "Meals", icon: null, total: 800 }],
      barangays: [
        { name: "Catbangen", municipality: "San Fernando", beneficiaries: 400 },
      ],
      deploymentPoints: [],
    },
    updatedAt: Date.now(),
  });

  // All queries fail
  vi.mocked(getTotalDonations).mockRejectedValue(new Error("Network error"));

  render(<DashboardPage />);

  // Should show cached data, not error state
  await waitFor(() => {
    expect(screen.getByText("₱500,000")).toBeInTheDocument();
  });

  expect(screen.queryByText("Dashboard.loadError")).not.toBeInTheDocument();
});

it("shows error state when both cache and fetch fail", async () => {
  vi.mocked(getCachedDashboard).mockResolvedValue(null);
  vi.mocked(getTotalDonations).mockRejectedValue(new Error("Network error"));

  render(<DashboardPage />);

  await waitFor(() => {
    expect(screen.getByText("Dashboard.loadError")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify all pass**

Run: `npm test`
Expected: All tests pass (existing + 3 new).

**Step 3: Commit**

```bash
git add tests/unit/pages/DashboardPage.test.tsx
git commit -m "test: add offline cache scenarios for DashboardPage"
```

---

### Task 5: Update docs

**Files:**
- Modify: `docs/architecture.md` — add "Offline Caching" section
- Modify: `CLAUDE.md` — add `src/lib/cache.ts` to project structure

**Step 1: Add offline caching section to architecture.md**

Add after the existing "Dashboard" or "Data Flow" section:

```markdown
## Offline Caching

The dashboard uses a stale-while-revalidate pattern backed by IndexedDB:

- **Cache utility** (`src/lib/cache.ts`): Two functions — `getCachedDashboard()` and `setCachedDashboard(data)`. Stores the entire `DashboardData` blob + timestamp in a single IndexedDB object store.
- **Data flow**: On page load, cached data renders immediately. Fresh data is fetched in the background and replaces the cache on success.
- **Offline indicator**: The hero section shows "Last Updated: [timestamp]" and appends "· Offline" when `navigator.onLine` is false.
- **Auto-refresh**: When the browser regains connectivity (`online` event), the dashboard automatically re-fetches.
- **Future**: Per-query caching can be added when additional pages (barangay triage board, forms) need to share cached query results.
```

**Step 2: Update CLAUDE.md project structure**

Add `cache.ts` to the `lib/` section:

```
  lib/
    supabase.ts       # Supabase client (anon key via import.meta.env)
    queries.ts        # Typed query functions for dashboard sections
    cache.ts          # IndexedDB cache for offline dashboard data
```

**Step 3: Commit**

```bash
git add docs/architecture.md CLAUDE.md
git commit -m "docs: add offline caching architecture and update project structure"
```
