# Database Audit Handoff — 2026-03-30

## Branch
`worktree-feat+needs-coordination` (PR #50) in worktree at `.claude/worktrees/feat+needs-coordination/`

## What happened
We seeded the Supabase production DB with demo data for the needs coordination feature. Multiple issues arose because the live DB had an older schema (missing tables, columns, CHECK constraints) that didn't match `supabase/schema.sql`. After several partial seed runs and manual fixes, data is in but the DB likely has inconsistencies.

## Known issues to diagnose

### 1. Duplicate rows (orgs & barangays)
The seed (`supabase/seed-demo.sql`) ran at least twice partially, creating duplicate organizations and barangays. The seed uses `INSERT ... RETURNING id` without `ON CONFLICT`, so each run creates new copies.

**Run these checks:**
```sql
SELECT name, count(*) as copies FROM organizations GROUP BY name HAVING count(*) > 1;
SELECT name, municipality, count(*) as copies FROM barangays GROUP BY name, municipality HAVING count(*) > 1;
```

Duplicates can't just be deleted — donations and deployments reference them via foreign keys. Need to: reassign FKs to the canonical row, then delete the extras.

### 2. Row count sanity check
```sql
SELECT
  (SELECT count(*) FROM events) as events,
  (SELECT count(*) FROM organizations) as orgs,
  (SELECT count(*) FROM barangays) as barangays,
  (SELECT count(*) FROM donations) as donations,
  (SELECT count(*) FROM deployments) as deployments,
  (SELECT count(*) FROM submissions) as submissions;
```
Expected: 1 event, ~18 orgs (without dupes), ~14 barangays (without dupes), ~8+ donations, ~46+ deployments, ~15 submissions (10 seed needs + 5 pre-existing requests).

### 3. Submissions breakdown
```sql
SELECT type, status, count(*) FROM submissions GROUP BY type, status;
```
Expected from seed: 5 verified needs, 2 in_transit, 2 completed, 1 pending. Plus 5 pre-existing "request/pending" rows.

### 4. CHECK constraints already fixed
These were manually updated — should now be correct but verify:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'submissions'::regclass AND contype = 'c';
```
- `submissions_type_check` should allow: `need, request, feedback`
- `submissions_status_check` should allow: `pending, verified, in_transit, completed, resolved`

### 5. RLS policies — confirmed OK
All 7 tables have correct RLS policies (verified via `pg_policies`).

## Code changes made this session

### `src/pages/DashboardPage.tsx`
Added null guards for needs components (lines 186, 189):
```tsx
{data.needsSummary && <NeedsSummaryCards summary={data.needsSummary} />}
{data.needsPoints && <NeedsCoordinationMap needsPoints={data.needsPoints} />}
```
This prevents the crash when Supabase returns no needs data.

### `supabase/schema.sql`
Changed all `CREATE TABLE` to `CREATE TABLE IF NOT EXISTS` and added `ON CONFLICT (name) DO NOTHING` to aid_categories seed inserts. **However**, this alone doesn't handle schema migrations — `IF NOT EXISTS` won't add missing columns or update constraints on existing tables.

## What needs to happen next

### Immediate (before merging PR #50)
1. **Run diagnostic queries** above to assess duplicate damage
2. **Clean up duplicates** — write a dedup script that keeps the oldest row per name, reassigns FKs, deletes extras
3. **Verify dashboard renders correctly** with clean data at `localhost:5173`

### For the PR itself
4. **Create `supabase/migrate-to-needs.sql`** — an idempotent migration script that:
   - Creates `events` table if missing
   - ALTERs `submissions` to add new columns (`event_id`, `gap_category`, `access_status`, `photo_url`, `verified_at`, `completed_at`)
   - ALTERs `deployments` to add `event_id` and `submission_id`
   - Drops and recreates CHECK constraints with new values
   - All using `IF NOT EXISTS` / `DROP ... IF EXISTS` patterns
5. **Make `seed-demo.sql` idempotent** — add `ON CONFLICT` to org and barangay inserts, or guard with existence checks
6. **Commit the DashboardPage.tsx fix** and schema.sql changes

### Lesson learned
> `Problem:` `CREATE TABLE IF NOT EXISTS` silently skips tables that exist with outdated constraints/columns, causing runtime errors with new data
> `Rule:` When adding enum values to CHECK constraints or new columns, always provide explicit ALTER/DROP+ADD migration statements. `IF NOT EXISTS` only helps with table creation, not schema evolution.

## Dev server
Running from the worktree: `npm run dev` at `localhost:5173`
Kill with: `lsof -ti:5173 | xargs kill -9`
