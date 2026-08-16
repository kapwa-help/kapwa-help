import type { PropsWithChildren } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FloodWatchMap from "./FloodWatchMap";
import type { FloodReport } from "@/lib/flood-queries";

const mocks = vi.hoisted(() => {
  const bounds = {
    getCenter: vi.fn(() => ({ lat: 35.2087, lng: -97.4696 })),
    isValid: vi.fn(() => true),
  };

  return {
    bounds,
    fitBounds: vi.fn(),
    latLngBounds: vi.fn(() => bounds),
    setView: vi.fn(),
  };
});

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    latLngBounds: mocks.latLngBounds,
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Marker: ({ children }: PropsWithChildren) => <>{children}</>,
  TileLayer: () => null,
  Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
  ZoomControl: () => null,
  useMap: () => ({ fitBounds: mocks.fitBounds, setView: mocks.setView }),
}));

function report(id: string, lat: number, lng: number): FloodReport {
  return {
    id,
    photoUrl: "https://example.com/photo.jpg",
    lat,
    lng,
    weatherEvent: null,
    description: null,
    status: "approved",
    eventDate: null,
    photoTakenAt: null,
    createdAt: "2026-08-15T22:14:23.17426+00:00",
    reporterName: null,
    reporterPhone: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FloodWatchMap viewport", () => {
  it("fits the viewport around multiple approved reports", async () => {
    const reports = [
      report("one", 35.2087, -97.4696),
      report("two", 35.2088, -97.4695),
    ];

    render(<FloodWatchMap reports={reports} onSelect={() => {}} />);

    await waitFor(() => {
      expect(mocks.latLngBounds).toHaveBeenCalledWith([
        [35.2087, -97.4696],
        [35.2088, -97.4695],
      ]);
      expect(mocks.fitBounds).toHaveBeenCalledWith(mocks.bounds, {
        padding: [40, 40],
        maxZoom: 13,
      });
    });
    expect(mocks.setView).not.toHaveBeenCalled();
  });

  it("centers on a single approved report", async () => {
    render(
      <FloodWatchMap
        reports={[report("one", 35.2087, -97.4696)]}
        onSelect={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mocks.setView).toHaveBeenCalledWith(mocks.bounds.getCenter(), 13);
    });
    expect(mocks.fitBounds).not.toHaveBeenCalled();
  });

  it("keeps the La Union default when there are no approved reports", () => {
    render(<FloodWatchMap reports={[]} onSelect={() => {}} />);

    expect(mocks.latLngBounds).not.toHaveBeenCalled();
    expect(mocks.fitBounds).not.toHaveBeenCalled();
    expect(mocks.setView).not.toHaveBeenCalled();
  });
});
