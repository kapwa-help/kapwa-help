import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MapLegend from "@/components/MapLegend";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const defaultLayers = { needs: true, hubs: true, hazards: true };

describe("MapLegend", () => {
  it("renders three layer toggles, all checked by default", () => {
    render(<MapLegend layers={defaultLayers} onToggle={vi.fn()} />);
    expect(screen.getByLabelText("ReliefMap.layerNeeds")).toBeChecked();
    expect(screen.getByLabelText("ReliefMap.layerHubs")).toBeChecked();
    expect(screen.getByLabelText("ReliefMap.layerHazards")).toBeChecked();
  });

  it("calls onToggle when a layer is unchecked", () => {
    const onToggle = vi.fn();
    render(<MapLegend layers={defaultLayers} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText("ReliefMap.layerNeeds"));
    expect(onToggle).toHaveBeenCalledWith("needs");
  });

  it("shows needs status sub-legend", () => {
    render(<MapLegend layers={defaultLayers} onToggle={vi.fn()} />);
    expect(screen.getByText("ReliefMap.statusPending")).toBeInTheDocument();
    expect(screen.getByText("ReliefMap.statusVerified")).toBeInTheDocument();
  });
});
