# Tenant Deploy, Landing Page, and Open-Source Architecture

**Date:** 2026-04-16
**Status:** Deferred — decisions captured for future consideration
**Why deferred:** Higher priority is polishing the current demo, shipping it to La Union contacts for signoff, and gathering real feedback before committing to landing-page / template work.

## Context

Current state: `kapwahelp.org` serves the demo app directly at `/:locale`. The app is wired to Supabase, uses PWA for offline-first, and has no auth yet. A demo was already shared with La Union contacts (~1.5 weeks ago, as of this doc).

The thought triggering this brainstorm: add a landing page telling the project's story, rename the current app as "the demo," link an open-source repo, and make the project generalizable as a template so other towns can deploy their own instances.

During the brainstorm it became clear this ambition decomposes into several separable projects, and that shipping polish to La Union first is the right priority.

## Architectural Decisions (when this work resumes)

### 1. URL scheme: subdomains for tenants, root for showcase

- **Real tenant deployments** live on subdomains: `launion.kapwahelp.org`, later `cebu.kapwahelp.org`, `samar.kapwahelp.org`, etc.
- **Root domain** (`kapwahelp.org`) hosts the project home: landing page + public demo.
- Each tenant subdomain is its own Vercel deploy pointing at its own Supabase project. Per-tenant isolation, free tier friendly.

**Why:** Scales cleanly to multi-tenant without building multi-tenant code. Each tenant's data sits in its own DB (clean PII boundary, simple RLS). The subdomain pattern also makes the URL scheme self-describing once there are multiple tenants.

### 2. Landing + demo on the root domain

- `/` → Landing page (story, "Live Demo" CTA, "Open Source" link, eventual "Deploy for your town" CTA)
- `/demo/:locale` → the app, running in static-demo mode
- `start_url` in the PWA manifest points to `/demo/en` so installed PWA users skip the landing

The refactor from current `/:locale` → `/demo/:locale` touches `src/router.tsx`, `src/components/Header.tsx`, and a few navigation call sites. Shallow. The PWA stays scoped to `/` so both landing and demo are cached / installable.

### 3. Static demo mode via `VITE_DEMO_MODE` flag

- Demo runs without any Supabase dependency. Reads from bundled JSON fixtures instead of live queries.
- Build-time env flag (`VITE_DEMO_MODE=true`) switches the data layer: when true, use fixtures; when false, use the real Supabase client.
- Submit forms in demo mode go through the full optimistic UI flow but the outbox silently drops on "send" (or shows a "deploy your own to make this real" CTA).
- Same codebase, two modes. Real tenants set `VITE_DEMO_MODE=false` and provide Supabase env vars.

**Why this is good:** No Supabase credentials on the demo deploy. Demo is robust to Supabase outages. No risk of demo visitors polluting a real DB. And — crucially — the demo *is fully offline-capable by construction*, which is the exact pitch moment ("turn on airplane mode, it still works"). PWA + static demo is a stronger pitch than PWA + live-but-empty demo.

### 4. PWA stays enabled everywhere

- The offline-first capability is the product. The demo should demonstrate it.
- Footprint on visitor devices is ~5 MB worst case (app shell + map tiles). Not invasive by any modern standard.
- `registerType: "prompt"` already means install prompts don't ambush casual visitors — the user controls when to install.
- Service-worker update cycle already handled by `UpdatePrompt` (`src/components/UpdatePrompt.tsx`).

### 5. Auth + real PII gate any real tenant deploy

- Needs table carries `contact_name` and `contact_phone` — real PII (see `src/lib/queries.ts:55-56`).
- Anon-key + RLS is not a real security boundary when the anon key ships in the browser bundle. Any visitor can read everything the app can read, and write anything the app can write.
- **Do not launch `launion.kapwahelp.org` as a real-use instance (with real people entering real needs) until at least a minimum auth layer exists.** Supabase magic-link is the likely path; it's already on the MVP roadmap.
- Pilot-with-anon-key is acceptable only if (a) URL is not shared publicly, (b) data entered is synthetic or anonymized, (c) clearly communicated to the pilot group.

### 6. Template-extraction work is small

The only La-Union-specific values hard-coded in code (not Supabase data):

- `DEFAULT_CENTER = [16.62, 120.35]` and `DEFAULT_ZOOM = 11` — `src/components/maps/ReliefMapLeaflet.tsx:54-55`
- `"Kapwa Help"` brand string — `src/components/Header.tsx:62`
- Logo asset path `/icons/kapwahelp_v1.svg`
- Subtitle `"Citizen-led disaster response for La Union, Philippines"` in i18n
- Locale list includes `ilo` (Ilocano is La-Union-specific among PH regional languages)

Moving these to env vars (`VITE_MAP_CENTER`, `VITE_MAP_ZOOM`, `VITE_BRAND_NAME`, etc.) is probably 1-2 hours of mechanical work. Do it when a second tenant is concretely imminent, not speculatively.

## Explicitly Deferred / Not Doing Yet

- Landing page build-out
- `/demo/:locale` route refactor
- `VITE_DEMO_MODE` flag and JSON fixtures
- Open-sourcing the repo (public GitHub + README + LICENSE + CONTRIBUTING)
- Template extraction of hard-coded values
- Standing up `launion.kapwahelp.org` (no need until there's an active deployment target)
- Auth (tracked separately on the MVP roadmap)

## Order of Operations When This Resumes

1. **Validate demand.** Does Hannah / La Union feedback actually indicate that "here's a template other towns can use" matters to them? If yes, continue. If not, this whole plan may be premature.
2. **Open-source the repo.** Public GitHub, README with the pitch, LICENSE, CONTRIBUTING. This is cheap and creates the artifact the landing page will point to.
3. **Build landing page + `/demo` refactor + `VITE_DEMO_MODE` flag.** All three ship together. Land at root, demo at `/demo/:locale`, fixtures baked in.
4. **Template extraction.** Move the five hard-coded values to env vars. Add a short deploy runbook. Do this before (or during) the first real tenant deploy, not speculatively.
5. **First real tenant deploy** (`launion.kapwahelp.org`) **only after auth ships.** Coordinated with Hannah. Real Supabase project, real data, real users.

## Open Questions for Future Consideration

- Does the landing page need i18n, or is English-only acceptable for the project home? (Tenant deploys are localized; the project home may not need to be.)
- Should the demo expose all three locales (`en`, `fil`, `ilo`) or just one? Showing `ilo` is a nice way to signal regional seriousness, but tri-lingual fixtures are triple the copy work.
- What does the "Deploy for your town" path look like — a CTA button with a form, a GitHub-template "Use this template" link, a contact email? (Depends on how much manual hand-holding Jacob wants to do vs. self-serve.)
- Any SEO requirements for the landing page? SPAs index imperfectly. If SEO matters, pre-rendering the landing route at build time would be worth the minor complexity.
