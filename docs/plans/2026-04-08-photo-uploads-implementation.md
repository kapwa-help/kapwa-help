# Photo Uploads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire existing photo UI to Supabase Storage so hazard reports and delivery confirmations persist photos.

**Architecture:** Canvas API compresses photos client-side (<300KB), uploads to a single `photos` Supabase Storage bucket with path-based organization (`hazards/`, `deliveries/`). Upload utility in `src/lib/photo.ts`, consumed by `HazardForm` and `PinDetailSheet`. Display in detail panels with lazy loading.

**Tech Stack:** Supabase Storage (JS client `supabase.storage`), Canvas API for compression, crypto.randomUUID() for client-side IDs.

**Design doc:** `docs/plans/2026-04-08-photo-uploads.md`

---

### Task 1: Create Supabase Storage Bucket

This is a manual step — the bucket must exist before code can upload to it.

**Step 1: Create the bucket via Supabase Dashboard**

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `photos`
4. Toggle **Public bucket** ON (disaster relief photos, not private)
5. Click "Create bucket"

**Step 2: Add RLS policy for anon uploads**

In Supabase Dashboard → Storage → `photos` → Policies:

1. Add policy for **INSERT**:
   - Name: `Allow anon uploads`
   - Target roles: `anon`
   - Policy: `true` (allow all — no auth system yet)
2. Add policy for **SELECT** (should be auto-enabled for public buckets, but verify):
   - Name: `Allow public reads`
   - Target roles: `anon`
   - Policy: `true`

**Step 3: Verify**

Run in browser console or via a quick test:
```ts
const { data, error } = await supabase.storage.from('photos').list();
// Should return empty array, no error
```

**Step 4: Commit**

No code changes — bucket is infrastructure. Move on.

---

### Task 2: Compression Utility (`src/lib/photo.ts`)

**Files:**
- Create: `src/lib/photo.ts`
- Test: `tests/lib/photo.test.ts`

**Step 1: Write the failing test**

Create `tests/lib/photo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { compressPhoto } from "@/lib/photo";

// Helper: create a 1x1 white PNG as a File
function make1x1Png(): File {
  // Minimal 1x1 white PNG (67 bytes)
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], "test.png", { type: "image/png" });
}

describe("compressPhoto", () => {
  it("returns a JPEG Blob under 300KB", async () => {
    const file = make1x1Png();
    const result = await compressPhoto(file);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBeLessThanOrEqual(300 * 1024);
  });

  it("preserves aspect ratio (does not exceed MAX_WIDTH)", async () => {
    const file = make1x1Png();
    const blob = await compressPhoto(file);
    // Load the result to verify dimensions
    const bitmap = await createImageBitmap(blob);
    expect(bitmap.width).toBeLessThanOrEqual(800);
    bitmap.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/photo.test.ts`
Expected: FAIL — `compressPhoto` does not exist yet.

**Step 3: Write the compression utility**

Create `src/lib/photo.ts`:

```ts
import { supabase } from "./supabase";

const MAX_WIDTH = 800;
const INITIAL_QUALITY = 0.65;
const FALLBACK_QUALITY = 0.5;
const MAX_BYTES = 300 * 1024; // 300KB

/**
 * Compress a photo file to JPEG, max 800px wide, targeting <300KB.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let blob = await canvas.convertToBlob({ type: "image/jpeg", quality: INITIAL_QUALITY });
  if (blob.size > MAX_BYTES) {
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: FALLBACK_QUALITY });
  }
  return blob;
}

/**
 * Upload a compressed photo to Supabase Storage.
 * Returns the public URL, or null if upload fails.
 */
export async function uploadPhoto(
  bucket: string,
  path: string,
  blob: Blob,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });

  if (error) {
    console.error("Photo upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/photo.test.ts`
Expected: PASS (both tests).

