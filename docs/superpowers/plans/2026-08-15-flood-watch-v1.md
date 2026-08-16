# Flood Watch V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a citizen-powered flood documentation dashboard (Flood Watch) to the existing Kapwa Help codebase — citizens submit geotagged photos, admin reviews, approved reports appear on a public Leaflet map.

**Architecture:** Same codebase, same Supabase project, new isolated `flood_reports` table. New route group at `/floodwatch` with its own layout (no Header/nav from Kapwa Help). EXIF GPS extraction before photo compression. Subdomain `floodwatch.kapwahelp.org` via Vercel rewrite.

**Tech Stack:** React + TypeScript, Supabase (Postgres + Storage + Auth), Leaflet, Vite, Tailwind CSS v4

**Spec:** `.context/flood-watch-spec.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/exif-gps.ts` | Extract GPS coords + DateTimeOriginal from JPEG EXIF before compression |
| `src/lib/flood-queries.ts` | Supabase queries for flood_reports (insert, fetch approved, fetch pending, approve, reject) |
| `src/pages/FloodWatchPage.tsx` | Public-facing page: map of approved reports + "Report Flooding" button |
| `src/pages/FloodWatchAdminPage.tsx` | Admin review queue: list pending reports, approve/reject |
| `src/components/FloodReportForm.tsx` | Submission form: photo (required), weather event, description, name, phone |
| `src/components/FloodReportDetail.tsx` | Pin detail popup: photo, weather event, description, date |
| `src/components/maps/FloodWatchMap.tsx` | Leaflet map rendering approved flood report pins |
| `supabase/flood-watch-schema.sql` | DDL for flood_reports table, enum, public view |
| `supabase/flood-watch-rls.sql` | RLS policies for flood_reports |

### Modified files

| File | Change |
|------|--------|
| `src/router.tsx` | Add `/floodwatch` route group (public page, admin page, standalone — no RootLayout) |
| `src/lib/photo.ts` | Add `uploadMedia` function accepting both image and video content types |
| `public/locales/en/translation.json` | Add `FloodWatch.*` i18n keys |
| `public/locales/fil/translation.json` | Add `FloodWatch.*` i18n keys |
| `public/locales/ilo/translation.json` | Add `FloodWatch.*` i18n keys |
| `vercel.json` | Add subdomain rewrite for `floodwatch.kapwahelp.org` |

---

## Task 1: EXIF GPS Extraction

**Files:**
- Create: `src/lib/exif-gps.ts`
- Test: `src/lib/exif-gps.test.ts`

This module extracts GPS coordinates and DateTimeOriginal from JPEG EXIF data using only browser-native APIs (ArrayBuffer + DataView). No external dependencies.

- [ ] **Step 1: Write the failing test**

Create `src/lib/exif-gps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractExifGps } from "./exif-gps";

describe("extractExifGps", () => {
  it("returns null for a non-JPEG file", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "test.png");
    const result = await extractExifGps(png);
    expect(result).toBeNull();
  });

  it("returns null for a JPEG without EXIF", async () => {
    // Minimal JPEG: SOI marker only, no APP1
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0x00, 0x00]);
    const jpeg = new File([bytes], "no-exif.jpg", { type: "image/jpeg" });
    const result = await extractExifGps(jpeg);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/exif-gps.test.ts`
Expected: FAIL with "Cannot find module" or "extractExifGps is not a function"

- [ ] **Step 3: Write the EXIF GPS extractor**

Create `src/lib/exif-gps.ts`:

