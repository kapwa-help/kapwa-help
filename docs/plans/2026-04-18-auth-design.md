# Auth Design — Kapwa Help

**Date:** 2026-04-18
**Status:** Approved, ready for implementation planning
**Supersedes:** N/A (first auth design)

## Context

Kapwa Help currently runs with no authentication — every Supabase table uses permissive RLS policies that allow anon reads and writes across the board. This is fine for the demo phase (fake seed data, no real users) but unsafe for any real disaster-relief deployment, where:

- Admin-only actions (donations, purchases, lifecycle transitions on needs) must be restricted to authenticated coordinators.
- Reporter contact info on `needs` and `hazards` (`contact_name`, `contact_phone`) must not be scraped by anonymous internet actors — scammers targeting disaster victims is a known post-typhoon pattern in PH.
- Audit of who verified, delivered, or recorded each action is needed for coordination accountability.

This document specifies the minimal auth system needed to unblock a real deployment, while preserving the demo's "anyone can click around" experience.

## Goals

- Admins log in with minimal friction, no passwords.
- Only existing admins can grant admin privileges to others (invite-only).
- Anonymous visitors can view public data (map, aggregate stats) and submit need/hazard reports, just as they can today.
- Reporter PII (`contact_name`, `contact_phone`) is visible only to admins.
- Demo and prod environments are fully isolated — the demo can remain permissive for public browsing, while prod enforces full auth gating.
- The same codebase serves both environments, with environment differences expressed only in env vars.
- Offline capability is preserved: admin sessions survive offline periods, admin actions continue to queue via the existing outbox when offline.

## Non-goals (explicitly deferred)

- **Middle "volunteer" tier**. Schema supports it (`user_role` enum; additional roles can be added without migration), but v1 has only `'admin'` as a functional role. `'viewer'` is reserved as the default-for-any-signup.
- **Event-scoped admins**. Admins are global across all events. An `admin_events` junction table can be added later if coordination spans independent relief operations.
- **Google OAuth / phone OTP**. Magic link only for v1; other providers are a dashboard toggle if needed later.
- **Admin demotion / deletion UI**. Schema supports it via `profiles.role`; no UI wired up in v1.
- **Audit log viewer**. `created_by` / `verified_by` columns capture the data, but v1 has no UI to surface it.
- **Multi-locale invite emails**. English only for v1.
- **Rate limiting on invites**. Not addressed at the app layer; Supabase's built-in per-project rate limits are considered sufficient for v1.

## Deployment model

**Two Supabase projects**, both in the new "Kapwa Help" Supabase organization:

| Project | Purpose | RLS | Seed | Signup |
|---|---|---|---|---|
| `kapwa-help-demo` | Public demo at `kapwahelp.org` | Permissive (anon can do everything) | Demo fake data | Disabled |
| `kapwa-help-prod` | Real disaster-relief deployments | Strict (auth-gated) | None | Disabled (invite-only) |

Both on Supabase free tier — two projects per org is the free-tier allowance. Singapore region for low latency to PH.

**One codebase** serves both. Environment variables select the target project and the UI mode:

```
VITE_SUPABASE_URL         # per-project
VITE_SUPABASE_ANON_KEY    # per-project
VITE_AUTH_MODE            # 'open' (demo) or 'strict' (prod)
```

`VITE_AUTH_MODE` controls whether the login UI is visible and whether admin-only components render unconditionally. It does **not** affect security — security is enforced by RLS on whichever project the client is talking to.

**Deployment targets**:

- `kapwahelp.org` → demo project, `VITE_AUTH_MODE=open`.
- Prod URL (TBD — see open questions) → prod project, `VITE_AUTH_MODE=strict`.

## Role model

Two roles, stored in a `user_role` enum:

- `admin`: can perform all writes (donations, purchases, need lifecycle transitions, deployments, hub management), can read full `needs` and `hazards` tables including PII, can invite other admins.
- `viewer`: default for any new signup (used only if Supabase public signup is accidentally enabled; functionally equivalent to anonymous — no gated capabilities).

