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

const mockNeeds = [
  {
    id: "1",
    lat: 16.67,
    lng: 120.32,
    status: "verified",
    aidCategoryId: "cat-1",
    aidCategoryName: "Hot Meals",
    aidCategoryIcon: "🍲",
    accessStatus: "truck",
    urgency: "high",
    quantityNeeded: 80,
    numAdults: 15,
    numChildren: 8,
    numSeniorsPwd: 2,
    notes: "Food needed",
    contactName: "Maria Santos",
    barangayName: "Urbiztondo",
    municipality: "San Juan",
    createdAt: "2026-04-01T10:00:00Z",
  },
];

const mockHubs = [
  {
    id: "hub-1",
    name: "DSWD La Union",
    municipality: "San Fernando",
    lat: 16.6159,
    lng: 120.3209,
    inventory: [{ categoryName: "Hot Meals", categoryIcon: "🍲", available: 70 }],
  },
];

const mockHazards = [
  {
    id: "haz-1",
    hazardType: "flood",
    description: "Deep flood",
    photoUrl: null,
    lat: 16.63,
    lng: 120.34,
    status: "active",
    reportedBy: null,
    createdAt: "2026-04-01T10:00:00Z",
  },
];

describe("ReliefMapLeaflet", () => {
  it("renders markers for all three layers", async () => {
    const { default: ReliefMapLeaflet } = await import(
      "@/components/maps/ReliefMapLeaflet"
    );
    render(
      <ReliefMapLeaflet
        needsPoints={mockNeeds}
        hubs={mockHubs}
        hazards={mockHazards}
        visibleLayers={{ needs: true, hubs: true, hazards: true }}
        onNeedSelect={vi.fn()}
        onHubSelect={vi.fn()}
        onHazardSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId("map")).toBeInTheDocument();
    // 1 need + 1 hub + 1 hazard = 3 markers
    expect(screen.getAllByTestId("marker")).toHaveLength(3);
  });

  it("hides markers when layer is toggled off", async () => {
    const { default: ReliefMapLeaflet } = await import(
      "@/components/maps/ReliefMapLeaflet"
    );
    render(
      <ReliefMapLeaflet
        needsPoints={mockNeeds}
        hubs={mockHubs}
        hazards={mockHazards}
        visibleLayers={{ needs: false, hubs: false, hazards: false }}
        onNeedSelect={vi.fn()}
        onHubSelect={vi.fn()}
        onHazardSelect={vi.fn()}
      />
    );
    expect(screen.queryAllByTestId("marker")).toHaveLength(0);
  });

  it("calls onHubSelect when hub marker is clicked", async () => {
    const { default: ReliefMapLeaflet } = await import(
      "@/components/maps/ReliefMapLeaflet"
    );
    const onHubSelect = vi.fn();
    render(
      <ReliefMapLeaflet
        needsPoints={[]}
        hubs={mockHubs}
        hazards={[]}
        visibleLayers={{ needs: true, hubs: true, hazards: true }}
        onNeedSelect={vi.fn()}
        onHubSelect={onHubSelect}
        onHazardSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("marker"));
    expect(onHubSelect).toHaveBeenCalledWith(mockHubs[0]);
  });
});
