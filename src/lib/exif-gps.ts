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

  if (
    lat === null || lng === null ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180
  ) return null;

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
