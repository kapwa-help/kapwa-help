-- One-time cleanup after the 2026-08-28 password-auth redesign.
-- Run against the live project (SQL editor or: supabase db query --linked -f supabase/auth-password-migration.sql)
-- Admin rows are now created by scripts/create-admin.ts; the invite-era
-- trigger is unreliable (fires before invite metadata exists) and unused.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
