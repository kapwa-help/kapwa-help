---
paths:
  - "src/hooks/use-auth.ts"
  - "src/pages/FloodWatchLoginPage.tsx"
  - "src/lib/flood-host.ts"
  - "vite.config.ts"
---

# Authentication

- Admin auth is email+password (`signInWithPassword`), used only by Flood Watch
  (`/login` on floodwatch.kapwahelp.org, `/floodwatch/login` elsewhere). There is no
  magic-link, invite, or AUTH_MODE flow — do not reintroduce email-based login links;
  institutional mail scanners consume single-use tokens (this failed repeatedly in
  Aug 2026).
- Admin = row in `admin_users` (checked client-side for UI, enforced by RLS
  `is_admin()`). Provision admins manually with `npm run create:admin`.
- Keep `onAuthStateChange` callbacks synchronous. Supabase runs them while holding an
  exclusive auth lock, so defer database or other Supabase calls until a later task to
  avoid cross-tab deadlocks.
- Never add Supabase URLs to Workbox runtime caching. Auth and REST responses vary by
  bearer token, while Cache Storage keys requests by URL rather than authorization state.
