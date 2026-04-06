import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import HubDetailPanel from "@/components/HubDetailPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const mockHub = {
  id: "hub-1",
  name: "DSWD La Union",
  municipality: "San Fernando",
  lat: 16.6159,
  lng: 120.3209,
  inventory: [
    { categoryName: "Hot Meals", categoryIcon: "🍲", available: 70 },
    { categoryName: "Medical Supplies", categoryIcon: "🏥", available: 20 },
  ],
};

describe("HubDetailPanel", () => {
  it("renders hub name and inventory items", () => {
    render(<HubDetailPanel hub={mockHub} onClose={vi.fn()} />);
    expect(screen.getByText("DSWD La Union")).toBeInTheDocument();
    expect(screen.getByText(/Hot Meals/)).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
  });

  it("renders municipality", () => {
    render(<HubDetailPanel hub={mockHub} onClose={vi.fn()} />);
    expect(screen.getByText("San Fernando")).toBeInTheDocument();
  });

  it("shows no inventory message when empty", () => {
    const emptyHub = { ...mockHub, inventory: [] };
    render(<HubDetailPanel hub={emptyHub} onClose={vi.fn()} />);
    expect(screen.getByText("HubDetail.noInventory")).toBeInTheDocument();
  });
});
