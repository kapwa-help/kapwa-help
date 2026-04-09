# Supabase Realtime Subscriptions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Live-update the Relief Map and Transparency pages when any coordinator changes data, using Supabase Realtime `postgres_changes` subscriptions.

**Architecture:** Each page component subscribes to a Supabase Realtime channel on mount, listening to its relevant tables. On any change event, the existing `fetchData()` is called to refresh all data and update the "Last Updated" timestamp. Channel is cleaned up on unmount. No surgical state updates — full refetch keeps it simple and correct.

**Tech Stack:** `@supabase/supabase-js` v2 (already installed), Vitest + RTL for tests.

**Issue:** #69

---

### Task 1: Add Realtime subscription to ReliefMapPage

**Files:**
- Modify: `src/pages/ReliefMapPage.tsx`

**Step 1: Add the Realtime useEffect**

Add a new `useEffect` after the existing online/offline listener (after line 77). This subscribes to `needs`, `deployment_hubs`, and `hazards` tables:

```tsx
useEffect(() => {
  const channel = supabase
    .channel("relief-map-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "needs" },
      () => fetchData(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deployment_hubs" },
      () => fetchData(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hazards" },
      () => fetchData(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [fetchData]);
```

Add `supabase` to the imports from `@/lib/supabase`.

**Step 2: Run the build to verify no type errors**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/pages/ReliefMapPage.tsx
git commit -m "feat: add Supabase Realtime subscription to ReliefMapPage

Subscribe to postgres_changes on needs, deployment_hubs, and hazards
tables. On any change, call fetchData() to refresh map data and
update the Last Updated timestamp. Closes #69 (partial)."
```

---

### Task 2: Add Realtime subscription to TransparencyPage

**Files:**
- Modify: `src/pages/TransparencyPage.tsx`

**Step 1: Add the Realtime useEffect**

Add a new `useEffect` after the existing init/online effect (after line 79). This subscribes to `needs`, `donations`, and `purchases` tables:

```tsx
useEffect(() => {
  const channel = supabase
    .channel("transparency-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "needs" },
      () => fetchData(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "donations" },
      () => fetchData(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchases" },
      () => fetchData(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [fetchData]);
```

Add `supabase` to the imports from `@/lib/supabase`.

**Step 2: Run the build to verify no type errors**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/pages/TransparencyPage.tsx
git commit -m "feat: add Supabase Realtime subscription to TransparencyPage

Subscribe to postgres_changes on needs, donations, and purchases
tables. On any change, call fetchData() to refresh transparency
data and update the Last Updated timestamp."
```

---

### Task 3: Add unit tests for Realtime subscriptions

**Files:**
- Create: `tests/unit/pages/ReliefMapPage.test.tsx`

**Step 1: Write the test**

Test that the component subscribes to a Realtime channel on mount and cleans up on unmount. Mock Supabase's channel API:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
const mockRemoveChannel = vi.fn();
const mockChannel = vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@/lib/cache", () => ({
  getCachedReliefMap: vi.fn().mockResolvedValue(null),
  setCachedReliefMap: vi.fn(),
}));

// Must import after mocks
const { ReliefMapPage } = await import("@/pages/ReliefMapPage");

describe("ReliefMapPage Realtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire mockOn chain after clearing
    mockOn.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
  });

  it("subscribes to realtime channel on mount", () => {
    render(<ReliefMapPage />);
    expect(mockChannel).toHaveBeenCalledWith("relief-map-changes");
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "needs" },
      expect.any(Function),
    );
  });

  it("removes channel on unmount", () => {
    const { unmount } = render(<ReliefMapPage />);
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/pages/ReliefMapPage.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/pages/ReliefMapPage.test.tsx
git commit -m "test: add unit tests for ReliefMapPage Realtime subscription"
```

---

### Task 4: Run full verification

**Step 1: Run all unit tests**

Run: `npm test`
Expected: All tests pass.

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Run smoke tests**

Run: `npm run verify`
Expected: All smoke tests pass.

**Step 4: Manual verification (two-tab test)**

1. Run `npm run dev`
2. Open Relief Map in two browser tabs
3. In tab 1, change a need's status
4. Confirm tab 2 updates within ~1-2 seconds (map pins + Last Updated timestamp)

---

### Task 5: Supabase Dashboard — Enable Realtime

**Note:** This is a manual step, not code.

Verify that Realtime is enabled for the following tables in the Supabase dashboard (Database → Replication):
- `needs`
- `deployment_hubs`
- `hazards`
- `donations`
- `purchases`

If not enabled, toggle Realtime on for each table. This is required for `postgres_changes` subscriptions to receive events.
