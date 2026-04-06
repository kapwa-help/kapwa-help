import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  ZoomControl: () => null,
  Marker: ({
    children,
    eventHandlers,
  }: {
    children?: React.ReactNode;
    eventHandlers?: { click?: () => void };
  }) => (
    <div data-testid="marker" onClick={eventHandlers?.click}>
      {children}
    </div>
  ),
}));
vi.mock("leaflet", () => ({
  default: { divIcon: vi.fn(() => ({})) },
  divIcon: vi.fn(() => ({})),
}));

const mockPoints = [
  {
    id: "1",
    lat: 16.67,
    lng: 120.32,
    status: "verified",
    gapCategory: "sustenance",
    accessStatus: "truck",
    urgency: "high",
    quantityNeeded: 80,
    notes: "Food needed",
    contactName: "Maria Santos",
    barangayName: "Urbiztondo",
    municipality: "San Juan",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "2",
    lat: 16.73,
    lng: 120.35,
    status: "in_transit",
    gapCategory: "lunas",
    accessStatus: "boat",
    urgency: "critical",
    quantityNeeded: 50,
    notes: "Medical supplies",
    contactName: "Jose Reyes",
    barangayName: "Bacnotan Proper",
    municipality: "Bacnotan",
    createdAt: "2026-04-01T12:00:00Z",
  },
];

describe("NeedsMap", () => {
  it("renders markers for each need point", async () => {
    const { default: NeedsMap } = await import("@/components/maps/NeedsMap");
    render(<NeedsMap points={mockPoints} onPinSelect={vi.fn()} />);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("calls onPinSelect when a marker is clicked", async () => {
    const { default: NeedsMap } = await import("@/components/maps/NeedsMap");
    const onPinSelect = vi.fn();
    render(<NeedsMap points={mockPoints} onPinSelect={onPinSelect} />);
    fireEvent.click(screen.getAllByTestId("marker")[0]);
    expect(onPinSelect).toHaveBeenCalledWith(mockPoints[0]);
  });

  it("does not render popups", async () => {
    const { default: NeedsMap } = await import("@/components/maps/NeedsMap");
    render(<NeedsMap points={mockPoints} onPinSelect={vi.fn()} />);
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });
});
