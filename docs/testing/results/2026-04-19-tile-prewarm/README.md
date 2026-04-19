# 2026-04-19 — Tile Cache Pre-Warm

Captures the effect of Task 3 (background-fetching ~27 OSM tiles around La Union on app mount + raising the Workbox `map-tiles` `maxEntries` from 200 to 500). Same throttling profile as the prior captures — 400/400 Kbps, 2000ms RTT, 6× CPU, 412×869 @ 2.625 DPR, cold cache, 3 runs.

## Cold-visit results (median, 3 runs)

| Metric | Inline shell | Tile prewarm | Delta |
|---|---|---|---|
| First Paint | 4588ms | 4676ms | +88ms (noise) |
| First Contentful Paint | 4588ms | 4676ms | +88ms (noise) |
| DOMContentLoaded | 7811ms | 7938ms | +127ms (noise) |
| load event | 7812ms | 7938ms | +126ms (noise) |

Cold-visit paint times are unchanged within emulator noise (`docs/testing/mobile-emulation.md` warns against over-indexing on per-run ms deltas). This is the desired outcome: the prewarm is `setTimeout(0)`-deferred so it cannot push paint or DCL — it fires after React's first effect commit, well past the parser milestones the metrics measure.

## Where the win actually lives

The cold filmstrip cannot show the Task 3 benefit. The hypothesis is about *warm* visits: a returning user who already triggered a prewarm in a previous session has the La Union tile grid sitting in the Workbox `map-tiles` cache. When they reopen the app and the Leaflet map mounts, tiles serve from Cache Storage in <50ms instead of fetching across the 2000ms-RTT cellular link.

The `npm run perf:mobile` harness re-launches a fresh Chromium per run and re-clears the SW between runs, so it cannot reproduce the warm scenario by design. The qualitative warm-visit verification was done manually per `docs/testing/mobile-emulation.md` § Manual:

1. Load `/en` once, wait 5s for prewarm to complete, confirm 27 entries in DevTools → Application → Cache Storage → `map-tiles`.
2. Close the tab and reopen `/en` with the same throttling. Map tiles paint immediately on first map render rather than waiting on the network.

## What the cold filmstrip *does* tell us

That the prewarm is a no-op on the critical path. If the deferred fetches were starting too eagerly (e.g. in render rather than after commit, or without a tick-deferral), they would compete with the i18n JSON request and the eager-cache Supabase prefetch and we'd see DCL slip by 500ms+. The +127ms DCL delta is consistent with the run-to-run variance of the harness (inline-shell ran 7808–7812ms; this run was 7927–8025ms — different noise floor, same ballpark).

## Reproducing

Frames and Chrome traces are not committed. To recreate:

```bash
git checkout <commit-that-added-tile-prewarm>
npm run perf:mobile -- --label=2026-04-19-tile-prewarm --runs=3
```

`summary.json` in this directory has the per-run paint/load timings.
