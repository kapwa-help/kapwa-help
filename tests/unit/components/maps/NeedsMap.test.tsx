import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
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
    categoryName: "Sustenance",
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
    categoryName: "Lunas",
  },
];

describe("NeedsMap", () => {
  it("renders markers for each need point", async () => {
    const { default: NeedsMap } = await import(
      "@/components/maps/NeedsMap"
    );
    render(<NeedsMap points={mockPoints} />);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("shows access status and urgency in popups", async () => {
    const { default: NeedsMap } = await import(
      "@/components/maps/NeedsMap"
    );
    render(<NeedsMap points={mockPoints} />);
    expect(screen.getByText("Food needed")).toBeInTheDocument();
    expect(screen.getByText("Medical supplies")).toBeInTheDocument();
  });
});
