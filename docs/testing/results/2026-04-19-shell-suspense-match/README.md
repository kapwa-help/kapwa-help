# 2026-04-19 — Shell + matching Suspense fallback

Follow-up to Task 2. Manual test revealed that while the inline HTML shell painted correctly at ~4.6s, it would then disappear momentarily when React mounted — `createRoot.render()` atomically replaces `#root`, and the Suspense fallback in `src/main.tsx` was just `<div>Loading...</div>`. That created a three-phase flicker:

1. HTML shell (logo + "Loading…")
2. Bare "Loading..." text (React Suspense fallback during i18n fetch)
3. Real app

Fix: extracted the shell into `src/components/AppShell.tsx` and used it as the Suspense fallback. Now React's first commit renders the same visual as the HTML shell, so the handoff is pixel-invisible.

## Results (median, 3 runs)

| Metric | Inline shell (Task 2) | + Matching Suspense fallback | Delta |
|---|---|---|---|
| First Paint | 4588ms | 4612ms | +24ms (noise) |
| First Contentful Paint | 4588ms | 4612ms | +24ms (noise) |
| DOMContentLoaded | 7811ms | 7842ms | +31ms (noise) |
| load event | 7811ms | 7843ms | +32ms (noise) |

Same performance numbers — this is a visual-continuity fix, not a perf fix.

## What changed qualitatively

Checked each captured frame from 4.6s through 20.7s (when the full app renders). Every frame shows the shell. No intermediate "bare Loading..." frame anywhere. The transition from shell → real app happens in a single paint event when i18n + map data are ready.

## Side effect: effectively resolves Task 7

Task 7 was to evaluate whether to disable i18n Suspense. With the matching AppShell fallback, Suspense is no longer a UX problem — it actually helps us avoid the placeholder-key flash that Filipino/Ilocano users would have seen if we'd turned it off. So we can close Task 7 with "Suspense kept, fallback fixed."

## Reproducing

Frames and Chrome traces are not committed. To recreate:

```bash
git checkout <commit-with-appshell-fallback>
npm run perf:mobile -- --label=2026-04-19-shell-suspense-match --runs=3 --capture-ms=10000
```

`summary.json` in this directory has the per-run paint/load timings.
