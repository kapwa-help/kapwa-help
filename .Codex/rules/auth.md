---
paths:
  - "src/hooks/use-auth.ts"
  - "src/pages/AuthCallbackPage.tsx"
  - "vite.config.ts"
---

# Authentication redirects

- Build magic-link callbacks from `window.location.origin` and allowlist each production callback origin in Supabase, including the canonical `www` host.
- `@supabase/supabase-js` uses the implicit flow by default in this browser client. Its default `detectSessionInUrl: true` processes the hash and persists the session; do not add a PKCE code exchange unless the client is explicitly switched to PKCE.
- Never add Supabase URLs to Workbox runtime caching. Auth and REST responses vary by bearer token, while Cache Storage keys requests by URL rather than authorization state.