```ts
export interface ExifGpsResult {
  lat: number;
  lng: number;
  takenAt: Date | null;
}

export async function extractExifGps(file: File): Promise<ExifGpsResult | null> {
  const buf = await file.slice(0, 128 * 1024).arrayBuffer();
  const view = new DataView(buf);

  if (view.byteLength < 4) return null;
  // Check JPEG SOI marker
  if (view.getUint16(0) !== 0xffd8) return null;

  // Find APP1 (EXIF) marker
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    if (marker === 0xffe1) break; // APP1
    if ((marker & 0xff00) !== 0xff00) return null;
    const len = view.getUint16(offset + 2);
    offset += 2 + len;
  }

  if (offset + 4 >= view.byteLength) return null;
  if (view.getUint16(offset) !== 0xffe1) return null;

  const app1Len = view.getUint16(offset + 2);
  const app1Start = offset + 4;

  // Check "Exif\0\0" header
  if (app1Start + 6 > view.byteLength) return null;
  const exifHeader =
    view.getUint32(app1Start) === 0x45786966 && view.getUint16(app1Start + 4) === 0x0000;
  if (!exifHeader) return null;

  const tiffStart = app1Start + 6;
  const byteOrder = view.getUint16(tiffStart);
  const le = byteOrder === 0x4949; // Intel = little-endian

  const get16 = (o: number) => view.getUint16(o, le);
  const get32 = (o: number) => view.getUint32(o, le);

  const ifdOffset = get32(tiffStart + 4);
  const ifd0Start = tiffStart + ifdOffset;

  let gpsIfdOffset: number | null = null;
  let exifIfdOffset: number | null = null;

  // Parse IFD0 to find GPS IFD pointer (tag 0x8825) and Exif IFD pointer (tag 0x8769)
  const ifd0Count = get16(ifd0Start);
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = ifd0Start + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = get16(entryOffset);
    if (tag === 0x8825) gpsIfdOffset = tiffStart + get32(entryOffset + 8);
    if (tag === 0x8769) exifIfdOffset = tiffStart + get32(entryOffset + 8);
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let latRef = "N";
  let lngRef = "E";

  if (gpsIfdOffset !== null && gpsIfdOffset + 2 < view.byteLength) {
    const gpsCount = get16(gpsIfdOffset);
    for (let i = 0; i < gpsCount; i++) {
      const entryOffset = gpsIfdOffset + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;
      const tag = get16(entryOffset);
      const valueOffset = tiffStart + get32(entryOffset + 8);

      if (tag === 0x0001) {
        // GPSLatitudeRef
        latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
      } else if (tag === 0x0002 && valueOffset + 24 <= view.byteLength) {
        // GPSLatitude (3 rationals)
        lat = readRationalDMS(view, valueOffset, le);
      } else if (tag === 0x0003) {
        // GPSLongitudeRef
        lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
      } else if (tag === 0x0004 && valueOffset + 24 <= view.byteLength) {
        // GPSLongitude (3 rationals)
        lng = readRationalDMS(view, valueOffset, le);
      }
    }
  }

  if (lat === null || lng === null) return null;

  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;

  // Parse DateTimeOriginal from Exif IFD
  let takenAt: Date | null = null;
  if (exifIfdOffset !== null && exifIfdOffset + 2 < view.byteLength) {
    const exifCount = get16(exifIfdOffset);
    for (let i = 0; i < exifCount; i++) {
      const entryOffset = exifIfdOffset + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;
      const tag = get16(entryOffset);
      if (tag === 0x9003) {
        // DateTimeOriginal — ASCII string "YYYY:MM:DD HH:MM:SS"
        const strOffset = tiffStart + get32(entryOffset + 8);
        const strLen = get32(entryOffset + 4);
        if (strOffset + strLen <= view.byteLength) {
          const bytes = new Uint8Array(buf, strOffset, Math.min(strLen, 19));
          const str = String.fromCharCode(...bytes).replace(/\0/g, "");
          // "YYYY:MM:DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
          const iso = str.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T");
          const d = new Date(iso);
          if (!isNaN(d.getTime())) takenAt = d;
        }
        break;
      }
    }
  }

  return { lat, lng, takenAt };
}

function readRationalDMS(view: DataView, offset: number, le: boolean): number {
  const deg = view.getUint32(offset, le) / view.getUint32(offset + 4, le);
  const min = view.getUint32(offset + 8, le) / view.getUint32(offset + 12, le);
  const sec = view.getUint32(offset + 16, le) / view.getUint32(offset + 20, le);
  return deg + min / 60 + sec / 3600;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/exif-gps.test.ts`
Expected: PASS — non-JPEG returns null, JPEG without EXIF returns null

- [ ] **Step 5: Commit**

```bash
git add src/lib/exif-gps.ts src/lib/exif-gps.test.ts
git commit -m "feat(flood-watch): add EXIF GPS extraction from JPEG files"
```

---

## Task 2: Database Schema + RLS

**Files:**
- Create: `supabase/flood-watch-schema.sql`
- Create: `supabase/flood-watch-rls.sql`

These are SQL files applied manually via the Supabase dashboard or CLI. They create the `flood_reports` table, enum, public view, and RLS policies — completely isolated from existing tables.

- [ ] **Step 1: Write the schema SQL**

Create `supabase/flood-watch-schema.sql`:

```sql
-- Flood Watch schema (isolated from event-scoped tables)

create type flood_report_status as enum ('pending', 'approved', 'rejected');

create table flood_reports (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  latitude float8 not null,
  longitude float8 not null,
  weather_event text,
  description text,
  reporter_name text,
  reporter_phone text,
  status flood_report_status not null default 'pending',
  photo_taken_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

-- Public view: approved reports only, PII stripped
create or replace view flood_reports_public
  with (security_invoker = false)
as
  select
    id,
    photo_url,
    latitude,
    longitude,
    weather_event,
    description,
    status,
    photo_taken_at,
    created_at
  from flood_reports
  where status = 'approved';
```

- [ ] **Step 2: Write the RLS SQL**

Create `supabase/flood-watch-rls.sql`:

```sql
-- Flood Watch RLS policies

alter table flood_reports enable row level security;

-- Anyone can submit a report (forced pending, no review fields)
create policy "flood_reports_anon_insert"
  on flood_reports for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Admins can read all reports (including pending + PII)
create policy "flood_reports_admin_select"
  on flood_reports for select
  to authenticated
  using (is_admin());

-- Admins can update status (approve/reject)
create policy "flood_reports_admin_update"
  on flood_reports for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Public view bypasses RLS via security_invoker=false
-- so anon can read approved, PII-stripped reports through the view

-- Storage: allow anonymous uploads and public reads for flood-reports/ prefix
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

create policy "flood_photos_anon_upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'flood-reports');

create policy "flood_photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = 'flood-reports');
```

- [ ] **Step 3: Apply schema to linked Supabase project**

Run both SQL files in order as a single transaction:

```bash
supabase db query --linked -f supabase/flood-watch-schema.sql
supabase db query --linked -f supabase/flood-watch-rls.sql
```

Verify the table, view, and policies exist:

```bash
supabase db query --linked -c "SELECT tablename FROM pg_tables WHERE tablename = 'flood_reports';"
supabase db query --linked -c "SELECT viewname FROM pg_views WHERE viewname = 'flood_reports_public';"
supabase db query --linked -c "SELECT policyname FROM pg_policies WHERE tablename = 'flood_reports';"
```

