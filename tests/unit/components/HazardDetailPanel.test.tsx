import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import HazardDetailPanel from "@/components/HazardDetailPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const mockHazard = {
  id: "h1",
  hazardType: "flood",
  description: "Flooded road near barangay center",
  photoUrl: null,
  lat: 16.63,
  lng: 120.34,
  status: "active",
  reportedBy: "Juan",
  createdAt: new Date().toISOString(),
};

describe("HazardDetailPanel", () => {
  it("renders hazard type and description", () => {
    render(<HazardDetailPanel hazard={mockHazard} onClose={vi.fn()} />);
    expect(screen.getByText("HazardDetail.flood")).toBeInTheDocument();
    expect(
      screen.getByText("Flooded road near barangay center")
    ).toBeInTheDocument();
  });

  it("renders reported by", () => {
    render(<HazardDetailPanel hazard={mockHazard} onClose={vi.fn()} />);
    expect(screen.getByText("Juan")).toBeInTheDocument();
  });
});
