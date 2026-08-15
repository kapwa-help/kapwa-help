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
- Start acquiring device location when the report form opens; do not wait for media selection.
- Wait for EXIF parsing after photo selection; use device/browser geolocation only when the photo has no valid GPS metadata.
- Do not add manual coordinates or map-based overrides; submissions require an automated location source.
- Keep device and EXIF request state independent so media-selection races cannot choose the wrong source.
- When approved reports exist, fit the public map to their coordinates; use La Union only as the empty-map default.
