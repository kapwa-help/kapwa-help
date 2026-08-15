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
