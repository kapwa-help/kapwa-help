import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PinDetailSheet from "@/components/PinDetailSheet";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/queries", () => ({
  updateSubmissionStatus: vi.fn(),
}));

const mockPoint = {
  id: "abc-123",
  lat: 16.67,
  lng: 120.32,
  status: "verified",
  gapCategory: "sustenance",
  accessStatus: "truck",
  urgency: "high",
  quantityNeeded: 80,
  notes: "Food needed urgently",
  contactName: "Maria Santos",
  barangayName: "Urbiztondo",
  municipality: "San Juan",
  createdAt: "2026-04-01T10:00:00Z",
};

describe("PinDetailSheet", () => {
  it("renders all submission details", () => {
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("Urbiztondo, San Juan")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Food needed urgently")).toBeInTheDocument();
  });

  it("shows forward transition buttons for verified status", () => {
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("PinDetail.markInTransit")).toBeInTheDocument();
    expect(screen.getByText("PinDetail.markCompleted")).toBeInTheDocument();
    expect(screen.getByText("PinDetail.markResolved")).toBeInTheDocument();
    // Should NOT show "Mark Verified" since already verified
    expect(screen.queryByText("PinDetail.markVerified")).not.toBeInTheDocument();
  });

  it("shows no transition buttons for resolved status", () => {
    render(
      <PinDetailSheet
        point={{ ...mockPoint, status: "resolved" }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("PinDetail.resolvedMessage")).toBeInTheDocument();
    expect(screen.queryByText("PinDetail.markVerified")).not.toBeInTheDocument();
    expect(screen.queryByText("PinDetail.markInTransit")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={onClose}
        onStatusChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("PinDetail.close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <PinDetailSheet
        point={mockPoint}
        onClose={onClose}
        onStatusChange={vi.fn()}
      />
    );

    // Backdrop is the first child (aria-hidden div before the dialog)
    const backdrop = container.querySelector("[aria-hidden='true']")!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onStatusChange on successful transition", async () => {
    const { updateSubmissionStatus } = await import("@/lib/queries");
    vi.mocked(updateSubmissionStatus).mockResolvedValue(undefined);

    const onStatusChange = vi.fn();
    render(
      <PinDetailSheet
        point={mockPoint}
        onClose={vi.fn()}
        onStatusChange={onStatusChange}
      />
    );

    fireEvent.click(screen.getByText("PinDetail.markInTransit"));

    // Wait for async mutation
    await vi.waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith("abc-123", "in_transit");
    });
  });
});
