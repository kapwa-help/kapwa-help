import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

let locationSuccess: SuccessCallback | undefined;
let locationError: ErrorCallback | undefined;

const getCurrentPosition = vi.fn(
  (success: SuccessCallback, error: ErrorCallback) => {
    locationSuccess = success;
    locationError = error;
  },
);

function position(lat: number, lng: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

function geolocationError(code: number): GeolocationPositionError {
  return {
    code,
    message: "test error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

function selectPhoto() {
  const input = document.querySelector<HTMLInputElement>("#flood-media");
  expect(input).not.toBeNull();
  const file = new File([new Uint8Array([0xff, 0xd8])], "flood.jpg", {
    type: "image/jpeg",
  });
  fireEvent.change(input!, { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  locationSuccess = undefined;
  locationError = undefined;
  vi.mocked(extractExifGps).mockResolvedValue(null);

  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("FloodReportForm geolocation", () => {
  it("requests device location as soon as the form opens", () => {
    render(
      <StrictMode>
        <FloodReportForm />
      </StrictMode>,
    );

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
    expect(screen.getByText("FloodWatch.locationAcquiring")).toBeInTheDocument();
  });

  it("waits for and prefers device location when EXIF resolves first", async () => {
    vi.mocked(extractExifGps).mockResolvedValue({
      lat: 16.5,
      lng: 120.75,
      takenAt: new Date("2024-06-15T10:30:00"),
    });
    render(<FloodReportForm />);

    selectPhoto();
    await waitFor(() => expect(extractExifGps).toHaveBeenCalled());

    expect(screen.getByText("FloodWatch.locationAcquiring")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeDisabled();

    act(() => locationSuccess?.(position(14.5995, 120.9842)));

    expect(screen.getByText("FloodWatch.locationBrowser")).toBeInTheDocument();
    expect(screen.getByText("14.5995, 120.9842")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeEnabled();
  });

  it("uses EXIF only after device location is unavailable", async () => {
    vi.mocked(extractExifGps).mockResolvedValue({
      lat: 16.5,
      lng: 120.75,
      takenAt: null,
    });
    render(<FloodReportForm />);

    act(() => locationError?.(geolocationError(2)));
    selectPhoto();

    await waitFor(() => {
      expect(screen.getByText("FloodWatch.locationExif")).toBeInTheDocument();
    });
    expect(screen.getByText("16.5000, 120.7500")).toBeInTheDocument();
    expect(screen.getByText("FloodWatch.locationUnavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FloodWatch.submit" })).toBeEnabled();
  });

  it("shows a permission-specific error and retries device location", () => {
    render(<FloodReportForm />);

    act(() => locationError?.(geolocationError(1)));

    expect(screen.getByText("FloodWatch.locationPermissionDenied")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "FloodWatch.locationRetry" }),
    );

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(screen.getByText("FloodWatch.locationAcquiring")).toBeInTheDocument();
  });
});