Expected: table, view, and 3 policies (anon_insert, admin_select, admin_update) plus 2 storage policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/flood-watch-schema.sql supabase/flood-watch-rls.sql
git commit -m "feat(flood-watch): add flood_reports table schema, RLS, and storage policies"
```

---

## Task 3: Flood Report Queries

**Files:**
- Create: `src/lib/flood-queries.ts`

Query functions for the flood_reports table, following the exact pattern from `src/lib/queries.ts` — explicit row types, snake_case → camelCase mapping.

- [ ] **Step 1: Write the query module**

Create `src/lib/flood-queries.ts`:

```ts
import { supabase } from "./supabase";

// Display type (camelCase, for UI)
export interface FloodReport {
  id: string;
  photoUrl: string;
  lat: number;
  lng: number;
  weatherEvent: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  photoTakenAt: string | null;
  createdAt: string;
  // Admin-only fields (null in public view)
  reporterName: string | null;
  reporterPhone: string | null;
}

// Insert type (snake_case, matching DB columns)
export interface FloodReportInsert {
  id: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  weather_event?: string;
  description?: string;
  reporter_name?: string;
  reporter_phone?: string;
  photo_taken_at?: string;
}

interface FloodReportRow {
  id: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  weather_event: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  photo_taken_at: string | null;
  created_at: string;
  reporter_name?: string | null;
  reporter_phone?: string | null;
}

function mapRow(row: FloodReportRow): FloodReport {
  return {
    id: row.id,
    photoUrl: row.photo_url,
    lat: row.latitude,
    lng: row.longitude,
    weatherEvent: row.weather_event,
    description: row.description,
    status: row.status,
    photoTakenAt: row.photo_taken_at,
    createdAt: row.created_at,
    reporterName: row.reporter_name ?? null,
    reporterPhone: row.reporter_phone ?? null,
  };
}

export async function getApprovedFloodReports(): Promise<FloodReport[]> {
  const { data, error } = await supabase
    .from("flood_reports_public")
    .select("id, photo_url, latitude, longitude, weather_event, description, status, photo_taken_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as FloodReportRow[]).map(mapRow);
}

export async function getPendingFloodReports(): Promise<FloodReport[]> {
  const { data, error } = await supabase
    .from("flood_reports")
    .select("id, photo_url, latitude, longitude, weather_event, description, status, photo_taken_at, created_at, reporter_name, reporter_phone")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as FloodReportRow[]).map(mapRow);
}

export async function getAllFloodReports(): Promise<FloodReport[]> {
  const { data, error } = await supabase
    .from("flood_reports")
    .select("id, photo_url, latitude, longitude, weather_event, description, status, photo_taken_at, created_at, reporter_name, reporter_phone")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as FloodReportRow[]).map(mapRow);
}

export async function insertFloodReport(report: FloodReportInsert): Promise<void> {
  const { error } = await supabase.from("flood_reports").insert(report);
  if (error) throw error;
}

