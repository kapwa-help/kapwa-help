import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import StatusFooter from "@/components/StatusFooter";
import DeploymentsCoordinationMap from "@/components/DeploymentsCoordinationMap";
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

export function DeploymentsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DeploymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [eventName, setEventName] = useState<string | undefined>(undefined);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const event = await getActiveEvent();
      setEventName(event?.name ?? undefined);
      if (!event) {
        setData({ peopleServed: { adults: 0, children: 0, seniorsPwd: 0 }, barangayDistribution: [], recentDeployments: [] });
        setLoading(false);
        return;
      }

      const [distribution, people, recent] = await Promise.all([
        getBarangayDistribution(event.id),
        getPeopleServed(event.id),
        getRecentDeployments(event.id),
      ]);

      const fresh: DeploymentsData = {
        peopleServed: people,
        barangayDistribution: distribution,
        recentDeployments: recent,
      };

      setData(fresh);
      setUpdatedAt(new Date());
      setError(null);
      hasDataRef.current = true;
      setCachedDeployments(fresh);
    } catch (e) {
      if (!hasDataRef.current) {
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
        hasDataRef.current = true;
      }
      fetchData();
    }
    init();
  }, [fetchData]);

  useEffect(() => {
    const handleOnline = () => fetchData();
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
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

  const totalDeliveries = data.barangayDistribution.reduce((sum, b) => sum + b.deployments.length, 0);
  const totalPeople = data.peopleServed.adults + data.peopleServed.children + data.peopleServed.seniorsPwd;

  return (
    <div className="flex h-dvh flex-col bg-base">
      <Header />
      <main className="relative flex-1 overflow-hidden">
        <DeploymentsCoordinationMap
          barangayDistribution={data.barangayDistribution}
          recentDeployments={data.recentDeployments}
          totalDeliveries={totalDeliveries}
          peopleServed={totalPeople}
          barangaysReached={data.barangayDistribution.length}
        />
      </main>
      <StatusFooter eventName={eventName} updatedAt={updatedAt} />
    </div>
  );
}
