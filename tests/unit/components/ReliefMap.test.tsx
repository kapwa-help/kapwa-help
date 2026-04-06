import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@/components/maps/ReliefMapLeaflet", () => ({
  default: () => <div data-testid="relief-map-leaflet" />,
}));

vi.mock("@/lib/lazy-reload", () => ({
  lazyWithReload: (factory: () => Promise<unknown>) => {
    const LazyComponent = (props: Record<string, unknown>) => {
      const Component = vi.fn(() => <div data-testid="relief-map-leaflet" />);
      return <Component {...props} />;
    };
    LazyComponent._factory = factory;
    return LazyComponent;
  },
}));

vi.mock("@/lib/queries", () => ({
  updateSubmissionStatus: vi.fn(),
  updateDeploymentStatus: vi.fn(),
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
    notes: null,
    contactName: "Maria",
    barangayName: "Urbiztondo",
    municipality: "San Juan",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "2",
    lat: 16.73,
    lng: 120.35,
    status: "in_transit",
    aidCategoryId: "cat-2",
    aidCategoryName: "Medical",
    aidCategoryIcon: "🏥",
    accessStatus: "boat",
    urgency: "critical",
    quantityNeeded: 50,
    numAdults: 30,
    numChildren: 10,
    numSeniorsPwd: 5,
    notes: null,
    contactName: "Jose",
    barangayName: "Bacnotan",
    municipality: "Bacnotan",
    createdAt: "2026-04-01T12:00:00Z",
  },
];

const mockHubs = [
  {
    id: "hub-1",
    name: "DSWD",
    municipality: "San Fernando",
    lat: 16.6159,
    lng: 120.3209,
    inventory: [],
  },
  {
    id: "hub-2",
    name: "Red Cross",
    municipality: "San Juan",
    lat: 16.6833,
    lng: 120.3667,
    inventory: [],
  },
  {
    id: "hub-3",
    name: "KapwaRelief",
    municipality: "Bauang",
    lat: 16.5500,
    lng: 120.3833,
    inventory: [],
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

describe("ReliefMap", () => {
  it("renders summary bar with correct counts", async () => {
    const { default: ReliefMap } = await import("@/components/ReliefMap");
    render(
      <ReliefMap
        needsPoints={mockNeeds}
        hubs={mockHubs}
        hazards={mockHazards}
      />
    );
    // Active = verified + in_transit = 2
    expect(
      screen.getByText(/2 ReliefMap.activeNeeds/)
    ).toBeInTheDocument();
    expect(screen.getByText(/3 ReliefMap.hubs/)).toBeInTheDocument();
    expect(screen.getByText(/1 ReliefMap.hazards/)).toBeInTheDocument();
  });

  it("renders legend with all layers checked", async () => {
    const { default: ReliefMap } = await import("@/components/ReliefMap");
    render(
      <ReliefMap needsPoints={[]} hubs={[]} hazards={[]} />
    );
    expect(screen.getByLabelText("ReliefMap.layerNeeds")).toBeChecked();
  });
});
