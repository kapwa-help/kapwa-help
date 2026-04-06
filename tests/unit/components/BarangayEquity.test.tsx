import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BarangayEquity from "@/components/BarangayEquity";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const mockDistribution = [
  {
    id: "b1",
    name: "San Fernando",
    municipality: "San Fernando",
    lat: 16.62,
    lng: 120.32,
    categories: [{ name: "Hot Meals", icon: "🍲", total: 100 }],
    totalQuantity: 150,
    deployments: [],
  },
];

describe("BarangayEquity", () => {
  it("renders a row per barangay with total received", () => {
    render(<BarangayEquity distribution={mockDistribution} />);
    expect(screen.getAllByText("San Fernando").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("renders nothing when distribution is empty", () => {
    const { container } = render(<BarangayEquity distribution={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
