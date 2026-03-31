import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SummaryCards from "@/components/SummaryCards";
import DonationsByOrg from "@/components/DonationsByOrg";
import DeploymentHubs from "@/components/DeploymentHubs";
import GoodsByCategory from "@/components/GoodsByCategory";
import AidDistributionMap from "@/components/AidDistributionMap";
import StatusFooter from "@/components/StatusFooter";
import {
  getCachedRelief,
  setCachedRelief,
  type ReliefData,
} from "@/lib/cache";
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

export function ReliefPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReliefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [
        totalDonations,
        totalBeneficiaries,
        volunteerCount,
        donationsByOrg,
        deploymentHubs,
        goodsByCategory,
        barangays,
        deploymentPoints,
      ] = await Promise.all([
        getTotalDonations(),
        getTotalBeneficiaries(),
        getVolunteerCount(),
        getDonationsByOrganization(),
        getDeploymentHubs(),
        getGoodsByCategory(),
        getBeneficiariesByBarangay(),
        getDeploymentMapPoints(),
      ]);

      const freshData: ReliefData = {
        totalDonations,
        totalBeneficiaries,
        volunteerCount,
        donationsByOrg,
        deploymentHubs,
        goodsByCategory,
        barangays,
        deploymentPoints,
      };

      setData(freshData);
      setUpdatedAt(new Date());
      setError(null);
      hasDataRef.current = true;
      setCachedRelief(freshData);
    } catch (e) {
      if (!hasDataRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load relief data");
      }
      if (!navigator.onLine) {
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const cached = await getCachedRelief();
      if (cached) {
        setData(cached.data);
        setUpdatedAt(new Date(cached.updatedAt));
        setLoading(false);
        hasDataRef.current = true;
      }
      fetchData();
    }
    init();
  }, [fetchData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchData();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">{t("App.loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-error">{t("App.loadError")}</p>
        <button
          onClick={fetchData}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-neutral-50 hover:bg-primary/80"
        >
          {t("App.retry")}
        </button>
      </div>
    );
  }

  const totalDeployments = data.deploymentHubs.reduce(
    (sum, h) => sum + h.count,
    0
  );

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Page heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-50">
            {t("Dashboard.reliefOperations")}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {updatedAt
              ? `${t("Dashboard.lastUpdated")}: ${updatedAt.toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}`
              : ""}
            {isOffline && (
              <span className="ml-2 text-warning">{"\u00b7"} {t("Dashboard.offline")}</span>
            )}
          </p>
        </div>

        {/* Relief summary cards */}
        <SummaryCards
          totalDonations={data.totalDonations}
          totalBeneficiaries={data.totalBeneficiaries}
          volunteerCount={data.volunteerCount}
          orgCount={data.donationsByOrg.length}
          locationCount={data.barangays.length}
          deploymentCount={totalDeployments}
        />

        {/* 3-column grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DonationsByOrg donations={data.donationsByOrg} />
          <DeploymentHubs hubs={data.deploymentHubs} />
          <GoodsByCategory categories={data.goodsByCategory} />
        </div>

        {/* Distribution map */}
        <AidDistributionMap
          barangays={data.barangays}
          deploymentPoints={data.deploymentPoints}
        />
      </main>
      <StatusFooter />
    </div>
  );
}
