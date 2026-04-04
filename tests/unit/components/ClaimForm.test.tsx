import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ClaimForm from "@/components/ClaimForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/queries", () => ({
  getOrganizations: vi.fn(),
  getAidCategories: vi.fn(),
  createDeploymentForNeed: vi.fn(),
  getActiveEvent: vi.fn(),
}));

const mockPoint = {
  id: "sub-1",
  lat: 16.67,
  lng: 120.32,
  status: "verified",
  gapCategory: "sustenance",
  accessStatus: "truck",
  urgency: "high",
  quantityNeeded: 80,
  notes: null,
  contactName: "Maria",
  barangayName: "Urbiztondo",
  municipality: "San Juan",
  createdAt: "2026-04-01T10:00:00Z",
};

describe("ClaimForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("renders respond button when collapsed", () => {
    render(
      <ClaimForm point={mockPoint} onClaimed={vi.fn()} />
    );
    expect(screen.getByText("ClaimForm.respondButton")).toBeInTheDocument();
  });

  it("expands form when respond button is clicked", async () => {
    const { getOrganizations, getAidCategories } = await import("@/lib/queries");
    vi.mocked(getOrganizations).mockResolvedValue([
      { id: "org-1", name: "DOERS", type: "hub", municipality: "Luna" },
    ]);
    vi.mocked(getAidCategories).mockResolvedValue([
      { id: "cat-1", name: "Meals", icon: "utensils" },
    ]);

    render(
      <ClaimForm point={mockPoint} onClaimed={vi.fn()} />
    );

    fireEvent.click(screen.getByText("ClaimForm.respondButton"));

    await waitFor(() => {
      expect(screen.getByText("ClaimForm.organization")).toBeInTheDocument();
      expect(screen.getByText("ClaimForm.aidCategory")).toBeInTheDocument();
    });
  });

  it("submits claim and calls onClaimed", async () => {
    const { getOrganizations, getAidCategories, createDeploymentForNeed, getActiveEvent } = await import("@/lib/queries");
    vi.mocked(getOrganizations).mockResolvedValue([
      { id: "org-1", name: "DOERS", type: "hub", municipality: "Luna" },
    ]);
    vi.mocked(getAidCategories).mockResolvedValue([
      { id: "cat-1", name: "Meals", icon: "utensils" },
    ]);
    vi.mocked(createDeploymentForNeed).mockResolvedValue(undefined);
    vi.mocked(getActiveEvent).mockResolvedValue({ id: "event-1", name: "Typhoon Emong", slug: "emong", description: null, region: "La Union", started_at: "2024-11-01" });

    const onClaimed = vi.fn();
    render(
      <ClaimForm point={mockPoint} onClaimed={onClaimed} />
    );

    // Open form
    fireEvent.click(screen.getByText("ClaimForm.respondButton"));

    await waitFor(() => {
      expect(screen.getByText("ClaimForm.organization")).toBeInTheDocument();
    });

    // Fill required fields
    fireEvent.change(screen.getByRole("combobox", { name: "ClaimForm.organization" }), {
      target: { value: "org-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "ClaimForm.aidCategory" }), {
      target: { value: "cat-1" },
    });

    // Submit
    fireEvent.click(screen.getByText("ClaimForm.submit"));

    await waitFor(() => {
      expect(createDeploymentForNeed).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
          aid_category_id: "cat-1",
          submission_id: "sub-1",
        })
      );
      expect(onClaimed).toHaveBeenCalled();
    });
  });
});
