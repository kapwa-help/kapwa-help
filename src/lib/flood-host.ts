export const FLOOD_WATCH_HOST = 'floodwatch.kapwahelp.org';

export function isFloodWatchHost(
  hostname: string = typeof window === 'undefined' ? '' : window.location.hostname,
): boolean {
  return hostname === FLOOD_WATCH_HOST;
}

// Flood Watch lives at clean paths on its subdomain and under /floodwatch
// everywhere else (main domain, localhost, Vercel previews).
export function floodPath(subpath: '/' | '/admin' | '/login', hostname?: string): string {
  if (isFloodWatchHost(hostname)) return subpath;
  return subpath === '/' ? '/floodwatch' : `/floodwatch${subpath}`;
}