Anonymous visitors have no row in `profiles`. Their capabilities are defined entirely by RLS on tables and views.

## Schema changes

Applied via a **full rewrite** of `supabase/schema.sql`. No `ALTER TABLE` migrations — this is a state-based schema definition applied to fresh projects.

### New enum

```sql
create type user_role as enum ('admin', 'viewer');
```

### New table: `profiles`

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role user_role not null default 'viewer',
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```

### Audit columns on existing tables (inlined into `CREATE TABLE`)

```sql
-- On `needs`:
  created_by uuid references auth.users(id),
  verified_by uuid references auth.users(id),

-- On `donations`, `purchases`, `deployments`:
  created_by uuid references auth.users(id),
```

All inlined into the `CREATE TABLE` statements in `schema.sql`; no `ALTER`.

### New public views

```sql
create view needs_public as
  select id, event_id, hub_id, lat, lng, access_status, urgency,
         status, num_people, notes, delivery_photo_url, created_at
    from needs;

create view hazards_public as
  select id, event_id, description, photo_url, latitude, longitude,
         status, created_at
    from hazards;

grant select on needs_public to anon, authenticated;
grant select on hazards_public to anon, authenticated;
```

Views omit `contact_name` and `contact_phone` on needs; `reported_by` and `contact_phone` on hazards.

The views rely on Postgres's default `security_invoker = off` behavior — queries against the view run with the view owner's permissions (superuser in Supabase), which deliberately bypasses RLS on the underlying base tables. This is the intended mechanism for exposing a non-PII subset of `needs` and `hazards` to anonymous readers. Supabase's `security_invoker_view` lint warning can be suppressed for these two views with a `-- supabase:ignore` directive or noted as intentional in code review.

### Trigger: auto-provision `profiles` on signup

```sql
create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, role, invited_by, display_name)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'viewer'),
    (new.raw_user_meta_data ->> 'invited_by')::uuid,
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

Metadata values (`role`, `invited_by`, `display_name`) are set by the `invite-admin` edge function. Defaults ensure any non-invite signup (e.g., accidental direct signup) lands as `viewer` with no admin capabilities.

## RLS — demo vs prod

Two files replace the existing `supabase/rls-policies.sql`:

### `rls-demo.sql` (demo project only)

Permissive policies equivalent to the current setup — anon `SELECT`, `INSERT`, `UPDATE` on all tables. Effectively a renamed copy of today's `rls-policies.sql`.

### `rls-prod.sql` (prod project only)

Strict policies. Uses a helper:

```sql
create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;
```

Access matrix:

| Table / View | anon SELECT | anon INSERT | admin SELECT | admin INSERT/UPDATE/DELETE |
|---|---|---|---|---|
| `needs` (base table) | ❌ (use view) | ✅ | ✅ | ✅ |
| `needs_public` (view) | ✅ (granted) | — | ✅ | — |
| `hazards` (base table) | ❌ (use view) | ✅ | ✅ | ✅ |
| `hazards_public` (view) | ✅ (granted) | — | ✅ | — |
| `need_categories` | ❌ | via RPC only | ✅ | ✅ |
| `donation_categories`, `purchase_categories` | ❌ | ❌ | ✅ | ✅ |
| `donations`, `purchases`, `deployments` | ❌ | ❌ | ✅ | ✅ |
| `events`, `organizations`, `deployment_hubs`, `aid_categories`, `hub_inventory` | ✅ (dashboard needs them) | ❌ | ✅ | ✅ (admin only) |
| `profiles` | own row only | ❌ | ✅ (all rows) | via edge function only |

### Anon insert of needs — how RPC interacts with RLS

The existing `insert_need` RPC function wraps `needs` + `need_categories` inserts in a transaction. Under strict RLS, the function runs `security definer` so it can write the junction row even though anon has no direct `need_categories` insert permission. The RPC is granted to `anon` and `authenticated`.

`insert_donation`, `insert_purchase`, and `create_deployment` RPCs are granted only to `authenticated` and check `is_admin()` in the function body (fail-closed).

