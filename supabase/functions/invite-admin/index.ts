// supabase/functions/invite-admin/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'missing_authorization' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Use the caller's JWT to verify their identity and admin status.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  const { data: adminRow } = await userClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!adminRow) return json({ error: 'forbidden' }, 403);

  let body: { email?: string; display_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const email = body.email?.trim();
  if (!email) return json({ error: 'email_required' }, 400);

  const adminClient = createClient(url, serviceKey);
  const displayName = body.display_name ?? null;

  // Check if user already exists (re-invite case).
  const { data: existing } = await adminClient.auth.admin.listUsers();
  const existingUser = existing?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId: string;

  if (existingUser) {
    // User exists — send a fresh magic link via signInWithOtp (which
    // actually delivers the email, unlike admin.generateLink).
    const anonClient = createClient(url, anonKey);
    const redirectTo = new URL('/auth/callback', req.headers.get('origin') || url).toString();
    const { error: otpErr } = await anonClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (otpErr) return json({ error: otpErr.message }, 400);
    userId = existingUser.id;
  } else {
    // New user — send invite with proper redirect.
    const redirectTo = new URL('/auth/callback', req.headers.get('origin') || url).toString();
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role: 'admin',
        invited_by: userData.user.id,
        display_name: displayName,
      },
      redirectTo,
    });
    if (error) return json({ error: error.message }, 400);
    userId = data.user?.id ?? '';
  }

  // Directly upsert admin_users — the DB trigger is unreliable because
  // inviteUserByEmail populates metadata after the INSERT trigger fires.
  const { error: upsertErr } = await adminClient
    .from('admin_users')
    .upsert(
      {
        user_id: userId,
        email,
        invited_by: userData.user.id,
        display_name: displayName,
      },
      { onConflict: 'user_id' },
    );
  if (upsertErr) return json({ error: upsertErr.message }, 500);

  return json({ ok: true, user_id: userId, reinvite: !!existingUser });
});
