import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import ReliefMap from "@/components/ReliefMap";
import StatusFooter from "@/components/StatusFooter";
import {
  getCachedReliefMap,
  setCachedReliefMap,
  type ReliefMapData,
} from "@/lib/cache";
import {
  getActiveEvent,
  getNeedsMapPoints,
  getDeploymentHubs,
  getHazards,
} from "@/lib/queries";

export function ReliefMapPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReliefMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const activeEvent = await getActiveEvent();

      const [needsPoints, hubs, hazards] = await Promise.all([
        activeEvent ? getNeedsMapPoints(activeEvent.id) : Promise.resolve([]),
        activeEvent ? getDeploymentHubs(activeEvent.id) : Promise.resolve([]),
        activeEvent ? getHazards(activeEvent.id) : Promise.resolve([]),
      ]);

      const freshData: ReliefMapData = {
        needsPoints,
        hubs,
        hazards,
        activeEvent,
      };

      setData(freshData);
      setUpdatedAt(new Date());
      setError(null);
      hasDataRef.current = true;
      setCachedReliefMap(freshData);
    } catch (e) {
      if (!hasDataRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load relief map data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const cached = await getCachedReliefMap();
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
      <div className="flex h-dvh flex-col bg-base">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-neutral-400">{t("App.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-dvh flex-col bg-base">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-error">{t("App.loadError")}</p>
          <button
            onClick={fetchData}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-neutral-50 hover:bg-primary/80"
          >
            {t("App.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-base">
      <Header />
      <main className="relative flex-1 overflow-hidden">
        <ReliefMap
          needsPoints={data.needsPoints}
          hubs={data.hubs}
          hazards={data.hazards}
        />
      </main>
      <StatusFooter
        eventName={data.activeEvent?.name}
        updatedAt={updatedAt}
      />
    </div>
  );
}
