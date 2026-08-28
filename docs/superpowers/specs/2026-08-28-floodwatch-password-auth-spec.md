# Spec: Flood Watch auth v2 — email + password, Flood Watch only

**Approved:** 2026-08-28 by Jacob.

## Problem

The magic-link auth from PR #95 repeatedly failed the second admin (Hannah): Supabase's
built-in email service rate limit (~2/hour), single-use links consumed by institutional
mail link-scanners (`otp_expired`), redirect misconfigurations, and network errors. Three
hotfixes later it still isn't reliable. Additionally, production currently runs with
`VITE_AUTH_MODE=""` (open mode), so the UI pretends everyone is an admin while flood RLS
correctly refuses non-admin reads/writes — the two gating layers disagree.

Auth is now needed **only for the Flood Watch admin page** ("project within a project").
Admins are Jacob + Hannah, maybe 1–2 more later; manual provisioning is acceptable.
The subdomain `floodwatch.kapwahelp.org` is live and should become Flood Watch's
canonical home.

## Requirements

1. **Login = email + password, scoped to Flood Watch.**
   - Login form (email + password → `supabase.auth.signInWithPassword`). No email
     sending, links, expiry, rate limits, or redirect allow-lists at login time.
   - `/floodwatch/admin` requires a real session + `admin_users` row, always — the
     `AUTH_MODE` open/strict concept is deleted. Add a logout button.
   - Admin gate stays: `admin_users` row presence + RLS `is_admin()` (unchanged in DB).

2. **Subdomain is canonical.**
   - On `floodwatch.kapwahelp.org`: `/` = public map, `/admin` = moderation, `/login`.
   - `kapwahelp.org/floodwatch*` → permanent redirect to `floodwatch.kapwahelp.org/*`
     via `vercel.json` host-scoped redirects (old URLs keep working — never break a
     public URL).
   - Path-based `/floodwatch*` routes must keep working on localhost / previews.

3. **Delete the fragile machinery.**
   - Remove: magic-link login, `InviteAdminModal` (+ test), `invite-admin` edge
     function, invite buttons (Header + admin page), `AUTH_MODE` / open-strict concept,
     `use-auth` open-mode branches, `handle_new_user` trigger (repo SQL + live-DB
     migration script).
   - Demo relief pages (`/demo/:locale/*`) become permanently ungated — identical to
     today's deployed open-mode behavior. `AdminOnly` and demo `isAdmin` branches are
     removed. `/demo/:locale/login` redirects to the Flood Watch login. `/auth/callback`
     remains a route (old emails link to it) that redirects to the login page.
   - Replace `scripts/bootstrap-admin.ts` with `scripts/create-admin.ts`: creates (or
     resets the password of) a user and upserts the `admin_users` row via service key.
     One command per new admin — the manual process.

4. **Manual steps (Supabase writes need Jacob's go).**
   - Verify `admin_users` + `is_admin()` exist on the live project (read-only), then
     run `create-admin` for Jacob + Hannah; send Hannah her temp password via WhatsApp.
   - Disable public email signups in Supabase dashboard; run the trigger-drop migration;
     delete the deployed `invite-admin` edge function; remove `VITE_AUTH_MODE` from
     Vercel.

## Non-goals

- Password reset flows (Jacob resets via `create-admin` re-run or dashboard).
- i18n for admin-facing pages (login/admin stay hardcoded English, as v1 did).
- Any change to flood RLS policies or the relief-platform prod hardening
  (`rls-prod.sql` stays in-repo for a future production phase).