export async function updateFloodReportStatus(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from("flood_reports")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/flood-queries.ts`
Expected: No type errors (may warn about unused, that's fine — it's a new module not yet imported)

- [ ] **Step 3: Commit**

```bash
git add src/lib/flood-queries.ts
git commit -m "feat(flood-watch): add Supabase query functions for flood reports"
```

---

## Task 4: Media Upload (Photo + Video)

**Files:**
- Modify: `src/lib/photo.ts`

Add an `uploadMedia` function that handles both images and videos. The existing `uploadPhoto` hardcodes `contentType: "image/jpeg"` — the new function accepts any content type.

- [ ] **Step 1: Add uploadMedia to photo.ts**

Add to the end of `src/lib/photo.ts`:

```ts
export async function uploadMedia(
  bucket: string,
  path: string,
  blob: Blob,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: blob.type, upsert: true });

  if (error) {
    console.error("Media upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/photo.ts
git commit -m "feat(flood-watch): add uploadMedia for photo and video uploads"
```

---

## Task 5: Flood Report Submission Form

**Files:**
- Create: `src/components/FloodReportForm.tsx`

The submission form. Photo is required. On photo selection, extracts EXIF GPS; falls back to browser geolocation. Shows a mini-map preview of the extracted location. Handles both online submission and offline outbox.

- [ ] **Step 1: Write the form component**

Create `src/components/FloodReportForm.tsx`:

```tsx
import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { extractExifGps } from "@/lib/exif-gps";
import { compressPhoto, uploadMedia } from "@/lib/photo";
import { insertFloodReport, type FloodReportInsert } from "@/lib/flood-queries";
import { roundCoord } from "@/lib/geohash";
import {
  FormLabel,
  FormInput,
  FormTextarea,
  FormSubmitButton,
  FormError,
  FormSuccess,
  FormSuccessButton,
} from "@/components/forms/form-fields";

interface Props {
  onSubmitted?: () => void;
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

export default function FloodReportForm({ onSubmitted }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photoTakenAt, setPhotoTakenAt] = useState<Date | null>(null);
  const [locationSource, setLocationSource] = useState<"exif" | "browser" | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [weatherEvent, setWeatherEvent] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestBrowserLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationSource("browser");
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
      },
    );
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const video = file.type.startsWith("video/");
    if (video && file.size > MAX_VIDEO_BYTES) {
      setError(t("FloodWatch.videoTooLarge"));
      return;
    }

    setIsVideo(video);
    setMediaFile(file);
    setError(null);

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(URL.createObjectURL(file));

    // Try EXIF GPS for images
    if (!video) {
      const exif = await extractExifGps(file);
      if (exif) {
        setCoords({ lat: exif.lat, lng: exif.lng });
        setLocationSource("exif");
        setPhotoTakenAt(exif.takenAt);
        return;
      }
    }

    // Fallback to browser geolocation
    setCoords(null);
    setLocationSource(null);
    setPhotoTakenAt(null);
    requestBrowserLocation();
  }

  function removeMedia() {
    setMediaFile(null);
    setIsVideo(false);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setCoords(null);
    setLocationSource(null);
    setPhotoTakenAt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaFile || !coords) return;
    setSubmitting(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      const ext = isVideo ? mediaFile.name.split(".").pop() ?? "mp4" : "jpg";
      const storagePath = `flood-reports/${id}.${ext}`;

      let uploadBlob: Blob;
      if (isVideo) {
        uploadBlob = mediaFile;
      } else {
        uploadBlob = await compressPhoto(mediaFile);
      }

      const mediaUrl = await uploadMedia("photos", storagePath, uploadBlob);
      if (!mediaUrl) {
        setError(t("FloodWatch.uploadFailed"));
        setSubmitting(false);
        return;
      }

      const payload: FloodReportInsert = {
        id,
        photo_url: mediaUrl,
        latitude: roundCoord(coords.lat),
        longitude: roundCoord(coords.lng),
        weather_event: weatherEvent.trim() || undefined,
        description: description.trim() || undefined,
        reporter_name: reporterName.trim() || undefined,
        reporter_phone: reporterPhone.trim() || undefined,
        photo_taken_at: photoTakenAt?.toISOString(),
      };

      await insertFloodReport(payload);
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError(t("FloodWatch.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <FormSuccess>
        <h2 className="text-xl font-bold text-success">
          {t("FloodWatch.submitSuccess")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t("FloodWatch.submitSuccessDetail")}
        </p>
        <FormSuccessButton
          onClick={() => {
            setSubmitted(false);
            setWeatherEvent("");
            setDescription("");
            setReporterName("");
            setReporterPhone("");
            removeMedia();
          }}
        >
          {t("FloodWatch.submitAnother")}
        </FormSuccessButton>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo/Video */}
      <div>
        <FormLabel htmlFor="flood-media" required>
          {t("FloodWatch.photo")}
        </FormLabel>
        {mediaPreview ? (
          <div className="relative mt-1">
            {isVideo ? (
              <video
                src={mediaPreview}
                controls
                className="h-40 w-full rounded-xl border border-neutral-400/20 object-cover"
              />
            ) : (
              <img
                src={mediaPreview}
                alt=""
                className="h-40 w-full rounded-xl border border-neutral-400/20 object-cover"
              />
            )}
            <button
              type="button"
              onClick={removeMedia}
              className="absolute right-2 top-2 rounded-full bg-base/80 p-1 text-neutral-50 hover:bg-base"
              aria-label={t("FloodWatch.removeMedia")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-400/40 bg-base px-4 py-6 text-sm text-neutral-400 hover:border-primary hover:text-neutral-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            {t("FloodWatch.addMedia")}
          </button>
        )}
        <input
          ref={fileInputRef}
          id="flood-media"
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Location status */}
      {mediaFile && (
        <div className="rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-sm">
          {locationLoading && (
            <span className="text-neutral-400">{t("FloodWatch.locationAcquiring")}</span>
          )}
          {coords && locationSource === "exif" && (
            <span className="text-success">{t("FloodWatch.locationExif")}</span>
          )}
          {coords && locationSource === "browser" && (
            <span className="text-warning">{t("FloodWatch.locationBrowser")}</span>
          )}
          {!coords && !locationLoading && (
            <span className="text-error">{t("FloodWatch.locationFailed")}</span>
          )}
          {coords && (
            <span className="ml-2 text-neutral-400">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* Weather Event */}
      <div>
        <FormLabel htmlFor="flood-weather">{t("FloodWatch.weatherEvent")}</FormLabel>
        <FormInput
          id="flood-weather"
          type="text"
          value={weatherEvent}
          onChange={(e) => setWeatherEvent(e.target.value)}
          placeholder={t("FloodWatch.weatherEventPlaceholder")}
        />
      </div>

      {/* Description */}
      <div>
        <FormLabel htmlFor="flood-description">{t("FloodWatch.description")}</FormLabel>
        <FormTextarea
          id="flood-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("FloodWatch.descriptionPlaceholder")}
          rows={3}
        />
      </div>

      {/* Reporter Name */}
      <div>
        <FormLabel htmlFor="flood-name">{t("FloodWatch.reporterName")}</FormLabel>
        <FormInput
          id="flood-name"
          type="text"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
          placeholder={t("FloodWatch.reporterNamePlaceholder")}
        />
        <p className="mt-1 text-xs text-neutral-400">{t("FloodWatch.adminOnly")}</p>
      </div>

      {/* Reporter Phone */}
      <div>
        <FormLabel htmlFor="flood-phone">{t("FloodWatch.reporterPhone")}</FormLabel>
        <FormInput
          id="flood-phone"
          type="tel"
          value={reporterPhone}
          onChange={(e) => setReporterPhone(e.target.value)}
          placeholder={t("FloodWatch.reporterPhonePlaceholder")}
        />
        <p className="mt-1 text-xs text-neutral-400">{t("FloodWatch.adminOnly")}</p>
      </div>

      <FormError message={error} />

      <FormSubmitButton disabled={submitting || !mediaFile || !coords}>
        {submitting ? t("FloodWatch.submitting") : t("FloodWatch.submit")}
      </FormSubmitButton>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/FloodReportForm.tsx
git commit -m "feat(flood-watch): add flood report submission form with EXIF GPS"
```

---

## Task 6: Flood Watch Map Component

**Files:**
- Create: `src/components/maps/FloodWatchMap.tsx`

A Leaflet map showing approved flood report pins. Simpler than ReliefMapLeaflet — single marker type, click opens detail popup. Follows the same react-leaflet patterns.

- [ ] **Step 1: Write the map component**

Create `src/components/maps/FloodWatchMap.tsx`:

```tsx
import { MapContainer, TileLayer, Marker, Tooltip, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { FloodReport } from "@/lib/flood-queries";

const LA_UNION_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;

const floodIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#007EA7;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface Props {
  reports: FloodReport[];
  onSelect: (report: FloodReport) => void;
}

export default function FloodWatchMap({ reports, onSelect }: Props) {
  return (
    <MapContainer
      center={LA_UNION_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ZoomControl position="bottomright" />
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={floodIcon}
          eventHandlers={{ click: () => onSelect(report) }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {report.weatherEvent ?? report.description ?? new Date(report.createdAt).toLocaleDateString()}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/maps/FloodWatchMap.tsx
git commit -m "feat(flood-watch): add Leaflet map component for flood reports"
```

---

## Task 7: Flood Report Detail Component

**Files:**
- Create: `src/components/FloodReportDetail.tsx`

Detail view shown when a map pin is clicked. Shows photo, weather event, description, date. Admin sees PII + approve/reject buttons. Uses the same sheet/panel pattern as `HazardDetailPanel`.

- [ ] **Step 1: Write the detail component**

Create `src/components/FloodReportDetail.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FloodReport } from "@/lib/flood-queries";
import { updateFloodReportStatus } from "@/lib/flood-queries";
import { useAuthContext } from "@/lib/auth-context";
import { AdminOnly } from "@/components/AdminOnly";

interface Props {
  report: FloodReport;
  onClose: () => void;
  onStatusChange?: (id: string, status: "approved" | "rejected") => void;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi)$/i.test(url);
}

export default function FloodReportDetail({ report, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(status: "approved" | "rejected") {
    if (!user) return;
    setUpdating(true);
    try {
      await updateFloodReportStatus(report.id, status, user.id);
      onStatusChange?.(report.id, status);
    } catch {
      setUpdating(false);
    }
  }

  const dateStr = report.photoTakenAt
    ? new Date(report.photoTakenAt).toLocaleDateString()
    : new Date(report.createdAt).toLocaleDateString();

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={report.weatherEvent ?? t("FloodWatch.reportDetail")}
        className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <span className="text-xs font-medium text-neutral-400">
              {dateStr}
            </span>
            <button
              onClick={onClose}
              aria-label={t("PinDetail.close")}
              className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Photo/Video */}
          {isVideoUrl(report.photoUrl) ? (
            <video
              src={report.photoUrl}
              controls
              className="mb-4 w-full rounded-xl border border-neutral-400/20"
            />
          ) : (
            <img
              src={report.photoUrl}
              alt={report.description ?? ""}
              loading="lazy"
              className="mb-4 w-full rounded-xl border border-neutral-400/20 object-cover"
            />
          )}

          {/* Weather event */}
          {report.weatherEvent && (
            <h3 className="mb-2 text-lg font-semibold text-neutral-50">
              {report.weatherEvent}
            </h3>
          )}

          {/* Description */}
          {report.description && (
            <p className="mb-4 text-sm text-neutral-100">{report.description}</p>
          )}

          {/* Status badge */}
          <div className="mb-4">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                report.status === "approved"
                  ? "bg-success/20 text-success"
                  : report.status === "rejected"
                    ? "bg-error/20 text-error"
                    : "bg-warning/20 text-warning"
              }`}
            >
              {t(`FloodWatch.status_${report.status}`)}
            </span>
          </div>

          {/* Admin-only: PII + actions */}
          <AdminOnly>
            <div className="space-y-3 border-t border-neutral-400/20 pt-4">
              {report.reporterName && (
                <div className="text-sm">
                  <span className="text-neutral-400">{t("FloodWatch.reporterName")}</span>
                  <p className="text-neutral-50">{report.reporterName}</p>
                </div>
              )}
              {report.reporterPhone && (
                <div className="text-sm">
                  <span className="text-neutral-400">{t("FloodWatch.reporterPhone")}</span>
                  <p className="text-neutral-50">
                    <a href={`tel:${report.reporterPhone}`} className="text-primary hover:underline">
                      {report.reporterPhone}
                    </a>
                  </p>
                </div>
              )}

              {report.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleStatusChange("approved")}
                    disabled={updating}
                    className="flex-1 cursor-pointer rounded-lg bg-success/20 px-4 py-2.5 text-sm font-medium text-success hover:bg-success/30 disabled:opacity-50"
                  >
                    {t("FloodWatch.approve")}
                  </button>
                  <button
                    onClick={() => handleStatusChange("rejected")}
                    disabled={updating}
                    className="flex-1 cursor-pointer rounded-lg bg-error/20 px-4 py-2.5 text-sm font-medium text-error hover:bg-error/30 disabled:opacity-50"
                  >
                    {t("FloodWatch.reject")}
                  </button>
                </div>
              )}
            </div>
          </AdminOnly>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/FloodReportDetail.tsx
git commit -m "feat(flood-watch): add report detail sheet with admin approve/reject"
```

---

## Task 8: Flood Watch Public Page

**Files:**
- Create: `src/pages/FloodWatchPage.tsx`

The main public-facing page. Shows the map full-screen with a "Report Flooding" FAB. Tapping the FAB opens the submission form as a modal/sheet. Tapping a pin opens the detail sheet.

- [ ] **Step 1: Write the page component**

Create `src/pages/FloodWatchPage.tsx`:

```tsx
import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { getApprovedFloodReports, type FloodReport } from "@/lib/flood-queries";

const FloodWatchMap = lazy(() => import("@/components/maps/FloodWatchMap"));
const FloodReportForm = lazy(() => import("@/components/FloodReportForm"));
const FloodReportDetail = lazy(() => import("@/components/FloodReportDetail"));

export default function FloodWatchPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FloodReport | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const data = await getApprovedFloodReports();
      setReports(data);
    } catch {
      // Silently fail — map just shows no pins
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchReports();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchReports]);

  return (
    <div className="flex h-dvh flex-col bg-base">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-neutral-400/20 bg-secondary px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-50">
          {t("FloodWatch.title")}
        </h1>
        <span className="text-xs text-neutral-400">
          {t("FloodWatch.subtitle")}
        </span>
      </header>

      {/* Map */}
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-neutral-400">
            {t("App.loading")}
          </div>
        ) : (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-neutral-400">{t("App.loading")}</div>}>
            <FloodWatchMap reports={reports} onSelect={setSelected} />
          </Suspense>
        )}

        {/* Report button (FAB) */}
        {!showForm && !selected && (
          <button
            onClick={() => setShowForm(true)}
            className="absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-neutral-50 shadow-lg hover:bg-primary/80"
          >
            {t("FloodWatch.reportButton")}
          </button>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-[999] bg-base/60" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-lg font-semibold text-neutral-50">
                {t("FloodWatch.formTitle")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
              <Suspense fallback={null}>
                <FloodReportForm
                  onSubmitted={() => {
                    setShowForm(false);
                    fetchReports();
                  }}
                />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {/* Detail sheet */}
      {selected && (
        <Suspense fallback={null}>
          <FloodReportDetail
            report={selected}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/FloodWatchPage.tsx
git commit -m "feat(flood-watch): add public page with map, report form, and detail sheet"
```

---

## Task 9: Flood Watch Admin Page

**Files:**
- Create: `src/pages/FloodWatchAdminPage.tsx`

Admin queue page. Shows pending reports as a list with thumbnail, location, date, description. Tapping a report opens the detail sheet with approve/reject. Admin-only — redirects to login if not authenticated.

- [ ] **Step 1: Write the admin page**

Create `src/pages/FloodWatchAdminPage.tsx`:

```tsx
import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "@/lib/auth-context";
import { getPendingFloodReports, getAllFloodReports, type FloodReport } from "@/lib/flood-queries";

const FloodReportDetail = lazy(() => import("@/components/FloodReportDetail"));

type Tab = "pending" | "all";

export default function FloodWatchAdminPage() {
  const { t } = useTranslation();
  const { isAdmin, loading: authLoading } = useAuthContext();
  const [tab, setTab] = useState<Tab>("pending");
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FloodReport | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === "pending" ? await getPendingFloodReports() : await getAllFloodReports();
      setReports(data);
    } catch {
      // Silent — shows empty list
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (isAdmin) fetchReports();
  }, [isAdmin, fetchReports]);

  function handleStatusChange(id: string, status: "approved" | "rejected") {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
  }

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-base text-neutral-400">
        {t("App.loading")}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-base">
        <p className="text-neutral-400">{t("FloodWatch.adminRequired")}</p>
        <a
          href="/demo/en/login"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80"
        >
          {t("FloodWatch.login")}
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base">
      {/* Header */}
      <header className="border-b border-neutral-400/20 bg-secondary px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-50">
          {t("FloodWatch.adminTitle")}
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-neutral-400/20">
        <button
          onClick={() => setTab("pending")}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            tab === "pending" ? "border-b-2 border-primary text-primary" : "text-neutral-400"
          }`}
        >
          {t("FloodWatch.tabPending")}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            tab === "all" ? "border-b-2 border-primary text-primary" : "text-neutral-400"
          }`}
        >
          {t("FloodWatch.tabAll")}
        </button>
      </div>

      {/* Report list */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        {loading ? (
          <p className="text-center text-neutral-400">{t("App.loading")}</p>
        ) : reports.length === 0 ? (
          <p className="text-center text-neutral-400">
            {tab === "pending" ? t("FloodWatch.noPending") : t("FloodWatch.noReports")}
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelected(report)}
                className="flex w-full items-start gap-3 rounded-xl border border-neutral-400/20 bg-secondary p-3 text-left hover:border-primary/40"
              >
                {/\.(mp4|mov|webm|avi)$/i.test(report.photoUrl) ? (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-400/20 bg-base text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <img
                    src={report.photoUrl}
                    alt=""
                    className="h-16 w-16 flex-shrink-0 rounded-lg border border-neutral-400/20 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {report.weatherEvent && (
                      <span className="text-sm font-medium text-neutral-50">
                        {report.weatherEvent}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        report.status === "approved"
                          ? "bg-success/20 text-success"
                          : report.status === "rejected"
                            ? "bg-error/20 text-error"
                            : "bg-warning/20 text-warning"
                      }`}
                    >
                      {t(`FloodWatch.status_${report.status}`)}
                    </span>
                  </div>
                  {report.description && (
                    <p className="mt-1 truncate text-sm text-neutral-100">
                      {report.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(report.createdAt).toLocaleDateString()}
                    {report.reporterName && ` — ${report.reporterName}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      {selected && (
        <Suspense fallback={null}>
          <FloodReportDetail
            report={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        </Suspense>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/FloodWatchAdminPage.tsx
git commit -m "feat(flood-watch): add admin review queue page"
```

---

## Task 10: Routing + i18n

**Files:**
- Modify: `src/router.tsx`
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/fil/translation.json`
- Modify: `public/locales/ilo/translation.json`

Add `/floodwatch` route group (standalone — no RootLayout/Header) and all i18n keys.

- [ ] **Step 1: Add routes to router.tsx**

Add lazy imports at the top of `src/router.tsx`, after the existing lazy imports:

```ts
const FloodWatchPage = lazyWithReload(() => import("./pages/FloodWatchPage"));
const FloodWatchAdminPage = lazyWithReload(() => import("./pages/FloodWatchAdminPage"));
```

Add route entries to the router array, before the legacy locale redirect routes:

```ts
{ path: "/floodwatch", element: <FloodWatchPage /> },
{ path: "/floodwatch/admin", element: <FloodWatchAdminPage /> },
```

These routes are standalone — no `RootLayout`, no locale prefix. The Flood Watch pages use `useTranslation()` which reads from the existing i18n setup (defaults to `en`).

- [ ] **Step 2: Add English i18n keys**

Add to `public/locales/en/translation.json` under a new `"FloodWatch"` key:

```json
"FloodWatch": {
  "title": "Flood Watch",
  "subtitle": "La Union, Philippines",
  "reportButton": "Report Flooding",
  "formTitle": "Report Flooding",
  "photo": "Photo or Video",
  "addMedia": "Add photo or video",
  "removeMedia": "Remove",
  "weatherEvent": "Weather Event",
  "weatherEventPlaceholder": "e.g. Typhoon Carina",
  "description": "Description",
  "descriptionPlaceholder": "What's happening here?",
  "reporterName": "Your Name",
  "reporterNamePlaceholder": "Optional",
  "reporterPhone": "Phone Number",
  "reporterPhonePlaceholder": "Optional",
  "adminOnly": "Only visible to reviewers",
  "submit": "Submit Report",
  "submitting": "Submitting…",
  "submitSuccess": "Report Submitted",
  "submitSuccessDetail": "Your report will appear on the map after review.",
  "submitAnother": "Submit Another",
  "submitError": "Failed to submit report",
  "uploadFailed": "Failed to upload media",
  "videoTooLarge": "Video must be under 50MB",
  "locationAcquiring": "Getting location…",
  "locationExif": "Location from photo",
  "locationBrowser": "Location from device",
  "locationFailed": "Could not determine location",
  "reportDetail": "Report Detail",
  "approve": "Approve",
  "reject": "Reject",
  "status_pending": "Pending",
  "status_approved": "Approved",
  "status_rejected": "Rejected",
  "adminTitle": "Flood Watch — Review",
  "adminRequired": "Admin access required",
  "tabPending": "Pending",
  "tabAll": "All Reports",
  "noPending": "No reports pending review",
  "noReports": "No reports yet",
  "login": "Log In"
}
```

- [ ] **Step 3: Add Filipino i18n keys**

Add to `public/locales/fil/translation.json`:

```json
"FloodWatch": {
  "title": "Flood Watch",
  "subtitle": "La Union, Pilipinas",
  "reportButton": "Mag-ulat ng Baha",
  "formTitle": "Mag-ulat ng Baha",
  "photo": "Larawan o Video",
  "addMedia": "Magdagdag ng larawan o video",
  "removeMedia": "Alisin",
  "weatherEvent": "Kaganapang Panahon",
  "weatherEventPlaceholder": "hal. Bagyong Carina",
  "description": "Paglalarawan",
  "descriptionPlaceholder": "Ano ang nangyayari dito?",
  "reporterName": "Pangalan Mo",
  "reporterNamePlaceholder": "Opsyonal",
  "reporterPhone": "Numero ng Telepono",
  "reporterPhonePlaceholder": "Opsyonal",
  "adminOnly": "Makikita lamang ng mga reviewer",
  "submit": "Isumite ang Ulat",
  "submitting": "Isinusumite…",
  "submitSuccess": "Naisumite ang Ulat",
  "submitSuccessDetail": "Lalabas ang iyong ulat sa mapa pagkatapos ng pagsusuri.",
  "submitAnother": "Magsumite ng Isa Pa",
  "submitError": "Hindi naisumite ang ulat",
  "uploadFailed": "Hindi na-upload ang media",
  "videoTooLarge": "Ang video ay dapat mas mababa sa 50MB",
  "locationAcquiring": "Kinukuha ang lokasyon…",
  "locationExif": "Lokasyon mula sa larawan",
  "locationBrowser": "Lokasyon mula sa device",
  "locationFailed": "Hindi matukoy ang lokasyon",
  "reportDetail": "Detalye ng Ulat",
  "approve": "Aprubahan",
  "reject": "Tanggihan",
  "status_pending": "Naghihintay",
  "status_approved": "Aprubado",
  "status_rejected": "Tinanggihan",
  "adminTitle": "Flood Watch — Pagsusuri",
  "adminRequired": "Kailangan ng admin access",
  "tabPending": "Naghihintay",
  "tabAll": "Lahat ng Ulat",
  "noPending": "Walang ulat na naghihintay ng pagsusuri",
  "noReports": "Wala pang mga ulat",
  "login": "Mag-log In"
}
```

- [ ] **Step 4: Add Ilocano i18n keys**

Add to `public/locales/ilo/translation.json`:

```json
"FloodWatch": {
  "title": "Flood Watch",
  "subtitle": "La Union, Pilipinas",
  "reportButton": "Ireport ti Layus",
  "formTitle": "Ireport ti Layus",
  "photo": "Ladawan wenno Video",
  "addMedia": "Mangnayon ti ladawan wenno video",
  "removeMedia": "Ikkaten",
  "weatherEvent": "Paspasamak ti Tiempo",
  "weatherEventPlaceholder": "kas pagarigan Bagyo Carina",
  "description": "Deskripsion",
  "descriptionPlaceholder": "Ania ti mapasamak ditoy?",
  "reporterName": "Nagan Mo",
  "reporterNamePlaceholder": "Opsyonal",
  "reporterPhone": "Numero ti Telepono",
  "reporterPhonePlaceholder": "Opsyonal",
  "adminOnly": "Makita laeng dagiti reviewer",
  "submit": "Iyulat",
  "submitting": "Ag-iyulat…",
  "submitSuccess": "Naiyulat",
  "submitSuccessDetail": "Agparang ti ulat mo iti mapa kalpasan ti panagrepaso.",
  "submitAnother": "Mangiyulat Manen",
  "submitError": "Saan a naiyulat",
  "uploadFailed": "Saan a na-upload ti media",
  "videoTooLarge": "Ti video ket masapul a nababbaba ngem 50MB",
  "locationAcquiring": "Ag-ala ti lokasion…",
  "locationExif": "Lokasion manipud ti ladawan",
  "locationBrowser": "Lokasion manipud ti device",
  "locationFailed": "Saan a mabirukan ti lokasion",
  "reportDetail": "Detalye ti Ulat",
  "approve": "Aprubaran",
  "reject": "Iparit",
  "status_pending": "Agin-inana",
  "status_approved": "Naaprubaran",
  "status_rejected": "Naiparit",
  "adminTitle": "Flood Watch — Panagrepaso",
  "adminRequired": "Masapul ti admin access",
  "tabPending": "Agin-inana",
  "tabAll": "Amin nga Ulat",
  "noPending": "Awan ti ulat nga agin-inana ti panagrepaso",
  "noReports": "Awan pay dagiti ulat",
  "login": "Ag-log In"
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Commit**

```bash
git add src/router.tsx public/locales/en/translation.json public/locales/fil/translation.json public/locales/ilo/translation.json
git commit -m "feat(flood-watch): add routes and i18n translations (en, fil, ilo)"
```

---

## Task 11: Vercel Subdomain Routing

**Files:**
- Modify: `src/router.tsx`
- Modify: `vercel.json`

Route `floodwatch.kapwahelp.org` to the Flood Watch pages. Strategy: keep `vercel.json` as a simple SPA rewrite (all paths → `index.html`), and detect the subdomain at the React Router level to render the right page.

The Vercel dashboard step (adding `floodwatch.kapwahelp.org` as a domain) is a manual operation by Jacob — not automatable in code.

- [ ] **Step 1: Add subdomain detection to router.tsx**

Add a component that checks the hostname and renders accordingly. Replace the existing `/` route element:

```tsx
const FLOOD_WATCH_HOST = "floodwatch.kapwahelp.org";

function RootRedirect() {
  const isFloodWatch =
    typeof window !== "undefined" &&
    window.location.hostname === FLOOD_WATCH_HOST;
  if (isFloodWatch) return <Navigate to="/floodwatch" replace />;
  return <LandingPage />;
}
```

Update the route array:

```ts
{ path: "/", element: <RootRedirect /> },
```

This means:
- `floodwatch.kapwahelp.org/` → redirects to `/floodwatch` → renders FloodWatchPage
- `floodwatch.kapwahelp.org/floodwatch` → renders FloodWatchPage directly
- `floodwatch.kapwahelp.org/floodwatch/admin` → renders FloodWatchAdminPage
- `kapwahelp.org/` → renders LandingPage (unchanged)
- `kapwahelp.org/floodwatch` → also works (Flood Watch accessible from main domain too)

- [ ] **Step 2: Keep vercel.json as-is**

The existing SPA rewrite already handles everything — no changes needed:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Add Vercel domain (manual step — document only)**

In the Vercel dashboard for the `kapwa-help` project:
1. Go to Settings → Domains
2. Add `floodwatch.kapwahelp.org`
3. Configure DNS: add a CNAME record `floodwatch` pointing to `cname.vercel-dns.com`
4. Verify the domain resolves

- [ ] **Step 4: Commit**

```bash
git add src/router.tsx
git commit -m "feat(flood-watch): add subdomain detection for floodwatch.kapwahelp.org"
```

---

## Task 12: Smoke Test + Verify

**Files:**
- None — manual verification

- [ ] **Step 1: Run existing tests to check for regressions**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 2: Run existing smoke tests**

Run: `npm run verify`
Expected: All existing Playwright smoke tests pass (relief map, dashboard, report page across locales)

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds, no type errors, no warnings

- [ ] **Step 4: Manual verification of Flood Watch routes**

Run: `npm run dev`

Check in browser:
1. Navigate to `http://localhost:5173/floodwatch` — should see the map + "Report Flooding" button
2. Click "Report Flooding" — form sheet opens with photo input, weather event, description, name, phone
3. Navigate to `http://localhost:5173/floodwatch/admin` — should see the admin review queue (empty if no data in Supabase yet)
4. Existing routes still work: `http://localhost:5173/demo/en`, `/demo/en/dashboard`, `/demo/en/report`

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix(flood-watch): address verification findings"
```
