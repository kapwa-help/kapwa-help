# 2026-04-19 — Inline App Shell

Captures the effect of Task 2 (inlining the app shell in `index.html`). Same throttling profile as the baseline — 400/400 Kbps, 2000ms RTT, 6× CPU, 412×869 @ 2.625 DPR, cold cache.

## Results (median, 3 runs)

| Metric | Baseline | Inline shell | Delta |
|---|---|---|---|
| First Paint | 4512ms | 4588ms | +76ms (noise) |
| First Contentful Paint | 7808ms | 4588ms | **−3220ms** |
| DOMContentLoaded | 7748ms | 7811ms | +63ms (noise) |
| load event | 7748ms | 7811ms | +63ms (noise) |

## What changed qualitatively

- **Baseline at FCP (~7.9s)**: screen shows a tiny "Loading..." label in the top-left corner of a dark navy page. No brand, no structure, no affordance that tells the user where they are.
- **Inline shell at FCP (~4.6s)**: full Kapwa Help header (logo + wordmark) with a centered, subtly-pulsing "Loading…" indicator. The user sees a branded, structured app at the first paint event.

The First Paint metric is unchanged because it's network-bound: HTML cannot paint until it arrives over the wire, and with 2000ms RTT the first-byte-time dominates everything. What the inline shell does is make sure that *when* the first paint happens, it's a meaningful paint — same pixel-time, much higher information content.

The FCP delta reflects the consolidation: in the baseline, the browser emitted first-paint at ~4.5s (background color, no text) and then FCP at ~7.8s (when JS had parsed and the first text node appeared in the DOM). In the inline-shell case, the HTML itself carries text — "Kapwa Help" and "Loading…" — so first-paint and first-contentful-paint collapse to the same moment.

## Qualitative read for the user

**Before (baseline)**: 4.5s of pure white → ~3s of unbranded dark screen → "Loading…" label appears → app finally loads.

**After (inline shell)**: 4.5s of white → full branded loading shell → app cleanly replaces the shell.

The blank-white interval is unchanged (network-bound), but the "unbranded dark screen" interval is eliminated entirely. Time-to-orient drops from ~7.9s to ~4.6s — the first moment where the user can tell what app they're looking at.

Compare `frames/` in this directory against `../2026-04-19-baseline/` to see the side-by-side.
