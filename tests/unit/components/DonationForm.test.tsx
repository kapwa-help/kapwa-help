import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DonationForm from "@/components/DonationForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/queries", () => ({
  getOrganizations: vi.fn().mockResolvedValue([]),
  getAidCategories: vi.fn().mockResolvedValue([]),
  insertDonation: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DonationForm", () => {
  it("shows amount field for cash type by default", () => {
    render(<DonationForm />);
    expect(screen.getByLabelText("DonationForm.amount")).toBeInTheDocument();
  });

  it("shows category and quantity fields when in_kind is selected", () => {
    render(<DonationForm />);
    fireEvent.change(screen.getByLabelText("DonationForm.type"), {
      target: { value: "in_kind" },
    });
    expect(screen.getByLabelText("DonationForm.category")).toBeInTheDocument();
    expect(screen.getByLabelText("DonationForm.quantity")).toBeInTheDocument();
  });

  it("hides amount field when in_kind is selected", () => {
    render(<DonationForm />);
    fireEvent.change(screen.getByLabelText("DonationForm.type"), {
      target: { value: "in_kind" },
    });
    expect(screen.queryByLabelText("DonationForm.amount")).not.toBeInTheDocument();
  });

  it("hides category/quantity fields for cash type", () => {
    render(<DonationForm />);
    expect(screen.queryByLabelText("DonationForm.category")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("DonationForm.quantity")).not.toBeInTheDocument();
  });
});
