import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NeedsPage } from "@/pages/NeedsPage";

vi.mock("@/lib/cache", () => ({
  getCachedNeeds: vi.fn(),
  setCachedNeeds: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  getNeedsMapPoints: vi.fn(),
  getActiveEvent: vi.fn(),
}));

vi.mock("@/components/maps/NeedsMap", () => ({
  default: () => <div data-testid="needs-map" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/en", search: "", hash: "", state: null, key: "default" }),
  Link: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>{children}</a>
  ),
  NavLink: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string | Function }) => (
    <a href={props.to} className={typeof props.className === "function" ? "" : props.className}>{children}</a>
  ),
}));

import { getNeedsMapPoints, getActiveEvent } from "@/lib/queries";
import { getCachedNeeds, setCachedNeeds } from "@/lib/cache";

const mockQueries = () => {
  vi.mocked(getNeedsMapPoints).mockResolvedValue([]);
  vi.mocked(getActiveEvent).mockResolvedValue(null);
};

describe("NeedsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
    vi.mocked(getCachedNeeds).mockResolvedValue(null);
    vi.mocked(setCachedNeeds).mockResolvedValue(undefined);
  });

  it("shows loading state initially", () => {
    render(<NeedsPage />);
    expect(screen.getByText("App.loading")).toBeInTheDocument();
  });

  it("renders map and footer after data loads", async () => {
    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
    });

    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
  });

  it("only calls needs-related queries", async () => {
    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
    });

    expect(getNeedsMapPoints).toHaveBeenCalled();
    expect(getActiveEvent).toHaveBeenCalled();
  });

  it("renders error state with retry button on fetch failure", async () => {
    vi.mocked(getNeedsMapPoints).mockRejectedValue(new Error("Network error"));

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("App.loadError")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "App.retry" })).toBeInTheDocument();
  });

  it("shows cached data when cache exists", async () => {
    vi.mocked(getNeedsMapPoints).mockReturnValue(new Promise(() => {}));
    vi.mocked(getActiveEvent).mockReturnValue(new Promise(() => {}));

    vi.mocked(getCachedNeeds).mockResolvedValue({
      data: {
        activeEvent: null,
        needsPoints: [],
      },
      updatedAt: Date.now(),
    });

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
    });
  });

  it("shows cached data when fetch fails but cache exists", async () => {
    vi.mocked(getCachedNeeds).mockResolvedValue({
      data: {
        activeEvent: null,
        needsPoints: [
          {
            id: "1", lat: 16.67, lng: 120.32, status: "verified",
            gapCategory: "sustenance", accessStatus: "truck", urgency: "high",
            quantityNeeded: 80, notes: null, contactName: "Maria",
            barangayName: "Urbiztondo", municipality: "San Juan",
            createdAt: "2026-04-01T10:00:00Z",
          },
        ],
      },
      updatedAt: Date.now(),
    });

    const networkError = new Error("Network error");
    vi.mocked(getNeedsMapPoints).mockRejectedValue(networkError);
    vi.mocked(getActiveEvent).mockRejectedValue(networkError);

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
    });

    expect(screen.queryByText("App.loadError")).not.toBeInTheDocument();
  });
});
