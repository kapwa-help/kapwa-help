The primary password flow builds and passes unit tests, but legacy magic-link URLs can still establish sessions and legacy production login redirects bypass the canonical-host redirect. These behavioral defects should be fixed before considering the patch correct.

Full review comments:

- [P2] Disable implicit URL-token authentication — /Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/src/router.tsx:52-52
  When an unexpired invite-era magic link opens `/auth/callback#access_token=...`, Supabase's default `detectSessionInUrl: true` processes and persists that token before this redirect renders. An existing `admin_users` member can therefore still authenticate without their password, contrary to the password-only redesign; configure the browser client to disable URL session detection before retaining this compatibility redirect.

- [P2] Send legacy login redirects to the canonical host — /Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/src/router.tsx:62-62
  When a production user opens an old URL such as `https://kapwahelp.org/en/login`, this client-side redirect ends at `kapwahelp.org/floodwatch/login`. React Router navigation never reaches Vercel, so the new host-scoped `/floodwatch*` redirect is not applied and the user remains on the noncanonical origin, including after login; use a full-document redirect on the main-domain hosts or add server redirects for the legacy login sources.