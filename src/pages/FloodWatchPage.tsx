import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { getApprovedFloodReports, type FloodReport } from "@/lib/flood-queries";

const FloodWatchMap = lazy(() => import("@/components/maps/FloodWatchMap"));
const FloodReportForm = lazy(() => import("@/components/FloodReportForm"));
const FloodReportDetail = lazy(() => import("@/components/FloodReportDetail"));

const LOCALES = ["en", "fil", "ilo"] as const;

export default function FloodWatchPage() {
  const { t, i18n } = useTranslation();
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FloodReport | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const data = await getApprovedFloodReports();
      setReports(data);
    } catch {
      // Silently fail — map just shows no pins
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchReports();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchReports]);

  if (showForm) {
    return (
      <div className="flex h-dvh flex-col bg-base">
        <header className="flex items-center gap-3 border-b border-neutral-400/20 bg-secondary px-4 py-3">
          <button
            onClick={() => setShowForm(false)}
            className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
            aria-label={t("FloodWatch.backToMap")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-neutral-50">
            {t("FloodWatch.formTitle")}
          </h2>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={null}>
            <FloodReportForm
              onSubmitted={() => {
                setShowForm(false);
                fetchReports();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-base">
      {/* Header bar — matches main app styling */}
      <header className="bg-secondary shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
        <div className="flex items-center px-6 py-4">
          <div className="flex flex-1 items-center">
            <h1 className="text-xl font-bold text-white">
              {t("FloodWatch.title")}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-0.5 rounded-lg border border-neutral-400/20 bg-secondary p-0.5">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  onClick={() => i18n.changeLanguage(loc)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    i18n.language === loc
                      ? "bg-primary text-neutral-50"
                      : "text-neutral-400 hover:text-neutral-50"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-[0_0_12px_rgba(14,154,167,0.3)] transition-all duration-200 hover:bg-primary/80 hover:shadow-[0_0_16px_rgba(14,154,167,0.4)]"
            >
              {t("FloodWatch.addMediaButton")}
            </button>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-neutral-400">
            {t("App.loading")}
          </div>
        ) : (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-neutral-400">{t("App.loading")}</div>}>
            <FloodWatchMap reports={reports} onSelect={setSelected} />
          </Suspense>
        )}

        {/* Add Media FAB */}
        {!selected && (
          <button
            onClick={() => setShowForm(true)}
            className="absolute bottom-6 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-neutral-50 shadow-lg hover:bg-primary/80"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            {t("FloodWatch.addMediaButton")}
          </button>
        )}

        {/* Detail panel (inside map container) */}
        {selected && (
          <Suspense fallback={null}>
            <FloodReportDetail
              report={selected}
              onClose={() => setSelected(null)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
