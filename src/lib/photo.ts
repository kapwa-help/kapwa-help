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
