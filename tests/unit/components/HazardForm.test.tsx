import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import HazardForm from "@/components/HazardForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return key;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@/lib/queries", () => ({
  getActiveEvent: vi.fn().mockResolvedValue({ id: "event-1" }),
  insertHazard: vi.fn().mockResolvedValue(undefined),
}));

describe("HazardForm", () => {
  it("renders hazard type dropdown and description field", () => {
    render(<HazardForm />);
    expect(screen.getByLabelText("HazardForm.hazardType")).toBeInTheDocument();
    expect(screen.getByLabelText("HazardForm.description")).toBeInTheDocument();
  });

  it("renders reported by field", () => {
    render(<HazardForm />);
    expect(screen.getByLabelText("HazardForm.reportedBy")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<HazardForm />);
    expect(screen.getByRole("button", { name: "HazardForm.submit" })).toBeInTheDocument();
  });
});
