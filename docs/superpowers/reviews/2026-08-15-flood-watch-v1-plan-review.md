## Findings

### Blocker

1. **Anonymous users can bypass moderation and self-approve reports.**
   [Task 2 RLS](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:288>) permits anonymous inserts with `with check (true)`. A caller can use Supabase directly to insert `status = 'approved'`, causing the report to appear in the public view without review. This violates the [moderated submission flow](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:39>).

   **Fix:** Require `status = 'pending'`, `reviewed_by IS NULL`, and `reviewed_at IS NULL` in the anonymous insert policy. Also constrain admin review to the review fields, using column privileges, an RPC, or a trigger.

2. **Offline support is claimed but not implemented.**
   [Task 5](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:511>) says it handles the offline outbox, but its implementation only displays an error. Upload failures return early, and insert failures fall into a generic catch. Nothing writes to IndexedDB or retries online, contrary to the [Offline Support section](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:94>). Flood Watch is also outside `RootLayout`, where the existing `OutboxProvider` lives.

   **Fix:** Extend `form-cache.ts` and `outbox-context.tsx` with a flood-report entry containing the payload and media blob, ensure the provider wraps Flood Watch routes, and test retrying both failed uploads and failed inserts. Avoid leaving orphaned uploads when insertion fails.

3. **Storage provisioning and permissions are missing.**
   The spec requires either a new bucket or an existing-bucket prefix ([Architecture Decisions](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:12>)). [Task 5](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:640>) chooses `photos/flood-reports`, but no task creates or verifies Storage policies allowing anonymous upload and public read for that prefix. The repository contains no corresponding declarative Storage policy.

   **Fix:** Add bucket/prefix provisioning and narrowly scoped `storage.objects` policies to the database migration, plus a real anonymous upload/read smoke test. Do not rely on undocumented remote configuration.

4. **Database deployment is an unspecified manual prerequisite.**
   [Task 2](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:236>) produces two loose SQL files to be applied “manually via dashboard or CLI,” without an exact command, ordering, transaction, environment, or verification. Until that happens, every new query fails. Applying schema and RLS separately can also temporarily expose an unprotected table.

   **Fix:** Make this one ordered, transactional Supabase migration, include Storage setup, provide the exact local/remote apply command, and verify the view and policies as both `anon` and an invited admin.

5. **The subdomain task contains three contradictory implementations and omits the actual domain operation.**
   [Task 11](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:1602>) successively proposes rewriting to `index.html`, rewriting to `/floodwatch/:path*`, and leaving `vercel.json` unchanged with a hostname redirect. A worker cannot tell which code to write. None of these steps adds or verifies the Vercel domain required by the [Subdomain Setup section](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:113>).

   **Fix:** Choose one final routing contract, show the exact resulting `vercel.json` and router diff, define behavior for `/`, `/admin`, and arbitrary paths on the subdomain, and add an explicit Vercel domain/DNS step with ownership and a deployed-host verification.

### Should-fix

6. **Required location maps are replaced with coordinates or omitted.**
   The submission form renders text coordinates at [Task 5, location status](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:750>), not the mini-map required by [Geolocation step 7](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:55>). The admin detail component contains no map pin, and the queue does not display location, contrary to [Admin Flow steps 2–3](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:71>).

   **Fix:** Add a reusable read-only location preview map to the form and admin detail, and show a useful location summary in each queue row.

7. **`reviewed_by` is never populated.**
   The schema includes it, but [Task 3’s update](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:435>) only sets `status` and `reviewed_at`, violating the [data-model requirement](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:32>).

   **Fix:** Set `reviewed_by` from `auth.uid()` in a review RPC/trigger, or retrieve the authenticated user before updating. Test both approval and rejection metadata.

8. **The admin login flow does not match its description or the spec.**
   [Task 9](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:1238>) says unauthenticated users are redirected to login, but the implementation merely renders “Admin access required.” It also omits the Hannah invite/bootstrap step and does not preserve a return destination after magic-link authentication. The existing callback returns to `/demo/en`, not Flood Watch admin.

   **Fix:** Add an explicit Flood Watch login/redirect flow with a safe return URL, ensure production uses strict auth mode, and include the existing `admin_users` invite procedure and verification.

9. **Approved reports do not appear on already-open public maps “immediately.”**
   [Task 8](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:1096>) fetches once on mount and after the current visitor submits. An approval in the admin page will not update another open public page, contrary to [Admin Flow step 5](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:77>).

   **Fix:** Subscribe to approved-report changes through Supabase Realtime, or define a short polling/refetch-on-focus strategy and test it.

10. **The EXIF tests never exercise the required behavior.**
    [Task 1 tests](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:52>) only verify rejection of non-EXIF inputs. They do not prove GPS extraction, southern/western signs, byte order, `DateTimeOriginal`, malformed offsets, or fallback after parser failure. The parser performs several unchecked `DataView` reads on untrusted files, so malformed EXIF can throw before browser geolocation is requested.

    **Fix:** Add little- and big-endian positive fixtures, hemisphere/date cases, malformed/truncated EXIF tests, coordinate validation, and a form test proving parser errors still invoke browser geolocation.

11. **Verification is too late and does not test the new feature.**
    Task 2’s verification is “reading it aloud”; [Task 3](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:447>) uses `npx tsc --noEmit <file>`, which bypasses the project configuration and can resolve the wrong `tsc` when dependencies are absent. UI tasks only typecheck, lint is never run, and [Task 12](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:1673>) runs existing Playwright tests without adding Flood Watch coverage. The manual check does not submit, approve, reject, verify PII isolation, test video, or exercise offline retry.

    **Fix:** Start with `npm ci`; use project scripts (`npm test`, `npm run lint`, `npm run build`); add focused unit tests and Flood Watch Playwright coverage. Each task should run its focused test plus typecheck/lint before committing, with a seeded/local Supabase end-to-end gate after backend setup.

12. **Video handling is incomplete in the admin queue.**
    Video support is required by [the spec](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/.context/flood-watch-spec.md:87>), but Task 9 always renders `photoUrl` in an `<img>`, producing a broken thumbnail for video reports.

    **Fix:** Render a `<video>` preview/poster or an explicit video placeholder using a stored media type. Prefer storing `media_type` rather than inferring it from a URL suffix.

### Optional / scope creep

13. **The admin “All Reports” tab is unrequested scope.**
    The spec asks for a pending review queue; [Task 9](</Users/jacobaskey/conductor/workspaces/kapwa-help/chicago/docs/superpowers/plans/2026-08-15-flood-watch-v1.md:1252>) adds an all-reports tab and query. It is modest, but it adds UI, translations, query surface, and testing without supporting a stated V1 requirement.

    **Fix:** Remove it from V1, or explicitly add it to the spec if historical admin browsing is intentional.

## Sound areas

The core table columns, approved-only PII-stripped public view, no-delete posture, EXIF-before-compression ordering, browser-geolocation fallback, single-media submission, three locale key sets, Leaflet/OSM choice, and La Union default center all align with the spec. The plan also correctly avoids the explicitly excluded public filters, clustering, timeline controls, and push notifications.
