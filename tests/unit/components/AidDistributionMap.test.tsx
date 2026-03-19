import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AidDistributionMap from "@/components/AidDistributionMap";

// Mock the lazy-loaded DeploymentMap
vi.mock("@/components/maps/DeploymentMap", () => ({
  default: ({ points }: { points: unknown[] }) => (
    <div data-testid="deployment-map">{points.length} points</div>
  ),
}));

// Mock MapSkeleton
vi.mock("@/components/maps/MapSkeleton", () => ({
  default: () => <div data-testid="map-skeleton">Loading map…</div>,
}));

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockPoints = [
  {
    lat: 16.62,
    lng: 120.35,
    quantity: 100,
    unit: "kg",
    orgName: "Test Org",
    categoryName: "Food",
  },
];

const mockBarangays = [
  { name: "Barangay 1", municipality: "San Fernando", beneficiaries: 500 },
];

describe("AidDistributionMap", () => {
  it("renders the map when deployment points exist", async () => {
    render(
      <AidDistributionMap
        barangays={mockBarangays}
        deploymentPoints={mockPoints}
      />,
    );
    expect(
      await screen.findByTestId("deployment-map"),
    ).toBeInTheDocument();
  });

  it("renders no-data placeholder when no deployment points", () => {
    render(
      <AidDistributionMap barangays={mockBarangays} deploymentPoints={[]} />,
    );
    expect(screen.getByText("Dashboard.noDeploymentData")).toBeInTheDocument();
  });

  it("renders barangay list", () => {
    render(
      <AidDistributionMap
        barangays={mockBarangays}
        deploymentPoints={mockPoints}
      />,
    );
    expect(screen.getByText(/Barangay 1/)).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });
});
