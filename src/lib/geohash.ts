/**
 * Encode latitude/longitude into a geohash string.
 *
 * Precision 6 ≈ 1.2km × 600m cells — roughly barangay-sized,
 * suitable for proximity grouping in La Union.
 *
 * Reference: docs/scope.md §4 (Needs Dataset), §5.C (Conflict Detection)
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Round a coordinate to 4 decimal places (~11m precision). */
export function roundCoord(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function encodeGeohash(
  lat: number,
  lng: number,
  precision = 6,
): string {
  let minLat = -90,
    maxLat = 90;
  let minLng = -180,
    maxLng = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    const mid = isLng ? (minLng + maxLng) / 2 : (minLat + maxLat) / 2;
    const val = isLng ? lng : lat;

    if (val >= mid) {
      ch |= 1 << (4 - bit);
      if (isLng) minLng = mid;
      else minLat = mid;
    } else {
      if (isLng) maxLng = mid;
      else maxLat = mid;
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}
