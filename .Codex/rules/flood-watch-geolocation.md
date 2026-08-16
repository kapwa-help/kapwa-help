---
paths:
  - "src/components/FloodReportForm.tsx"
  - "src/components/maps/FloodWatchMap.tsx"
  - "src/lib/exif-gps.ts"
  - "src/lib/exif-gps.test.ts"
  - "public/locales/*/translation.json"
---

# Flood Watch geolocation

- Photo EXIF GPS is the primary location source whenever it is available.
- When EXIF GPS is found, lock the map to read-only — no manual override of EXIF coordinates.
- When EXIF GPS is missing (or media is a video), fall back to manual location selection via map click/drag or coordinate text input.
- Do not use device/browser geolocation (`navigator.geolocation`) — most users upload photos after leaving the site, so device location does not reflect the flood location.
- Invalid coordinate text input must clear the selected location and disable submission.
- When approved reports exist, fit the public map to their coordinates; use La Union only as the empty-map default.
