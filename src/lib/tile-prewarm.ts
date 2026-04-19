/**
 * Tile pre-warm: on app mount, fetch the default La Union viewport tiles
 * so the Workbox CacheFirst SW populates the `map-tiles` cache before the
 * user navigates to the map page.
 *
 * These are background `fetch()` calls that the SW intercepts — we don't
 * need to read the response; Workbox caches them transparently.
 */

const CENTER_LAT = 16.62;
const CENTER_LNG = 120.35;
const ZOOM_LEVELS = [10, 11, 12] as const;
const RADIUS = 1; // tiles on each side of center → 3×3 grid per zoom level

/**
 * Slippy-map tile math: convert (lat, lng, zoom) to integer (x, y) tile coords.
 * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Mathematics
 */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

/**
 * Fires fetch() for a grid of tiles around La Union at multiple zoom levels.
 * Non-blocking — errors are silently swallowed (e.g. user is offline).
 * Kept deliberately small (~27 tiles total) to respect OSM usage policy.
 */
export function prewarmTileCache(): void {
  if (!navigator.onLine) return;

  const subdomains = ["a", "b", "c"] as const;

  for (const z of ZOOM_LEVELS) {
    const center = latLngToTile(CENTER_LAT, CENTER_LNG, z);
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        const x = center.x + dx;
        const y = center.y + dy;
        // Stagger across a/b/c to distribute load
        const sub = subdomains[(Math.abs(dx) + Math.abs(dy)) % 3];
        const url = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
        fetch(url, { mode: "cors", credentials: "omit" }).catch(() => {});
      }
    }
  }
}
