import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import NeedsCoordinationMap from "@/components/NeedsCoordinationMap";
import StatusFooter from "@/components/StatusFooter";
import {
  getCachedNeeds,
  setCachedNeeds,
  type NeedsData,
} from "@/lib/cache";
import {
  getNeedsMapPoints,
  getActiveEvent,
} from "@/lib/queries";

export function NeedsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<NeedsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [needsPoints, activeEvent] = await Promise.all([
        getNeedsMapPoints(),
        getActiveEvent(),
      ]);

      const freshData: NeedsData = {
        needsPoints,
        activeEvent,
      };

      setData(freshData);
      setUpdatedAt(new Date());
      setError(null);
      hasDataRef.current = true;
      setCachedNeeds(freshData);
    } catch (e) {
      if (!hasDataRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load needs data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const cached = await getCachedNeeds();
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

  return (
    <div className="flex h-screen flex-col bg-base">
      <main className="relative flex-1 overflow-hidden">
        {data.needsPoints && <NeedsCoordinationMap needsPoints={data.needsPoints} />}
      </main>
      <StatusFooter
        eventName={data.activeEvent?.name}
        updatedAt={updatedAt}
      />
    </div>
  );
}
