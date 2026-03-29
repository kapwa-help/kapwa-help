import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSummary = {
  total: 10,
  byStatus: { pending: 2, verified: 4, in_transit: 2, completed: 2 },
  byGap: { lunas: 3, sustenance: 5, shelter: 2 },
  byAccess: { truck: 4, "4x4": 2, boat: 2, foot_only: 1, cut_off: 1 },
  critical: 3,
};

describe("NeedsSummaryCards", () => {
  it("renders need counts", async () => {
    const { default: NeedsSummaryCards } = await import(
      "@/components/NeedsSummaryCards"
    );
    render(<NeedsSummaryCards summary={mockSummary} />);
    expect(screen.getByText("4")).toBeInTheDocument(); // verified
    expect(screen.getByText("3")).toBeInTheDocument(); // critical
  });
});
