import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/maps/NeedsMap", () => ({
  default: () => <div data-testid="needs-map" />,
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
    contactName: "Maria",
    barangayName: "Urbiztondo",
    municipality: "San Juan",
    categoryName: "Sustenance",
  },
  {
    id: "2",
    lat: 16.73,
    lng: 120.35,
    status: "verified",
    gapCategory: "lunas",
    accessStatus: "boat",
    urgency: "critical",
    quantityNeeded: 50,
    notes: "Medical",
    contactName: "Jose",
    barangayName: "Bacnotan",
    municipality: "Bacnotan",
    categoryName: "Lunas",
  },
];

describe("NeedsCoordinationMap", () => {
  it("renders the map and legend", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    expect(await screen.findByTestId("needs-map")).toBeInTheDocument();
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
  });
});
