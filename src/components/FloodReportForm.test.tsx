import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FloodReportForm from "./FloodReportForm";
import { extractExifGps } from "@/lib/exif-gps";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/exif-gps", () => ({
  extractExifGps: vi.fn(),
}));

vi.mock("@/lib/photo", () => ({
  compressPhoto: vi.fn(),
  uploadMedia: vi.fn(),
}));

vi.mock("@/lib/flood-queries", () => ({
  insertFloodReport: vi.fn(),
}));

function selectPhoto() {
  const input = document.querySelector<HTMLInputElement>("#flood-media");
  expect(input).not.toBeNull();
  const file = new File([new Uint8Array([0xff, 0xd8])], "flood.jpg", {
    type: "image/jpeg",
  });
  fireEvent.change(input!, { target: { files: [file] } });
}

function selectVideo() {
  const input = document.querySelector<HTMLInputElement>("#flood-media");
  expect(input).not.toBeNull();
  const file = new File([new Uint8Array(100)], "flood.mp4", {
    type: "video/mp4",
  });
  fireEvent.change(input!, { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(extractExifGps).mockResolvedValue(null);

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("FloodReportForm location", () => {
  it("auto-populates location from EXIF GPS and shows exif label", async () => {
    vi.mocked(extractExifGps).mockResolvedValue({
      lat: 16.5,
      lng: 120.75,
      takenAt: new Date("2024-06-15T10:30:00"),
    });
    render(<FloodReportForm />);

    selectPhoto();

    await waitFor(() => {
      expect(screen.getByText("FloodWatch.locationExif")).toBeInTheDocument();
    });
    expect(screen.getByText("16.5000, 120.7500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeEnabled();
  });

  it("shows manual location prompt when photo has no EXIF GPS", async () => {
    vi.mocked(extractExifGps).mockResolvedValue(null);
    render(<FloodReportForm />);

    selectPhoto();

    await waitFor(() => {
      expect(screen.getByText("FloodWatch.locationPrompt")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeDisabled();
  });

  it("shows manual location prompt for video files", async () => {
    render(<FloodReportForm />);

    selectVideo();

    await waitFor(() => {
      expect(screen.getByText("FloodWatch.locationPrompt")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeDisabled();
  });

  it("does not call navigator.geolocation", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<FloodReportForm />);
    selectPhoto();

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("auto-fills event date from EXIF timestamp", async () => {
    vi.mocked(extractExifGps).mockResolvedValue({
      lat: 16.5,
      lng: 120.75,
      takenAt: new Date("2024-06-15T10:30:00"),
    });
    render(<FloodReportForm />);

    selectPhoto();

    await waitFor(() => {
      const dateInput = document.querySelector<HTMLInputElement>("#flood-date");
      expect(dateInput?.value).toBe("2024-06-15");
    });
  });
});

describe("FloodReportForm validation", () => {
  it("disables submit when event date is cleared", async () => {
    vi.mocked(extractExifGps).mockResolvedValue({
      lat: 16.5,
      lng: 120.75,
      takenAt: null,
    });
    render(<FloodReportForm />);

    selectPhoto();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeEnabled();
    });

    const dateInput = document.querySelector<HTMLInputElement>("#flood-date")!;
    fireEvent.change(dateInput, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeDisabled();
  });
});
