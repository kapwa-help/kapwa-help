import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardPage } from "@/pages/DashboardPage";

// Mock cache module
vi.mock("@/lib/cache", () => ({
  getCachedDashboard: vi.fn(),
  setCachedDashboard: vi.fn(),
}));

// Mock queries module
vi.mock("@/lib/queries", () => ({
  getTotalDonations: vi.fn(),
  getTotalBeneficiaries: vi.fn(),
  getVolunteerCount: vi.fn(),
  getDonationsByOrganization: vi.fn(),
  getDeploymentHubs: vi.fn(),
  getGoodsByCategory: vi.fn(),
  getBeneficiariesByBarangay: vi.fn(),
  getDeploymentMapPoints: vi.fn(),
  getNeedsMapPoints: vi.fn(),
  getNeedsSummary: vi.fn(),
  getActiveEvent: vi.fn(),
}));

vi.mock("@/components/maps/DeploymentMap", () => ({
  default: () => <div data-testid="deployment-map" />,
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
  getTotalDonations,
  getTotalBeneficiaries,
  getVolunteerCount,
  getDonationsByOrganization,
  getDeploymentHubs,
  getGoodsByCategory,
  getBeneficiariesByBarangay,
  getDeploymentMapPoints,
  getNeedsMapPoints,
  getNeedsSummary,
  getActiveEvent,
} from "@/lib/queries";
import { getCachedDashboard, setCachedDashboard } from "@/lib/cache";

const emptyNeedsSummary = {
  total: 0,
  byStatus: { pending: 0, verified: 0, in_transit: 0, completed: 0, resolved: 0 },
  byGap: { lunas: 0, sustenance: 0, shelter: 0 },
  byAccess: { truck: 0, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
  critical: 0,
};

const mockQueries = () => {
  vi.mocked(getTotalDonations).mockResolvedValue(500000);
  vi.mocked(getTotalBeneficiaries).mockResolvedValue(1200);
  vi.mocked(getVolunteerCount).mockResolvedValue(50);
  vi.mocked(getDonationsByOrganization).mockResolvedValue([
    { name: "Red Cross", amount: 300000 },
    { name: "LGU", amount: 200000 },
  ]);
  vi.mocked(getDeploymentHubs).mockResolvedValue([
    { name: "Hub A", municipality: "San Fernando", count: 5 },
  ]);
  vi.mocked(getGoodsByCategory).mockResolvedValue([
    { name: "Meals", icon: null, total: 800 },
  ]);
  vi.mocked(getBeneficiariesByBarangay).mockResolvedValue([
    { name: "Catbangen", municipality: "San Fernando", beneficiaries: 400 },
  ]);
  vi.mocked(getDeploymentMapPoints).mockResolvedValue([
    { lat: 16.62, lng: 120.35, quantity: 200, unit: "meals", orgName: "Red Cross", categoryName: "Meals" },
  ]);
  vi.mocked(getNeedsMapPoints).mockResolvedValue([]);
  vi.mocked(getNeedsSummary).mockResolvedValue(emptyNeedsSummary);
  vi.mocked(getActiveEvent).mockResolvedValue(null);
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
    vi.mocked(getCachedDashboard).mockResolvedValue(null);
    vi.mocked(setCachedDashboard).mockResolvedValue(undefined);
  });

  it("shows loading state initially", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard.loading")).toBeInTheDocument();
  });

  it("renders dashboard components after data loads", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("₱500,000")).toBeInTheDocument();
    });

    // SummaryCards
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    // DonationsByOrg
    expect(screen.getByText("Red Cross")).toBeInTheDocument();
    expect(screen.getByText("LGU")).toBeInTheDocument();

    // DeploymentHubs
    expect(screen.getByText("Hub A")).toBeInTheDocument();

    // GoodsByCategory
    expect(screen.getByText("Meals")).toBeInTheDocument();

    // AidDistributionMap (barangays)
    expect(screen.getByText(/Catbangen/)).toBeInTheDocument();

    // StatusFooter
    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
  });

  it("renders error state with retry button on fetch failure", async () => {
    vi.mocked(getTotalDonations).mockRejectedValue(new Error("Network error"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.loadError")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Dashboard.retry" })).toBeInTheDocument();
  });

  it("renders cached data immediately when cache exists", async () => {
    vi.mocked(getCachedDashboard).mockResolvedValue({
      data: {
        totalDonations: 500000,
        totalBeneficiaries: 1200,
        volunteerCount: 50,
        donationsByOrg: [
          { name: "Red Cross", amount: 300000 },
          { name: "LGU", amount: 200000 },
        ],
        deploymentHubs: [
          { name: "Hub A", municipality: "San Fernando", count: 5 },
        ],
        goodsByCategory: [{ name: "Meals", icon: null, total: 800 }],
        barangays: [
          { name: "Catbangen", municipality: "San Fernando", beneficiaries: 400 },
        ],
        deploymentPoints: [
          { lat: 16.62, lng: 120.35, quantity: 200, unit: "meals", orgName: "Red Cross", categoryName: "Meals" },
        ],
        activeEvent: null,
        needsPoints: [],
        needsSummary: emptyNeedsSummary,
      },
      updatedAt: Date.now(),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("₱500,000")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Dashboard.lastUpdated/).length).toBeGreaterThan(0);
  });

  it("shows cached data when fetch fails but cache exists", async () => {
    vi.mocked(getCachedDashboard).mockResolvedValue({
      data: {
        totalDonations: 500000,
        totalBeneficiaries: 1200,
        volunteerCount: 50,
        donationsByOrg: [{ name: "Red Cross", amount: 300000 }],
        deploymentHubs: [
          { name: "Hub A", municipality: "San Fernando", count: 5 },
        ],
        goodsByCategory: [{ name: "Meals", icon: null, total: 800 }],
        barangays: [
          { name: "Catbangen", municipality: "San Fernando", beneficiaries: 400 },
        ],
        deploymentPoints: [],
        activeEvent: null,
        needsPoints: [],
        needsSummary: emptyNeedsSummary,
      },
      updatedAt: Date.now(),
    });

    // All queries fail
    const networkError = new Error("Network error");
    vi.mocked(getTotalDonations).mockRejectedValue(networkError);
    vi.mocked(getTotalBeneficiaries).mockRejectedValue(networkError);
    vi.mocked(getVolunteerCount).mockRejectedValue(networkError);
    vi.mocked(getDonationsByOrganization).mockRejectedValue(networkError);
    vi.mocked(getDeploymentHubs).mockRejectedValue(networkError);
    vi.mocked(getGoodsByCategory).mockRejectedValue(networkError);
    vi.mocked(getBeneficiariesByBarangay).mockRejectedValue(networkError);
    vi.mocked(getDeploymentMapPoints).mockRejectedValue(networkError);

    render(<DashboardPage />);

    // Should show cached data, not error state
    await waitFor(() => {
      expect(screen.getByText("₱500,000")).toBeInTheDocument();
    });

    expect(screen.queryByText("Dashboard.loadError")).not.toBeInTheDocument();
  });

  it("shows error state when both cache and fetch fail", async () => {
    vi.mocked(getCachedDashboard).mockResolvedValue(null);
    vi.mocked(getTotalDonations).mockRejectedValue(new Error("Network error"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.loadError")).toBeInTheDocument();
    });
  });
});
