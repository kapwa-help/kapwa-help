/**
 * Performance instrumentation for the app critical chain.
 *
 * `mark()` records a performance.mark entry once per name per page load.
 * `installPerfLogging()` sets up the LCP observer and optional console
 * output (gated by `?perf=1` in the URL). Called from main.tsx.
 */

type LCPEntry = PerformanceEntry & {
  element?: Element | null;
  renderTime?: number;
  loadTime?: number;
};

let lcpEntry: LCPEntry | null = null;

export function mark(name: string): void {
  if (typeof performance === "undefined") return;
  if (performance.getEntriesByName(name).length > 0) return;
  performance.mark(name);
}

export function installPerfLogging(): void {
  if (typeof window === "undefined") return;

  if (typeof PerformanceObserver !== "undefined") {
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        lcpEntry = entries[entries.length - 1] as LCPEntry;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Browser does not support LCP observer; marks still work.
    }
  }

  const active =
    new URLSearchParams(window.location.search).get("perf") === "1";
  if (!active) return;

  window.addEventListener("load", () => {
    setTimeout(logTimeline, 500);
  });
}

function logTimeline(): void {
  const marks = performance
    .getEntriesByType("mark")
    .filter((m) => m.name.startsWith("app:"))
    .sort((a, b) => a.startTime - b.startTime);

  type Row = { step: string; t: string; delta: string };
  const rows: Row[] = [{ step: "navigationStart", t: "T+0ms", delta: "—" }];

  let prev = 0;
  for (const m of marks) {
    rows.push({
      step: m.name,
      t: `T+${Math.round(m.startTime)}ms`,
      delta: `+${Math.round(m.startTime - prev)}ms`,
    });
    prev = m.startTime;
  }

  if (lcpEntry) {
    const tag = lcpEntry.element?.tagName ?? "?";
    rows.push({
      step: `LCP (${tag})`,
      t: `T+${Math.round(lcpEntry.startTime)}ms`,
      delta: `+${Math.round(lcpEntry.startTime - prev)}ms`,
    });
  }

  // eslint-disable-next-line no-console
  console.group("[perf] Kapwa Help timeline");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.groupEnd();
}
