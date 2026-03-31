import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NeedsPage } from "@/pages/NeedsPage";

// Mock cache module
vi.mock("@/lib/cache", () => ({
  getCachedNeeds: vi.fn(),
  setCachedNeeds: vi.fn(),
}));

// Mock queries module
vi.mock("@/lib/queries", () => ({
  getNeedsMapPoints: vi.fn(),
  getNeedsSummary: vi.fn(),
  getActiveEvent: vi.fn(),
}));

vi.mock("@/components/maps/NeedsMap", () => ({
  default: () => <div data-testid="needs-map" />,
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Mock outbox-context (Header uses useOutbox)
vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

// Mock react-router (Header uses useParams/useNavigate/useLocation/Link)
vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/en", search: "", hash: "", state: null, key: "default" }),
  Link: ({ children, ...props }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>{children}</a>
  ),
}));

import {
  getNeedsMapPoints,
  getNeedsSummary,
  getActiveEvent,
} from "@/lib/queries";
import { getCachedNeeds, setCachedNeeds } from "@/lib/cache";

const emptyNeedsSummary = {
  total: 0,
  byStatus: { pending: 0, verified: 0, in_transit: 0, completed: 0, resolved: 0 },
  byGap: { lunas: 0, sustenance: 0, shelter: 0 },
  byAccess: { truck: 0, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
  critical: 0,
};

const mockQueries = () => {
  vi.mocked(getNeedsMapPoints).mockResolvedValue([]);
  vi.mocked(getNeedsSummary).mockResolvedValue(emptyNeedsSummary);
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
    expect(screen.getByText("Dashboard.loading")).toBeInTheDocument();
  });

  it("renders hero and needs components after data loads", async () => {
    vi.mocked(getNeedsSummary).mockResolvedValue({
      ...emptyNeedsSummary,
      total: 5,
      byStatus: { pending: 3, verified: 2, in_transit: 1, completed: 0, resolved: 0 },
    });

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    // Hero elements
    expect(screen.getByText("Dashboard.subtitle")).toBeInTheDocument();

    // NeedsSummaryCards rendered (verified count = 2)
    expect(screen.getByText("2")).toBeInTheDocument();
    // NeedsSummaryCards labels
    expect(screen.getByText("Dashboard.activeNeeds")).toBeInTheDocument();
    expect(screen.getByText("Dashboard.inTransit")).toBeInTheDocument();

    // NeedsCoordinationMap rendered (map heading + legend)
    expect(screen.getByText("Dashboard.needsMap")).toBeInTheDocument();
    expect(screen.getByText("Dashboard.pinStatus")).toBeInTheDocument();

    // StatusFooter
    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
  });

  it("only calls needs-related queries (not relief queries)", async () => {
    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    // Needs queries called
    expect(getNeedsMapPoints).toHaveBeenCalled();
    expect(getNeedsSummary).toHaveBeenCalled();
    expect(getActiveEvent).toHaveBeenCalled();

    // No relief queries should exist in the mock — the module mock only defines needs queries
    // This verifies the page doesn't import or call relief-related functions
  });

  it("renders error state with retry button on fetch failure", async () => {
    vi.mocked(getNeedsMapPoints).mockRejectedValue(new Error("Network error"));

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.loadError")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Dashboard.retry" })).toBeInTheDocument();
  });

  it("shows cached data when cache exists", async () => {
    // Queries will never resolve — only cached data should render
    vi.mocked(getNeedsMapPoints).mockReturnValue(new Promise(() => {}));
    vi.mocked(getNeedsSummary).mockReturnValue(new Promise(() => {}));
    vi.mocked(getActiveEvent).mockReturnValue(new Promise(() => {}));

    vi.mocked(getCachedNeeds).mockResolvedValue({
      data: {
        activeEvent: null,
        needsPoints: [],
        needsSummary: {
          ...emptyNeedsSummary,
          byStatus: { pending: 0, verified: 7, in_transit: 3, completed: 2, resolved: 0 },
          critical: 4,
        },
      },
      updatedAt: Date.now(),
    });

    render(<NeedsPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.hero")).toBeInTheDocument();
    });

    // Cached summary values rendered (verified=7, critical=4)
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    // Last updated timestamp shown
    expect(screen.getAllByText(/Dashboard.lastUpdated/).length).toBeGreaterThan(0);
  });

  it("shows cached data when fetch fails but cache exists", async () => {
    vi.mocked(getCachedNeeds).mockResolvedValue({
      data: {
        activeEvent: null,
        needsPoints: [],
        needsSummary: {
          ...emptyNeedsSummary,
          byStatus: { pending: 0, verified: 5, in_transit: 0, completed: 0, resolved: 0 },
          critical: 3,
        },
      },
      updatedAt: Date.now(),
    });

    const networkError = new Error("Network error");
    vi.mocked(getNeedsMapPoints).mockRejectedValue(networkError);
    vi.mocked(getNeedsSummary).mockRejectedValue(networkError);
    vi.mocked(getActiveEvent).mockRejectedValue(networkError);

    render(<NeedsPage />);

    // Should show cached data, not error state
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    expect(screen.queryByText("Dashboard.loadError")).not.toBeInTheDocument();
  });
});
