# Photo Uploads — Design Doc

**Date:** 2026-04-08
**Scope:** Hazard report photos + delivery confirmation photos
**Issues:** #64, #65 (partially — need submission photos dropped from scope)

## Overview

Wire existing photo UI in `HazardForm.tsx` and `PinDetailSheet.tsx` to Supabase Storage. Both database columns already exist (`hazards.photo_url`, `needs.delivery_photo_url`). No new UI needed — this is a plumbing job.

Photos are online-only for this iteration. Offline photo queueing is a follow-up.

## Storage

Single Supabase Storage bucket: `photos`

Path structure:
- `hazards/{hazard-id}.jpg`
- `deliveries/{need-id}.jpg`

RLS policy:
- Public read access (disaster relief photos, not private)
- Anon upload allowed (no auth system yet)

## Client-Side Compression

Canvas API, zero dependencies. Single utility function:

1. Load file into `<img>` via `createObjectURL`
2. Draw onto canvas scaled to max 800px wide (maintain aspect ratio)
3. Export as JPEG at quality 0.65
4. If result > 300KB, retry at quality 0.5
5. Return compressed `Blob`

Target: most photos land between 100-300KB. 300KB is the ceiling, not the average.

## Hazard Form (`HazardForm.tsx`)

- Photo UI already exists (file input, preview, remove button)
- Generate a UUID client-side for the hazard ID (needed for the storage path before insert)
- On submit: compress photo → upload to `photos/hazards/{id}.jpg` → pass URL into `insertHazard()` as `photo_url`
- `HazardInsert` type already accepts `photo_url?: string`

## Delivery Confirmation (`PinDetailSheet.tsx`)

- Photo UI already exists (file input for "Add Delivery Photo")
- Need ID is already known at this point
- On "Confirm Delivery": compress photo → upload to `photos/deliveries/{need-id}.jpg` → update need with `delivery_photo_url` and status change in one call

## Display

- `HazardDetailPanel.tsx`: render `photo_url` image with lazy loading if present
- `PinDetailSheet.tsx`: for completed needs, show `delivery_photo_url` if present

## Error Handling

If photo upload fails but form data is valid: submit without the photo, show a toast ("Report saved, photo upload failed"). The photo is optional — never block the core action on a storage failure.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/photo.ts` | **New** — compress + upload utility |
| `src/components/HazardForm.tsx` | Wire photo to upload + insert |
| `src/components/PinDetailSheet.tsx` | Wire delivery photo to upload + status update |
| `src/components/HazardDetailPanel.tsx` | Display hazard photo |
| `src/lib/queries.ts` | Update `insertHazard` to pass `photo_url`, add delivery photo update |
| `supabase/schema.sql` | Document bucket + RLS (bucket created via dashboard) |

## Out of Scope

- Need submission photos (dropped from requirements)
- Offline photo queueing (follow-up: generalize outbox, add blob storage)
- Photo deletion / replacement
- Thumbnails or image optimization CDN
