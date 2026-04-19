/**
 * AppShell: the React-rendered twin of the static shell in index.html.
 *
 * index.html's <body> contains the same markup so users see a branded
 * loading state at HTML-parse time (before the JS bundle arrives). Once
 * React mounts, createRoot.render() wipes #root — if Suspense then falls
 * back to anything different, the user sees a visible flicker. Rendering
 * this component as the Suspense fallback keeps the exact same pixels
 * on screen throughout the HTML → React → i18n-resolved transition.
 *
 * Styles live in index.html's inline <style> block (global, no import
 * needed here) so they're available during HTML parse before any CSS
 * chunk arrives over the network.
 */
export function AppShell() {
  return (
    <div
      className="shell"
      role="status"
      aria-live="polite"
      aria-label="Kapwa Help is loading"
    >
      <div className="shell-header">
        <img className="shell-logo" src="/icons/kapwahelp_v1.svg" alt="" />
        <span className="shell-wordmark">Kapwa Help</span>
      </div>
      <div className="shell-body">
        <span className="shell-loading">Loading…</span>
      </div>
    </div>
  );
}
