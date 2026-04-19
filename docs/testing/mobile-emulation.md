# Chrome Android Emulation — Mobile Network Performance Protocol

This is the canonical measurement loop for evaluating real-world mobile performance of Kapwa Help. Lighthouse's simulated metrics are useful but do not represent the actual user experience on a low-end Android over degraded cellular signal; this protocol does.

There are two ways to run this — automated (preferred for A/B comparisons) and manual (for human-eye qualitative checks).

## Automated: `npm run perf:mobile`

`scripts/perf-mobile.ts` applies the same throttling profile and captures a CDP screencast + Chrome trace + paint timings per run. This is the primary measurement tool.

```bash
# Cold-visit, 3 runs, full build
npm run perf:mobile -- --label=baseline

# Subsequent runs can reuse the already-built dist/
npm run perf:mobile -- --label=inline-shell --skip-build

# Measure a non-default URL
npm run perf:mobile -- --label=report-page --url=/en/report

# Warm-cache scenario (don't clear SW / HTTP cache)
npm run perf:mobile -- --label=warm --warm
```

Output lands in `docs/testing/results/<label>/`:

- `run-<n>/frames/frame-<idx>-<Nms>.jpg` — screencast frames, one per paint event (timestamped relative to navigation start)
- `run-<n>/trace.json` — Chrome trace; open in DevTools → Performance → Load profile
- `summary.json` — aggregated paint / DCL / load metrics per run

The screencast is paint-triggered, not fixed-interval, so frame count ≈ number of visible state changes. That's exactly what DevTools' filmstrip shows — we use the same CDP API.

## Manual: Chrome DevTools

Use this for qualitative human-eye evaluation — "does this actually feel better?"

### Test Profile

| Dimension | Setting | Why |
|---|---|---|
| Device | "Galaxy A51/71" or custom `412 × 869` @ 2.625 DPR | Approximates a mid-to-low-end Android sold in PH. |
| Network | Custom: 400 Kbps down, 400 Kbps up, 2000ms RTT | Slower than Chrome's "Slow 3G" preset — closer to a congested post-disaster cell tower. |
| CPU | 6× slowdown | Matches a ~4-year-old budget ARM SoC. Lighthouse's default 4× is too generous. |
| Cache | Disabled on reload | Simulates cold first-visit. |

### Steps

1. Start the production preview: `npm run build && npm run preview`.
2. Open Chrome, open DevTools (Cmd+Opt+I), toggle device toolbar (Cmd+Shift+M).
3. Pick "Galaxy A51/71" from the device dropdown, or add a custom profile `412 × 869` at 2.625 DPR.
4. Network tab → throttling dropdown → "Add..." → create a preset named "Post-disaster 3G": 400 / 400 / 2000. Select it.
5. Performance tab → settings gear → CPU throttling → 6× slowdown.
6. Network tab → "Disable cache" checkbox ON.
7. Navigate to `http://localhost:4173/en`. Hard reload (Cmd+Shift+R). Observe.

### What to capture

For each change being evaluated:

1. **Filmstrip screenshot**: DevTools → Performance → record a page load → save the filmstrip as an image.
2. **Time-to-orient**: when does the user first see content that tells them "the app is loading"? (Measure from hard-reload click.)
3. **Time-to-shell**: when does the user see the full app structure (header, layout, interactive areas)?
4. **Time-to-interactive**: when can the user tap a button and have it respond?

Save screenshots and notes under `docs/testing/results/<label>/manual/`.

## Comparison Protocol

For A/B comparisons (e.g. before vs. after a change):

1. Run `npm run perf:mobile -- --label=<baseline-name>` first.
2. Apply the change, run `npm run perf:mobile -- --label=<change-name>`.
3. Compare the `frames/` directories and the `summary.json` timings side by side.
4. For anything that claims "feels better," do one manual DevTools pass to confirm the human-eye read matches the captured filmstrip.

Do not over-index on single-run millisecond deltas — emulated perf is noisier than Lighthouse simulation, and CPU throttling under a virtualized browser has irreducible variance. The point is *qualitative* ("does this change the felt experience?"), backed by *repeatable* artifacts (the screencast sequence).

## When to also run Lighthouse

Lighthouse is still useful for:

- Detecting unused JS / CSS (it shows concrete bytes).
- Accessibility score (catches regressions).
- Total Blocking Time on simulated mobile (catches main-thread regressions).

But Lighthouse's score / LCP / FCP numbers are secondary signals after this emulation protocol's qualitative pass.
