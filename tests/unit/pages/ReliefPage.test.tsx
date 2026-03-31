import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReliefPage } from "@/pages/ReliefPage";

// Mock cache module
vi.mock("@/lib/cache", () => ({
  getCachedRelief: vi.fn(),
  setCachedRelief: vi.fn(),
}));

// Mock queries module — only relief queries
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

// Mock DeploymentMap (lazy-loaded by AidDistributionMap)
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
} from "@/lib/queries";
import { getCachedRelief, setCachedRelief } from "@/lib/cache";

const mockQueries = () => {
  vi.mocked(getTotalDonations).mockResolvedValue(0);
  vi.mocked(getTotalBeneficiaries).mockResolvedValue(0);
  vi.mocked(getVolunteerCount).mockResolvedValue(0);
  vi.mocked(getDonationsByOrganization).mockResolvedValue([]);
  vi.mocked(getDeploymentHubs).mockResolvedValue([]);
  vi.mocked(getGoodsByCategory).mockResolvedValue([]);
  vi.mocked(getBeneficiariesByBarangay).mockResolvedValue([]);
  vi.mocked(getDeploymentMapPoints).mockResolvedValue([]);
};

describe("ReliefPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries();
    vi.mocked(getCachedRelief).mockResolvedValue(null);
    vi.mocked(setCachedRelief).mockResolvedValue(undefined);
  });

  it("shows loading state initially", () => {
    render(<ReliefPage />);
    expect(screen.getByText("Dashboard.loading")).toBeInTheDocument();
  });

  it("renders relief components after data loads", async () => {
    vi.mocked(getTotalDonations).mockResolvedValue(500000);
    vi.mocked(getTotalBeneficiaries).mockResolvedValue(1200);
    vi.mocked(getVolunteerCount).mockResolvedValue(85);
    vi.mocked(getDonationsByOrganization).mockResolvedValue([
      { name: "Red Cross", amount: 300000 },
      { name: "DSWD", amount: 200000 },
    ]);
    vi.mocked(getDeploymentHubs).mockResolvedValue([
      { name: "Hub A", municipality: "San Fernando", count: 10 },
    ]);
    vi.mocked(getGoodsByCategory).mockResolvedValue([
      { name: "Relief Goods", icon: null, total: 500 },
    ]);
    vi.mocked(getBeneficiariesByBarangay).mockResolvedValue([
      { name: "Brgy Uno", municipality: "San Fernando", beneficiaries: 400 },
    ]);

    render(<ReliefPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.reliefOperations")).toBeInTheDocument();
    });

    // SummaryCards values
    expect(screen.getByText("1,200")).toBeInTheDocument(); // totalBeneficiaries
    expect(screen.getByText("85")).toBeInTheDocument(); // volunteerCount
    expect(screen.getByText("Dashboard.totalDonations")).toBeInTheDocument();

    // DonationsByOrg
    expect(screen.getByText("Red Cross")).toBeInTheDocument();
    expect(screen.getByText("DSWD")).toBeInTheDocument();

    // DeploymentHubs
    expect(screen.getByText("Dashboard.deploymentHubs")).toBeInTheDocument();
    expect(screen.getByText("Hub A")).toBeInTheDocument();

    // GoodsByCategory
    expect(screen.getByText("Relief Goods")).toBeInTheDocument();

    // AidDistributionMap heading + barangay
    expect(screen.getByText("Dashboard.aidDistributionMap")).toBeInTheDocument();

    // StatusFooter
    expect(screen.getByText("Dashboard.online")).toBeInTheDocument();
  });

  it("only calls relief-related queries (not needs queries)", async () => {
    render(<ReliefPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.reliefOperations")).toBeInTheDocument();
    });

    // Relief queries called
    expect(getTotalDonations).toHaveBeenCalled();
    expect(getTotalBeneficiaries).toHaveBeenCalled();
    expect(getVolunteerCount).toHaveBeenCalled();
    expect(getDonationsByOrganization).toHaveBeenCalled();
    expect(getDeploymentHubs).toHaveBeenCalled();
    expect(getGoodsByCategory).toHaveBeenCalled();
    expect(getBeneficiariesByBarangay).toHaveBeenCalled();
    expect(getDeploymentMapPoints).toHaveBeenCalled();

    // No needs queries should exist in the mock — the module mock only defines relief queries
    // This verifies the page doesn't import or call needs-related functions
  });

  it("renders error state with retry button on fetch failure", async () => {
    vi.mocked(getTotalDonations).mockRejectedValue(new Error("Network error"));

    render(<ReliefPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.loadError")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Dashboard.retry" })).toBeInTheDocument();
  });

  it("shows cached data when cache exists", async () => {
    // Queries will never resolve — only cached data should render
    vi.mocked(getTotalDonations).mockReturnValue(new Promise(() => {}));
    vi.mocked(getTotalBeneficiaries).mockReturnValue(new Promise(() => {}));
    vi.mocked(getVolunteerCount).mockReturnValue(new Promise(() => {}));
    vi.mocked(getDonationsByOrganization).mockReturnValue(new Promise(() => {}));
    vi.mocked(getDeploymentHubs).mockReturnValue(new Promise(() => {}));
    vi.mocked(getGoodsByCategory).mockReturnValue(new Promise(() => {}));
    vi.mocked(getBeneficiariesByBarangay).mockReturnValue(new Promise(() => {}));
    vi.mocked(getDeploymentMapPoints).mockReturnValue(new Promise(() => {}));

    vi.mocked(getCachedRelief).mockResolvedValue({
      data: {
        totalDonations: 250000,
        totalBeneficiaries: 800,
        volunteerCount: 42,
        donationsByOrg: [{ name: "Cached Org", amount: 250000 }],
        deploymentHubs: [{ name: "Cached Hub", municipality: "Agoo", count: 5 }],
        goodsByCategory: [{ name: "Water", icon: null, total: 100 }],
        barangays: [{ name: "Cached Brgy", municipality: "Agoo", beneficiaries: 200 }],
        deploymentPoints: [],
      },
      updatedAt: Date.now(),
    });

    render(<ReliefPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard.reliefOperations")).toBeInTheDocument();
    });

    // Cached values rendered
    expect(screen.getByText("800")).toBeInTheDocument(); // totalBeneficiaries
    expect(screen.getByText("42")).toBeInTheDocument(); // volunteerCount
    expect(screen.getByText("Cached Org")).toBeInTheDocument();
    expect(screen.getByText("Cached Hub")).toBeInTheDocument();

    // Last updated timestamp shown
    expect(screen.getAllByText(/Dashboard.lastUpdated/).length).toBeGreaterThan(0);
  });
});