`insert_need` populates `created_by = auth.uid()` when `auth.uid()` is not null; leaves it null for true anon submissions.

## Invite flow

### Supabase auth provider settings (prod project)

- Magic link only. Supabase dashboard → Authentication → Providers: only "Email" enabled, magic link flow.
- Public signup disabled: Authentication → Settings → "Allow new users to sign up" = off.
- Session lifetime: 180 days refresh token rotation.
- Invite email template customized: subject `"You've been invited to Kapwa Help"`, body with a clear activation button linked to `{{ .ConfirmationURL }}`.

### Edge function: `invite-admin`

Location: `supabase/functions/invite-admin/index.ts`. Deployed to prod project only.

Responsibilities:

1. Read the caller's JWT from the `Authorization` header.
2. Look up the caller's `profiles.role`; reject with 403 if not `'admin'`.
3. Parse `{ email, display_name? }` from request body.
4. Call `adminClient.auth.admin.inviteUserByEmail(email, { data: { role: 'admin', invited_by: <caller_uid>, display_name } })` using the service role key.
5. Return success or error JSON.

The `profiles` row for the invitee is created automatically by the `handle_new_user` trigger when Supabase creates the `auth.users` row.

Secrets: `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` injected as edge function secrets (never reach the browser).

### First admin bootstrap

Once per prod-project lifetime. The prod hosting deployment isn't required at this point — bootstrap can happen purely via Supabase admin API from a local script.

**Preferred path (no prod app deployment needed):**

1. From your laptop, run a one-off Node script with the prod service role key (never commit it — use `.env.local`):
   ```js
   import { createClient } from '@supabase/supabase-js';
   const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
   await admin.auth.admin.createUser({
     email: 'jacob@example.com',
     email_confirm: true,
     user_metadata: { role: 'admin' },
   });
   ```
   The `handle_new_user` trigger auto-provisions the matching `profiles` row with `role='admin'` from the metadata.
2. Verify in the Supabase dashboard: `auth.users` has your row, `public.profiles` has `role='admin'`.
3. Done. Next time prod hosting is deployed, request a magic link from the login UI and you'll land as admin.

