import { describe, it, expect, vi, beforeAll } from "vitest";

// Polyfill browser APIs not available in jsdom
const fakeBlob = new Blob(["fake-jpeg"], { type: "image/jpeg" });
const canvasConstructions: Array<{ w: number; h: number }> = [];

class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    canvasConstructions.push({ w, h });
  }
  getContext() {
    return { drawImage: vi.fn() };
  }
  convertToBlob() {
    return Promise.resolve(fakeBlob);
  }
}

beforeAll(() => {
  globalThis.createImageBitmap = vi.fn(async () => ({
    width: 100,
    height: 75,
    close: vi.fn(),
  })) as unknown as typeof createImageBitmap;

  globalThis.OffscreenCanvas = MockOffscreenCanvas as unknown as typeof OffscreenCanvas;
});

import { compressPhoto } from "@/lib/photo";

function make1x1Png(): File {
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

  it("scales down images wider than 800px", async () => {
    vi.mocked(globalThis.createImageBitmap).mockResolvedValueOnce({
      width: 1600,
      height: 1200,
      close: vi.fn(),
    } as unknown as ImageBitmap);

    canvasConstructions.length = 0;
    const file = make1x1Png();
    await compressPhoto(file);

    // Should scale 1600x1200 -> 800x600
    expect(canvasConstructions).toContainEqual({ w: 800, h: 600 });
  });
});
