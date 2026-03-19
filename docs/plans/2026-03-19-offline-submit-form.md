# Offline Submit Form Support

**Issue:** #43
**Branch:** `feat/offline-submit`
**Date:** 2026-03-19

## Problem

The submit form (`/:locale/submit`) requires network connectivity for both loading dropdown options (barangays, aid categories) and submitting reports. For an offline-first disaster relief app, this is a critical gap — volunteers in low-connectivity zones cannot file aid requests or feedback without signal.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cache architecture | Separate `form-cache.ts` with own IndexedDB DB | Avoids version migration risk with multi-tab PWA usage. Dashboard cache stays untouched. |
| Sync strategy | `online` event listener + flush on submit | Universal browser support, matches existing `DashboardPage` pattern. No SW changes needed. |
| Duplicate prevention | Client-generated UUIDs via `crypto.randomUUID()` | Idempotent replays — unique violation on PK = already synced. No schema changes. 5 lines of code. |
| Status UI | Inline success states + Header badge | Reuses existing success screen. Pending count badge on Report link via lightweight React context. |
| Sync feedback | Silent (badge decrements) | No interruptions. Volunteers notice organically. |

## Architecture

### New Files

**`src/lib/form-cache.ts`** — IndexedDB operations for form data.

Database: `luaid-forms`, version 1. Two object stores:

| Store | Key | Value | Purpose |
|-------|-----|-------|---------|
| `options` | `"barangays"` / `"aid_categories"` | `{ data: T[], updatedAt: number }` | Dropdown data cache |
| `outbox` | Auto-increment | `{ payload: SubmissionInsert, createdAt: number }` | Queued submissions |

Exported functions:

```ts
// Dropdown cache
getCachedOptions<T>(key: string): Promise<{ data: T[], updatedAt: number } | null>
setCachedOptions<T>(key: string, data: T[]): Promise<void>

// Outbox
addToOutbox(payload: SubmissionInsert): Promise<void>
getOutboxEntries(): Promise<{ key: IDBValidKey, payload: SubmissionInsert }[]>
removeFromOutbox(key: IDBValidKey): Promise<void>
getOutboxCount(): Promise<number>
```

**`src/lib/outbox-context.tsx`** — React context for pending count.

```ts
OutboxProvider   // wraps app in RootLayout
useOutbox()      // returns { pendingCount, refreshCount() }
```

On mount: reads `getOutboxCount()`. `refreshCount()` re-reads (called after submit or flush).

### Modified Files

**`src/components/SubmitForm.tsx`** — Three behavioral changes:

1. **Offline-aware dropdown loading:**
   - On mount: load from IndexedDB cache → render immediately
   - In parallel: fetch from Supabase → update cache + state on success
   - If fetch fails and no cache → show existing `loadError`
   - Loading spinner only shown if no cached data exists

2. **Offline-aware submission:**
   - Generate `crypto.randomUUID()` as client-side `id`
   - Try `insertSubmission()` → success: show "Report submitted!"
   - Catch: save to outbox → show "Report saved — will send when online"
   - Both paths lead to a success screen (different message text)

3. **Outbox flush on reconnect:**
   - New `useEffect` listens for `online` event → calls `flushOutbox()`
   - Also attempt flush on each form submit (if online)
   - Flush loop: for each entry, try insert → remove on success or unique violation (`23505`) → skip on other errors

**`src/components/Header.tsx`** — Pending count badge:
- `useOutbox()` context hook
- Badge renders on Report link when `pendingCount > 0`
- Uses `bg-warning` token, small pill shape

**`src/lib/queries.ts`** — Add optional `id` field to `SubmissionInsert` type.

**`src/components/RootLayout.tsx`** — Wrap children with `OutboxProvider`.

**`public/locales/{en,fil,ilo}/translation.json`** — 3 new keys:
- `SubmitForm.savedTitle` — "Report saved!"
- `SubmitForm.savedMessage` — "Will send when you're back online."
- `SubmitForm.pendingCount` — "{{count}} pending"

## Data Flow

```
User opens form
  ├─ IndexedDB has cached options? → render dropdowns immediately
  └─ Fetch from Supabase (background)
       ├─ Success → update state + cache
       └─ Fail → use cached data (or show loadError if no cache)

User submits form
  ├─ insertSubmission() succeeds → "Report submitted!" screen
  └─ insertSubmission() fails
       └─ addToOutbox() → "Report saved!" screen
            └─ Header badge shows pending count

Browser fires 'online' event
  └─ flushOutbox()
       └─ For each outbox entry:
            ├─ insertSubmission() succeeds → removeFromOutbox()
            ├─ Unique violation (23505) → removeFromOutbox() (already synced)
            └─ Other error → skip (retry next flush)
       └─ refreshCount() → Header badge updates
```

## Testing Plan

**`tests/unit/lib/form-cache.test.ts`** (new, ~6 tests):
- `getCachedOptions` returns null when empty
- `setCachedOptions` + `getCachedOptions` roundtrip
- `addToOutbox` + `getOutboxEntries` roundtrip
- `removeFromOutbox` removes specific entry
- `getOutboxCount` returns correct count
- Multiple outbox entries maintain order

**`tests/unit/components/SubmitForm.test.tsx`** (extend, ~4 new tests):
- Renders form with cached dropdown data when Supabase fetch fails
- Shows "saved offline" success message when submission fails + outbox saves
- Calls `flushOutbox` when `online` event fires
- Removes outbox entry on unique violation during flush

**`tests/unit/components/Header.test.tsx`** (extend, ~2 new tests):
- Shows pending count badge when outbox has items
- Hides badge when outbox count is 0

**Mocking:** Mock `form-cache.ts` exports at module level for component tests. Use `fake-indexeddb` for `form-cache.test.ts`.

## Implementation Order

1. `form-cache.ts` + tests (pure IndexedDB, no UI)
2. `outbox-context.tsx` (lightweight context provider)
3. `SubmitForm.tsx` offline dropdown loading + tests
4. `SubmitForm.tsx` offline submission + outbox + tests
5. `Header.tsx` pending badge + tests
6. `RootLayout.tsx` provider wrapper
7. i18n keys (all 3 locales)
8. Docs update (`architecture.md`, `CLAUDE.md`)