Note: `OffscreenCanvas` and `createImageBitmap` are available in jsdom via Vitest. If the test environment lacks them, we may need to adjust — but these are standard browser APIs and jsdom should support them. If not, skip unit tests for compression (it's a thin wrapper over browser APIs) and verify via Playwright instead.

**Step 5: Commit**

```bash
git add src/lib/photo.ts tests/lib/photo.test.ts
git commit -m "feat: add photo compression and upload utility"
```

---

### Task 3: Wire Hazard Form Photo Upload

**Files:**
- Modify: `src/components/HazardForm.tsx`
- Modify: `src/lib/queries.ts:255-258` (insertHazard)

**Step 1: Update `insertHazard` to accept and pass `photo_url`**

In `src/lib/queries.ts`, the `insertHazard` function already accepts `HazardInsert` which has `photo_url?: string`. No type changes needed. The function already passes the full object to `.insert(hazard)`, so `photo_url` will be included if present. No changes to `queries.ts` needed.

**Step 2: Wire photo upload in HazardForm**

Modify `src/components/HazardForm.tsx`:

Add imports at top:
```ts
import { compressPhoto, uploadPhoto } from "@/lib/photo";
```

Replace the `handleSubmit` function (lines 41-66) with:

```ts
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || !description.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      if (!eventId) {
        setError(t("HazardForm.error"));
        setSubmitting(false);
        return;
      }

      let photoUrl: string | undefined;
      if (photo) {
        const compressed = await compressPhoto(photo);
        const hazardId = crypto.randomUUID();
        photoUrl = (await uploadPhoto("photos", `hazards/${hazardId}.jpg`, compressed)) ?? undefined;
      }

      await insertHazard({
        event_id: eventId,
        description,
        photo_url: photoUrl,
        latitude: coords.lat,
        longitude: coords.lng,
        reported_by: reportedBy || undefined,
      });
      setSubmitted(true);
    } catch {
      setError(t("HazardForm.error"));
    } finally {
      setSubmitting(false);
    }
  }
```

Key behavior: If photo compression/upload fails (`photoUrl` is `undefined`), the hazard still submits without a photo. The user sees success — the photo silently fails. This matches the design doc: never block the core action on a storage failure.

**Step 3: Run build to verify no type errors**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 4: Manual verification with Playwright CLI**

```bash
npx playwright test --grep "report"
```

Expected: Report page smoke tests still pass.

**Step 5: Commit**

```bash
git add src/components/HazardForm.tsx
git commit -m "feat: wire hazard form photo to Supabase Storage upload"
```

---

### Task 4: Wire Delivery Confirmation Photo Upload

**Files:**
- Modify: `src/components/PinDetailSheet.tsx`
- Modify: `src/lib/queries.ts` (update `updateNeedStatus` to optionally include `delivery_photo_url`)

**Step 1: Update `updateNeedStatus` to accept an optional photo URL**

In `src/lib/queries.ts`, replace `updateNeedStatus` (lines 167-174):

```ts
export async function updateNeedStatus(
  id: string,
  status: string,
  deliveryPhotoUrl?: string,
) {
  const update: Record<string, string> = { status };
  if (deliveryPhotoUrl) update.delivery_photo_url = deliveryPhotoUrl;
  const { error } = await supabase.from("needs").update(update).eq("id", id);
  if (error) throw error;
}
```

This is backward-compatible — existing callers that don't pass the third arg are unaffected.

**Step 2: Wire photo upload in PinDetailSheet**

Modify `src/components/PinDetailSheet.tsx`:

Add imports at top:
```ts
import { compressPhoto, uploadPhoto } from "@/lib/photo";
```

Replace the `handleTransition` function (lines 74-86) with:

```ts
  async function handleTransition(newStatus: string) {
    if (!isOnline) return;
    setUpdating(newStatus);
    setError(null);
    try {
      let deliveryPhotoUrl: string | undefined;
      if (newStatus === "confirmed" && photoFile) {
        const compressed = await compressPhoto(photoFile);
        deliveryPhotoUrl =
          (await uploadPhoto("photos", `deliveries/${point.id}.jpg`, compressed)) ?? undefined;
      }
      await updateNeedStatus(point.id, newStatus, deliveryPhotoUrl);
      onStatusChange(point.id, newStatus);
    } catch {
      setError(t("PinDetail.updateError"));
    } finally {
      setUpdating(null);
    }
  }
```

Key behavior: Photo is only compressed/uploaded when transitioning to `confirmed` and a photo file is selected. For all other status transitions, the function behaves exactly as before.

**Step 3: Run build to verify no type errors**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 4: Run smoke tests**

```bash
npm run verify
```

Expected: All smoke tests pass.

**Step 5: Commit**

```bash
git add src/components/PinDetailSheet.tsx src/lib/queries.ts
git commit -m "feat: wire delivery confirmation photo to Supabase Storage upload"
```

---

### Task 5: Display Photos in Detail Panels

**Files:**
- Modify: `src/components/HazardDetailPanel.tsx`
- Modify: `src/components/PinDetailSheet.tsx`

**Step 1: Display hazard photo in HazardDetailPanel**

In `src/components/HazardDetailPanel.tsx`, after the description `<h3>` (line 53), add:

```tsx
      {/* Photo */}
      {hazard.photoUrl && (
        <div className="mb-4">
          <img
            src={hazard.photoUrl}
            alt={hazard.description}
            loading="lazy"
            className="w-full rounded-xl border border-neutral-400/20 object-cover"
          />
        </div>
      )}
```

The `HazardPoint` type already has `photoUrl: string | null`, so no type changes needed.

**Step 2: Display delivery photo in PinDetailSheet**

In `src/components/PinDetailSheet.tsx`, after the Notes section (after line 159), add a delivery photo section for confirmed needs:

```tsx
      {/* Delivery photo — confirmed pins */}
      {point.status === "confirmed" && point.deliveryPhotoUrl && (
        <div className="mb-4">
          <span className="text-sm text-neutral-400">{t("PinDetail.deliveryPhoto")}</span>
          <img
            src={point.deliveryPhotoUrl}
            alt={t("PinDetail.deliveryPhoto")}
            loading="lazy"
            className="mt-1 w-full rounded-xl border border-neutral-400/20 object-cover"
          />
        </div>
      )}
```

The `NeedPoint` type already has `deliveryPhotoUrl: string | null`, so no type changes needed.

**Step 3: Add translation key**

In `public/locales/en/translation.json`, add under the `PinDetail` section:
```json
"PinDetail.deliveryPhoto": "Delivery Photo"
```

Also add the equivalent key in `public/locales/fil/translation.json` and `public/locales/ilo/translation.json`. Then run `npm run translate` to machine-translate if the translate script handles it, or add manually:
- fil: `"PinDetail.deliveryPhoto": "Larawan ng Paghahatid"`
- ilo: `"PinDetail.deliveryPhoto": "Ladawan ti Panangited"`

**Step 4: Run build + smoke tests**

```bash
npm run build && npm run verify
```

Expected: No TypeScript errors, all smoke tests pass.

**Step 5: Commit**

```bash
git add src/components/HazardDetailPanel.tsx src/components/PinDetailSheet.tsx public/locales/
git commit -m "feat: display hazard and delivery photos in detail panels"
```

---

### Task 6: Final Verification

**Step 1: Full build check**

```bash
npm run lint && npm run build
```

**Step 2: Run all smoke tests**

```bash
npm run verify
```

**Step 3: Manual Playwright CLI verification**

Test the hazard photo flow:
```bash
# Navigate to report page, switch to hazard tab
npx playwright open http://localhost:5173/en/report
# Select a photo, fill form, submit — verify no console errors
```

Test the delivery photo flow:
```bash
# Navigate to relief map, click an in_transit pin
npx playwright open http://localhost:5173/en
# Add delivery photo, confirm — verify photo appears after confirmation
```

**Step 4: Commit any remaining fixes, then final commit**

```bash
git add -A
git commit -m "feat: photo uploads for hazard reports and delivery confirmations"
```
