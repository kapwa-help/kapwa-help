import { lazy } from "react";

/**
 * Wraps a dynamic import with a single page-reload retry.
 * Fixes stale-chunk errors after PWA deploys where the old service worker
 * serves cached HTML referencing chunk hashes that no longer exist.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload(
  importFn: () => Promise<{ default: React.ComponentType<any> }>,
) {
  return lazy(() =>
    importFn().catch(() => {
      const key = "chunk-reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      return new Promise<never>(() => {});
    }),
  );
}
