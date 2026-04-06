import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
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
      if (!navigator.onLine) {
        setIsOffline(true);
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

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Site identity */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-50">
            {t("Dashboard.hero")}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {t("Dashboard.subtitle")}
          </p>

          {/* Active event banner */}
          {data.activeEvent && (
            <p className="mt-3 text-sm text-neutral-400">
              <span>{t("Dashboard.activeEvent")}</span>{" "}
              <span className="font-medium text-accent">{data.activeEvent.name}</span>
            </p>
          )}

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

        {/* Primary: Needs coordination map */}
        {data.needsPoints && <NeedsCoordinationMap needsPoints={data.needsPoints} />}
      </main>
      <StatusFooter />
    </div>
  );
}
