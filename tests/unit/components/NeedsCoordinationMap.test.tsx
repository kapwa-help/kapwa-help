import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let capturedOnPinSelect: ((point: any) => void) | null = null;

vi.mock("@/components/maps/NeedsMap", () => ({
  default: ({ onPinSelect, points }: { onPinSelect: (point: any) => void; points: any[] }) => {
    capturedOnPinSelect = onPinSelect;
    return <div data-testid="needs-map" data-point-count={points.length} />;
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
    id: "1", lat: 16.67, lng: 120.32, status: "verified",
    gapCategory: "sustenance", accessStatus: "truck", urgency: "high",
    quantityNeeded: 80, notes: "Food needed", contactName: "Maria",
    barangayName: "Urbiztondo", municipality: "San Juan",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "2", lat: 16.73, lng: 120.35, status: "verified",
    gapCategory: "lunas", accessStatus: "boat", urgency: "critical",
    quantityNeeded: 50, notes: "Medical", contactName: "Jose",
    barangayName: "Bacnotan", municipality: "Bacnotan",
    createdAt: "2026-04-01T12:00:00Z",
  },
  {
    id: "3", lat: 16.66, lng: 120.33, status: "completed",
    gapCategory: "sustenance", accessStatus: "truck", urgency: "medium",
    quantityNeeded: 70, notes: "Delivered", contactName: "Elena",
    barangayName: "Poblacion", municipality: "San Juan",
    createdAt: "2026-04-01T08:00:00Z",
  },
  {
    id: "4", lat: 16.80, lng: 120.37, status: "pending",
    gapCategory: "sustenance", accessStatus: "cut_off", urgency: "critical",
    quantityNeeded: 45, notes: "Unverified", contactName: "Caller",
    barangayName: "Poblacion Luna", municipality: "Luna",
    createdAt: "2026-04-01T14:00:00Z",
  },
];

describe("NeedsCoordinationMap", () => {
  it("renders the map, legend with counts, and needs list", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);

    // Map renders
    expect(await screen.findByTestId("needs-map")).toBeInTheDocument();

    // Legend labels present (also appear as sr-only in sidebar items)
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
    expect(screen.getAllByText(/Dashboard.statusPending/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dashboard.statusVerified/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dashboard.statusInTransit/).length).toBeGreaterThan(0);
  });

  it("includes all points on the map", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    const map = await screen.findByTestId("needs-map");
    expect(map.getAttribute("data-point-count")).toBe("4");
  });

  it("sorts sidebar by status priority then urgency", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);

    const buttons = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.includes("sustenance") || btn.textContent?.includes("lunas")
    );

    // Expected order: pending-critical (Poblacion Luna), verified-critical (Bacnotan),
    // verified-high (Urbiztondo), completed-medium (Poblacion)
    const names = buttons.map((btn) => {
      const nameEl = btn.querySelector("p");
      return nameEl?.textContent;
    });
    expect(names).toEqual(["Poblacion Luna", "Bacnotan", "Urbiztondo", "Poblacion"]);
  });

  it("shows urgency badge on every list item", async () => {
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);

    // All 4 items should have an urgency badge
    expect(screen.getAllByText(/Dashboard\.urgency/)).toHaveLength(4);
  });

  it("renders PinDetailSheet when a point is selected and hides on close", async () => {
    capturedOnPinSelect = null;
    const { default: NeedsCoordinationMap } = await import(
      "@/components/NeedsCoordinationMap"
    );
    render(<NeedsCoordinationMap needsPoints={mockPoints} />);
    await screen.findByTestId("needs-map");

    expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();

    expect(capturedOnPinSelect).not.toBeNull();
    act(() => {
      capturedOnPinSelect!(mockPoints[0]);
    });

    const sheet = screen.getByTestId("pin-detail-sheet");
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveTextContent("Urbiztondo");

    const closeButton = within(sheet).getByText("close");
    fireEvent.click(closeButton);
    expect(screen.queryByTestId("pin-detail-sheet")).not.toBeInTheDocument();
  });
});