**Fallback path (if the script above isn't convenient):** temporarily enable public signup in the dashboard, deploy prod hosting, request a magic link, run `update profiles set role = 'admin' where email = '...'` in the SQL editor, then disable public signup again.

## Client-side changes

### New files

- `src/hooks/use-auth.ts` — reads Supabase auth state + `profiles.role`, returns `{ user, role, isAdmin, login, logout }`.
- `src/pages/login.tsx` — magic link request form.
- `src/pages/auth-callback.tsx` — handles the Supabase auth callback URL.
- `src/components/invite-admin-modal.tsx` — admin-only, calls the edge function.
- `src/lib/auth-mode.ts` — exports `AUTH_MODE` constant (`'open' | 'strict'`) read from `VITE_AUTH_MODE`.

### Modified files

- `src/lib/queries.ts` — switch anon read queries to use `_public` views; admin queries continue to use base tables.
- `src/lib/supabase.ts` — no changes (still uses anon key; JWT attaches automatically via supabase-js auth state).
- Routes and components that render admin-only UI — add `isAdmin` gates.

### Behavior by `AUTH_MODE`

- `AUTH_MODE === 'open'` (demo):
  - `isAdmin` is always `true` in the client.
  - No login UI is rendered.
  - Admin UI components that operate on database state (need verification, donations, purchases, deployments) render and function normally, because demo RLS is permissive.
  - The **Invite Admin** UI is suppressed specifically, because the invite path requires a real admin JWT to hit the edge function — there's no sensible "demo invite" behavior. The button is hidden; rendering it as a stub with a toast was considered and rejected as clutter.
  - Queries use base tables (readable by anon on demo due to permissive RLS).

- `AUTH_MODE === 'strict'` (prod):
  - `isAdmin` is derived from the user's `profiles.role`.
  - Login UI is rendered when no session exists.
  - Admin UI components are gated by `isAdmin`.
  - Anon-viewer queries use `_public` views; admin queries use base tables.

### Offline behavior

Admin JWTs are cached by supabase-js in `localStorage`. Admin actions made while offline (verifying a need, creating a deployment) continue to go through the existing outbox (`src/lib/outbox-context.tsx`). When the outbox replays on reconnection, the cached JWT is attached automatically by supabase-js. If the refresh token has expired during a long offline period, the replay fails with an auth error; surfacing a "please log in again" prompt is handled by the outbox's existing retry UI.

## Rollout

Single coordinated cutover, since the demo is not yet shared publicly and can be rebuilt without coordination overhead:

1. Create both Supabase projects in the Kapwa Help org. Singapore region. Both boxes checked: "Enable Data API" and "Enable automatic RLS."
2. In the repo:
   - Rewrite `supabase/schema.sql` with all new tables, columns, views, trigger inlined.
   - Rename `rls-policies.sql` → `rls-demo.sql`.
   - Add `rls-prod.sql` with strict policies + `is_admin()` helper.
   - Update `rpc-functions.sql` to populate `created_by` on insert functions.
   - Add `supabase/functions/invite-admin/index.ts`.
3. Apply to demo project: `schema.sql` → `rpc-functions.sql` → `rls-demo.sql` → `seed-demo.sql`.
4. Apply to prod project: `schema.sql` → `rpc-functions.sql` → `rls-prod.sql`. No seed.
5. Deploy `invite-admin` edge function to prod project via Supabase CLI.
6. Configure prod auth settings: magic link only, signup disabled (after bootstrap), 180d session, customized invite email.
7. Build client-side auth layer: `use-auth` hook, login/callback pages, invite modal, admin gating, query switching.
8. Update env vars for the existing `kapwahelp.org` deployment to point at `kapwa-help-demo`, `VITE_AUTH_MODE=open`. Cut over. Retire the old LUaid project once confirmed.
9. Bootstrap first admin on prod via a local Node script using the service role key (see "First admin bootstrap" above). No prod hosting needed yet.
10. Set up a separate prod hosting deployment (URL TBD) with `VITE_AUTH_MODE=strict` and prod env vars. Not yet public; awaits first real disaster deployment.

## Success criteria

- **Demo** at `kapwahelp.org` works identically to today: public read, public report submission, admin UI visible to all, no login friction.
- **Prod** deployment:
  - Anonymous visitor can view the map, dashboard, aggregate stats — no PII visible anywhere.
  - Anonymous visitor can submit a need or hazard via the existing public forms.
  - Non-admin (any logged-in `viewer`) sees the same as anonymous.
  - Admin logs in via magic link, sees full reporter PII, can verify and progress needs, create donations/purchases/deployments, invite other admins.
  - Admin session persists across offline periods; offline admin actions queue via outbox and replay on reconnect.
  - Direct anon attempts to `INSERT` into `donations`, `purchases`, `deployments` via the Supabase client are rejected by RLS with a 403.
  - Direct anon `SELECT` on `needs` / `hazards` base tables returns 0 rows (or 403); `_public` views return non-PII columns.
- **Audit trail**: `created_by` and `verified_by` populated on new prod records.
- **No regression** in demo behavior (`npm run verify` smoke tests pass against new demo project).

## Open questions

- **Prod hosting URL**: subdomain of `kapwahelp.org` (e.g., `app.`), separate domain per partner, or a generic operator domain? Decide before the first real deployment. Affects invite email link targets.
- **Email deliverability**: Supabase's built-in SMTP has low rate limits and middling deliverability. For actual disaster use, a custom SMTP provider (Resend or Mailgun, both free tiers) should be configured. Not a v1 blocker but a pre-real-deployment one.
- **Long offline admin sessions**: refresh tokens expire after 180 days of inactivity. If an admin's device is offline for longer, replay will fail with an auth error. Current plan relies on the outbox's generic retry surface; may need a dedicated "re-auth in place" flow if real-world patterns reveal pain.
