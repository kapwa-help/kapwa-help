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
}));

vi.mock("@/components/maps/DeploymentMap", () => ({
  default: () => <div data-testid="deployment-map" />,
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Mock react-router (Header uses useParams/useNavigate/Link)
vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
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
} from "@/lib/queries";
import { getCachedDashboard, setCachedDashboard } from "@/lib/cache";

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
