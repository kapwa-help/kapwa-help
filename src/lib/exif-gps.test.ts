import { describe, it, expect } from "vitest";
import { extractExifGps } from "./exif-gps";

const TIFF_START = 12;

function u16le(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32le(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function writeIfdEntry(
  view: DataView,
  offset: number,
  tag: number,
  type: number,
  count: number,
  value: number,
) {
  u16le(view, offset, tag);
  u16le(view, offset + 2, type);
  u32le(view, offset + 4, count);
  u32le(view, offset + 8, value);
}

function writeRational(view: DataView, offset: number, numerator: number, denominator: number) {
  u32le(view, offset, numerator);
  u32le(view, offset + 4, denominator);
}

/**
 * Builds a synthetic JPEG buffer containing a real EXIF+GPS IFD structure:
 * SOI -> APP1("Exif\0\0") -> TIFF header (little-endian) -> IFD0 (with GPS IFD
 * and Exif IFD pointers) -> GPS IFD (lat/lng + refs) -> Exif IFD (DateTimeOriginal).
 *
 * Layout (byte offsets):
 *   0    SOI (0xFFD8)
 *   2    APP1 marker (0xFFE1) + length
 *   6    "Exif\0\0"
 *   12   TIFF header ("II", magic, IFD0 offset)
 *   20   IFD0 (2 entries: GPS IFD ptr, Exif IFD ptr)
 *   50   GPS IFD (4 entries: LatRef, Lat, LngRef, Lng)
 *   104  GPSLatitude rationals (16 deg, 30 min, 0 sec -> 16.5)
 *   128  GPSLongitude rationals (120 deg, 45 min, 0 sec -> 120.75)
 *   152  Exif IFD (1 entry: DateTimeOriginal)
 *   170  DateTimeOriginal ASCII string
 */
function buildSyntheticExifJpeg(): Uint8Array {
  const buf = new ArrayBuffer(190);
  const view = new DataView(buf);

  // SOI
  view.setUint16(0, 0xffd8);
  // APP1 marker + big-endian segment length (counts from the length field to segment end)
  view.setUint16(2, 0xffe1);
  view.setUint16(4, 190 - 4);
  // "Exif\0\0"
  view.setUint32(6, 0x45786966);
  view.setUint16(10, 0x0000);

  // TIFF header (little-endian / Intel byte order)
  view.setUint16(TIFF_START, 0x4949, true); // "II"
  view.setUint16(TIFF_START + 2, 0x002a, true); // TIFF magic
  u32le(view, TIFF_START + 4, 8); // offset to IFD0, relative to TIFF_START

  // IFD0 at TIFF_START + 8 = 20
  const ifd0Start = TIFF_START + 8;
  u16le(view, ifd0Start, 2); // 2 entries
  writeIfdEntry(view, ifd0Start + 2, 0x8825, 4, 1, 50 - TIFF_START); // GPS IFD pointer
  writeIfdEntry(view, ifd0Start + 14, 0x8769, 4, 1, 152 - TIFF_START); // Exif IFD pointer
  u32le(view, ifd0Start + 26, 0); // next IFD offset

  // GPS IFD at 50
  const gpsIfdStart = 50;
  u16le(view, gpsIfdStart, 4); // 4 entries
  writeIfdEntry(view, gpsIfdStart + 2, 0x0001, 2, 2, 0x0000004e); // GPSLatitudeRef "N"
  writeIfdEntry(view, gpsIfdStart + 14, 0x0002, 5, 3, 104 - TIFF_START); // GPSLatitude
  writeIfdEntry(view, gpsIfdStart + 26, 0x0003, 2, 2, 0x00000045); // GPSLongitudeRef "E"
  writeIfdEntry(view, gpsIfdStart + 38, 0x0004, 5, 3, 128 - TIFF_START); // GPSLongitude
  u32le(view, gpsIfdStart + 50, 0); // next IFD offset

  // GPSLatitude rationals: 16 deg, 30 min, 0 sec -> 16.5
  writeRational(view, 104, 16, 1);
  writeRational(view, 112, 30, 1);
  writeRational(view, 120, 0, 1);

  // GPSLongitude rationals: 120 deg, 45 min, 0 sec -> 120.75
  writeRational(view, 128, 120, 1);
  writeRational(view, 136, 45, 1);
  writeRational(view, 144, 0, 1);

  // Exif IFD at 152
  const exifIfdStart = 152;
  u16le(view, exifIfdStart, 1); // 1 entry
  writeIfdEntry(view, exifIfdStart + 2, 0x9003, 2, 20, 170 - TIFF_START); // DateTimeOriginal
  u32le(view, exifIfdStart + 14, 0); // next IFD offset

  // DateTimeOriginal ASCII string (19 chars + null terminator = 20 bytes)
  const bytes = new Uint8Array(buf);
  const dateStr = "2024:06:15 10:30:00\0";
  for (let i = 0; i < dateStr.length; i++) {
    bytes[170 + i] = dateStr.charCodeAt(i);
  }

  return bytes;
}

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

  it("parses lat/lng/takenAt from a synthetic JPEG with a real EXIF+GPS IFD structure", async () => {
    const bytes = buildSyntheticExifJpeg();
    const jpeg = new File([bytes.buffer as ArrayBuffer], "with-gps.jpg", { type: "image/jpeg" });
    const result = await extractExifGps(jpeg);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(16.5);
    expect(result!.lng).toBeCloseTo(120.75);
    expect(result!.takenAt).toEqual(new Date("2024-06-15T10:30:00"));
  });
});
