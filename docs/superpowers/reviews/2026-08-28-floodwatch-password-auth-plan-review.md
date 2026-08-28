## Findings

1. **Blocker — Tasks 2 and 3 knowingly leave the repository failing typecheck.**  
   The plan claims every task keeps the build green ([plan line 51](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/plans/2026-08-28-floodwatch-password-auth.md:51)), but Task 2 explicitly changes `login` to require a password while the existing `LoginPage` still calls it with one argument ([plan line 349](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/plans/2026-08-28-floodwatch-password-auth.md:349)). Task 3 does not remove that page, so two planned commits are broken.  
   **Fix:** Combine Tasks 2–4 into one atomic task, or retain a temporary type-compatible API until the router removes `LoginPage`. Require `npm run build && npm test` before each commit.

2. **Blocker — Task 4’s required Playwright gate is guaranteed to fail.**  
   Task 4 changes `/en/login` to end at `/floodwatch/login` ([plan lines 584–595](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/plans/2026-08-28-floodwatch-password-auth.md:584)), as required by spec §3 ([spec lines 40–43](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/specs/2026-08-28-floodwatch-password-auth-spec.md:40)). However, the existing smoke test still asserts `/demo/en/login` ([smoke.spec.ts line 142](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/tests/e2e/smoke.spec.ts:142)), and the plan never lists that file for modification. The “16/16” count is also stale; the current parametrized suite produces 19 tests.  
   **Fix:** Add `tests/e2e/smoke.spec.ts` to Task 4 and the file map, update the legacy-login expectation, and add assertions for `/demo/en/login` and `/auth/callback` ending at `/floodwatch/login`.

3. **Should-fix — The canonical subdomain behavior is not verified before deployment.**  
   Spec §2 requires clean routes on `floodwatch.kapwahelp.org`, legacy main-domain redirects, and preserved preview/localhost routes ([spec lines 28–33](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/specs/2026-08-28-floodwatch-password-auth-spec.md:28)). All automated browser gates run against localhost, while Task 1 tests only `floodPath`; neither the host-selected router branch nor `vercel.json` redirect behavior is exercised.  
   **Fix:** Make route construction accept a hostname and unit-test both route sets, then add a Vercel preview/integration check covering main-domain redirect preservation of nested paths and the three clean subdomain routes.

4. **Should-fix — Resetting an existing invited user may leave the account unconfirmed.**  
   Task 8’s existing-user branch updates only the password ([plan lines 928–935](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/plans/2026-08-28-floodwatch-password-auth.md:928)). Hannah may already exist as an unconfirmed invite-era user—the exact population this migration targets—so password login could still fail.  
   **Fix:** Set `email_confirm: true` when updating an existing user, and test both existing-user and new-user paths.

5. **Should-fix — The service-role provisioning script has no meaningful verification.**  
   Task 8 says the script is “type-checked by tsx at runtime” ([plan lines 1000–1003](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/plans/2026-08-28-floodwatch-password-auth.md:1000)), but `tsx` transpiles and executes; it is not a substitute for static typechecking. Lint also cannot prove the create/update/upsert workflow, and the first real execution mutates production auth data.  
   **Fix:** Add mocked tests for create, reset, lookup failure, auth mutation failure, and `admin_users` upsert failure. Include the script in a TypeScript no-emit check or a dedicated scripts `tsconfig`.

6. **Optional — Logout tests verify presence, not behavior.**  
   Task 5 checks that logout buttons render ([plan lines 689–704](/Users/jacobaskey/conductor/workspaces/kapwa-help/santo-domingo/docs/superpowers/plans/2026-08-28-floodwatch-password-auth.md:689)), but never clicks them.  
   **Fix:** Click each logout button and assert `logout` is called.

Everything else is well aligned: the plan removes the requested magic-link/invite/AUTH_MODE machinery, preserves `admin_users` plus `is_admin()`, ungates the demo pages, retains callback compatibility, avoids password-reset and RLS scope creep, and clearly separates approval-required production writes.