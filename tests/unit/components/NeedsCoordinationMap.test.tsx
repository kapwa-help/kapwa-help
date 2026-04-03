import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let capturedOnPinSelect: ((point: any) => void) | null = null;

vi.mock("@/components/maps/NeedsMap", () => ({
  default: ({ onPinSelect }: { onPinSelect: (point: any) => void }) => {
    capturedOnPinSelect = onPinSelect;
    return <div data-testid="needs-map" />;
  },
}));
vi.mock("@/components/PinDetailSheet", () => ({
  default: ({ point, onClose, variant }: { point: any; onClose: () => void; variant?: string }) => (
    <div data-testid={variant === "panel" ? "pin-detail-panel" : "pin-detail-sheet"}>
      <span>{point.barangayName}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
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
    createdAt: "2026-04-01T10:00:00Z",
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
    createdAt: "2026-04-01T12:00:00Z",
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

  it("renders PinDetailSheet when a point is selected and hides on close", async () => {
    capturedOnPinSelect = null;
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    await screen.findByTestId("needs-map");

    // Sheet should not be visible initially
    expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();

    // Simulate pin click via captured callback
    expect(capturedOnPinSelect).not.toBeNull();
    act(() => {
      capturedOnPinSelect!(mockPoints[0]);
    });

    // Sheet should now be visible with correct content
    const sheet = screen.getByTestId("pin-detail-sheet");
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveTextContent("Urbiztondo");

    // Close the sheet via the mobile sheet's close button
    const closeButton = within(sheet).getByText("close");
    fireEvent.click(closeButton);
    expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();
  });
});
