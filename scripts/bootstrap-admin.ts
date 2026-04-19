import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_EMAIL;
const displayName = process.env.BOOTSTRAP_DISPLAY_NAME ?? undefined;

if (!url || !serviceKey || !email) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or BOOTSTRAP_EMAIL');
  process.exit(1);
}

const admin = createClient(url, serviceKey);

const { data, error } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { role: 'admin', display_name: displayName },
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

console.log('Created auth.users row:', data.user?.id);
console.log('admin_users row provisioned by trigger. Verify in dashboard.');
