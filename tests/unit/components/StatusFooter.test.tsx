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

  it("renders event name when provided", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<StatusFooter eventName="Typhoon Emong" />);
    expect(screen.getByText("Typhoon Emong")).toBeInTheDocument();
  });

  it("renders updatedAt timestamp when provided", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const date = new Date("2026-04-06T12:51:00Z");
    render(<StatusFooter updatedAt={date} />);
    // Should show formatted timestamp instead of current time
    expect(screen.getByText(/Dashboard\.lastUpdated/)).toBeInTheDocument();
  });

  it("renders without optional props", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<StatusFooter />);
    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
    expect(screen.getByText(/Dashboard\.lastUpdated/)).toBeInTheDocument();
  });
});
