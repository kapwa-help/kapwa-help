import { useEffect, useState, useCallback, Suspense } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import StatusFooter from "@/components/StatusFooter";
import DeploymentSummaryCards from "@/components/DeploymentSummaryCards";
import RecentDeployments from "@/components/RecentDeployments";
import MapSkeleton from "@/components/maps/MapSkeleton";
import {
  getCachedDeployments,
  setCachedDeployments,
  type DeploymentsData,
} from "@/lib/cache";
import {
  getActiveEvent,
  getBarangayDistribution,
  getPeopleServed,
  getRecentDeployments,
} from "@/lib/queries";
import { lazyWithReload } from "@/lib/lazy-reload";

const BarangayBubbleMap = lazyWithReload(() => import("@/components/maps/BarangayBubbleMap"));

export function DeploymentsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DeploymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [eventName, setEventName] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const event = await getActiveEvent();
      setEventName(event?.name ?? undefined);
      if (!event) {
        setData({ totalDeliveries: 0, peopleServed: { adults: 0, children: 0, seniorsPwd: 0 }, barangaysReached: 0, barangayDistribution: [], recentDeployments: [] });
        setLoading(false);
        return;
      }

      const [distribution, people, recent] = await Promise.all([
        getBarangayDistribution(event.id),
        getPeopleServed(event.id),
        getRecentDeployments(event.id),
      ]);

      const fresh: DeploymentsData = {
        totalDeliveries: recent.length,
        peopleServed: people,
        barangaysReached: distribution.length,
        barangayDistribution: distribution,
        recentDeployments: recent,
      };

      setData(fresh);
      setUpdatedAt(new Date());
      setError(null);
      setCachedDeployments(fresh);
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
      const cached = await getCachedDeployments();
      if (cached) {
        setData(cached.data);
        setUpdatedAt(new Date(cached.updatedAt));
        setLoading(false);
      }
      fetchData();
    }
    init();
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

  return (
    <div className="flex min-h-dvh flex-col bg-base">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold text-neutral-50">{t("Deployments.title")}</h1>

        <DeploymentSummaryCards
          totalDeliveries={data.totalDeliveries}
          peopleServed={data.peopleServed}
          barangaysReached={data.barangaysReached}
        />

        {/* Map + Recent deployments */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[400px] overflow-hidden rounded-2xl border border-neutral-400/20">
            <Suspense fallback={<MapSkeleton />}>
              <BarangayBubbleMap barangays={data.barangayDistribution} />
            </Suspense>
          </div>
          <RecentDeployments deployments={data.recentDeployments} />
        </div>
      </main>
      <StatusFooter eventName={eventName} updatedAt={updatedAt} />
    </div>
  );
}
