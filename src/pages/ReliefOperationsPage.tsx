import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import StatusFooter from "@/components/StatusFooter";
import OperationsSummaryCards from "@/components/OperationsSummaryCards";
import DonationsByOrg from "@/components/DonationsByOrg";
import RecentPurchases from "@/components/RecentPurchases";
import AvailableInventory from "@/components/AvailableInventory";
import {
  getCachedOperations,
  setCachedOperations,
  type OperationsData,
} from "@/lib/cache";
import {
  getActiveEvent,
  getTotalDonations,
  getTotalSpent,
  getDonationsByOrganization,
  getRecentPurchases,
  getAvailableInventory,
} from "@/lib/queries";

export function ReliefOperationsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [eventName, setEventName] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const event = await getActiveEvent();
      setEventName(event?.name ?? undefined);

      const [totalDonations, totalSpent, donationsByOrg, recentPurchases, availableInventory] = await Promise.all([
        getTotalDonations(),
        getTotalSpent(),
        getDonationsByOrganization(),
        event ? getRecentPurchases(event.id) : Promise.resolve([]),
        event ? getAvailableInventory(event.id) : Promise.resolve([]),
      ]);

      const fresh: OperationsData = {
        totalDonations,
        totalSpent,
        donationsByOrg,
        recentPurchases,
        availableInventory,
      };

      setData(fresh);
      setUpdatedAt(new Date());
      setError(null);
      setCachedOperations(fresh);
    } catch (e) {
      if (!data) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const cached = await getCachedOperations();
      if (cached) {
        setData(cached.data);
        setUpdatedAt(new Date(cached.updatedAt));
        setLoading(false);
      }
      fetchData();
    }
    init();

    const handleOnline = () => fetchData();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base">
        <p className="text-neutral-400">{t("App.loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base">
        <p className="text-error">{t("App.loadError")}</p>
        <button onClick={fetchData} className="rounded-lg bg-primary px-4 py-2 text-sm text-neutral-50 hover:bg-primary/80">
          {t("App.retry")}
        </button>
      </div>
    );
  }

  const totalAvailable = data.availableInventory.reduce((sum, i) => sum + Math.max(0, i.available), 0);

  return (
    <div className="flex min-h-dvh flex-col bg-base">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold text-neutral-50">{t("ReliefOps.title")}</h1>

        <OperationsSummaryCards
          totalDonations={data.totalDonations}
          totalSpent={data.totalSpent}
          goodsAvailable={totalAvailable}
        />

        <AvailableInventory inventory={data.availableInventory} />

        <div className="grid gap-6 lg:grid-cols-2">
          <DonationsByOrg donations={data.donationsByOrg} />
          <RecentPurchases purchases={data.recentPurchases} />
        </div>
      </main>
      <StatusFooter eventName={eventName} updatedAt={updatedAt} />
    </div>
  );
}
