// Create (or reset the password of) a Flood Watch admin. Idempotent.
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… [ADMIN_NAME=…] npm run create:admin
// Tip: `read -s ADMIN_PASSWORD` (or a leading space before the command, on
// shells that support HISTCONTROL=ignorespace) keeps the password out of
// shell history.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_NAME ?? null;

if (!url || !serviceKey || !email || !password) {
  console.error(
    'Missing env. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD. Optional: ADMIN_NAME.',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey);

// Single page is fine at this project's scale (a handful of admins).
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error('listUsers failed:', listErr.message);
  process.exit(1);
}
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId: string;
if (existing) {
  // email_confirm matters here: invite-era users may still be unconfirmed,
  // and unconfirmed accounts cannot password-login.
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error('Password update failed:', error.message);
    process.exit(1);
  }
  userId = existing.id;
  console.log(`Updated password for existing user ${userId}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    console.error('User creation failed:', error?.message ?? 'no user returned');
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created user ${userId}`);
}

// Upsert the admin row directly — no trigger involved (the invite-era trigger
// was unreliable and is dropped by supabase/auth-password-migration.sql).
// Only touch display_name when ADMIN_NAME is explicitly set, so a
// password-reset rerun without it doesn't null out a previously stored name.
const row: { user_id: string; email: string; display_name?: string | null } = {
  user_id: userId,
  email,
};
if (process.env.ADMIN_NAME !== undefined) row.display_name = displayName;

const { error: upsertErr } = await admin.from('admin_users').upsert(row, { onConflict: 'user_id' });
if (upsertErr) {
  console.error('admin_users upsert failed:', upsertErr.message);
  process.exit(1);
}
console.log(`✔ ${email} can now sign in at the Flood Watch login page.`);
