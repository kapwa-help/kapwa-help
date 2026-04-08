import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import StatusFooter from "@/components/StatusFooter";
import DonationsByOrg from "@/components/DonationsByOrg";
import RecentPurchases from "@/components/RecentPurchases";
import {
  getCachedTransparency,
  setCachedTransparency,
  type TransparencyData,
} from "@/lib/cache";
import {
  getActiveEvent,
  getTotalDonations,
  getTotalSpent,
  getTotalBeneficiaries,
  getDonationsByOrganization,
  getRecentPurchases,
} from "@/lib/queries";

export function TransparencyPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [eventName, setEventName] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const event = await getActiveEvent();
      setEventName(event?.name ?? undefined);

      const [totalDonations, totalSpent, totalBeneficiaries, donationsByOrg, recentPurchases] =
        await Promise.all([
          getTotalDonations(),
          getTotalSpent(),
          event ? getTotalBeneficiaries(event.id) : Promise.resolve(0),
          getDonationsByOrganization(),
          event ? getRecentPurchases(event.id) : Promise.resolve([]),
        ]);

      const fresh: TransparencyData = {
        totalDonations,
        totalSpent,
        totalBeneficiaries,
        donationsByOrg,
        recentPurchases,
      };

      setData(fresh);
      setUpdatedAt(new Date());
      setError(null);
      setCachedTransparency(fresh);
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
      const cached = await getCachedTransparency();
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
        <button
          onClick={fetchData}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-neutral-50 hover:bg-primary/80"
        >
          {t("App.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-base">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold text-neutral-50">
          {t("Transparency.title")}
        </h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
            <p className="text-sm text-neutral-400">{t("ReliefOps.totalDonations")}</p>
            <p className="mt-1 text-2xl font-bold text-success">₱{data.totalDonations.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
            <p className="text-sm text-neutral-400">{t("ReliefOps.totalSpent")}</p>
            <p className="mt-1 text-2xl font-bold text-success">₱{data.totalSpent.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
            <p className="text-sm text-neutral-400">{t("Transparency.totalBeneficiaries")}</p>
            <p className="mt-1 text-2xl font-bold text-success">{data.totalBeneficiaries.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <DonationsByOrg donations={data.donationsByOrg} />
          <RecentPurchases purchases={data.recentPurchases} />
        </div>
      </main>
      <StatusFooter eventName={eventName} updatedAt={updatedAt} />
    </div>
  );
}
