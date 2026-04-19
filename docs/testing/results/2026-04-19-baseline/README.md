# 2026-04-19 — Mobile Emulation Baseline (pre-changes)

Captured against the HEAD of `perf/mobile-network` before any perf tasks landed. The branch had only docs and tooling commits at this point — the built SPA is equivalent to `main` at `c8ef06e`.

## Profile
- Network: 400 Kbps down/up, 2000ms RTT
- CPU: 6× slowdown
- Viewport: 412 × 869 @ 2.625 DPR
- Cache: cold (SW unregistered, Cache Storage cleared, HTTP cache cleared)
- URL: `http://localhost:4273/en`
- Runs: 3

## Results (median)
| Metric | Value |
|---|---|
| First Paint | ~4.5s |
| First Contentful Paint | ~7.8s |
| DOMContentLoaded | ~7.8s |
| load event | ~7.8s |

## Qualitative read
- Frame 0 (~10ms): solid white — no HTML content visible yet, browser is still fetching the bundle.
- Frame at ~4.5s: background flips to dark navy (app CSS has loaded, React has mounted the empty `#root`).
- Frame at ~7.8s: a small "Loading…" label appears in the top-left corner — this is the default Suspense fallback while i18n JSON resolves.
- Full app shell (header, map, etc.) does not appear until after this window.

No visible app chrome or brand identity until ~8s into the load. This is the experience Task 2 (inline app shell) aims to fix.

## Reproducing

Frames and Chrome traces are not committed (regenerable, ~500 KB per capture). To recreate:

```bash
git checkout main
npm run perf:mobile -- --label=2026-04-19-baseline --runs=3 --capture-ms=10000
```

`summary.json` in this directory has the per-run paint/load timings.
