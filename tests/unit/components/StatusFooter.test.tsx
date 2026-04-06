import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusFooter from "@/components/StatusFooter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

describe("StatusFooter", () => {
  it("renders online status and timestamp", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<StatusFooter />);
    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
    expect(screen.getByText(/Dashboard\.lastUpdated/)).toBeInTheDocument();
  });

  it("renders offline status when browser is offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<StatusFooter />);
    expect(screen.getByText("Dashboard.offline")).toBeInTheDocument();
  });
});
