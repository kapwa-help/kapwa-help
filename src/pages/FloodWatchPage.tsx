import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { getApprovedFloodReports, type FloodReport } from "@/lib/flood-queries";

const FloodWatchMap = lazy(() => import("@/components/maps/FloodWatchMap"));
const FloodReportForm = lazy(() => import("@/components/FloodReportForm"));
const FloodReportDetail = lazy(() => import("@/components/FloodReportDetail"));

export default function FloodWatchPage() {
  const { t } = useTranslation();
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

  return (
    <div className="flex h-dvh flex-col bg-base">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-neutral-400/20 bg-secondary px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-50">
          {t("FloodWatch.title")}
        </h1>
        <span className="text-xs text-neutral-400">
          {t("FloodWatch.subtitle")}
        </span>
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

        {/* Report button (FAB) */}
        {!showForm && !selected && (
          <button
            onClick={() => setShowForm(true)}
            className="absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-neutral-50 shadow-lg hover:bg-primary/80"
          >
            {t("FloodWatch.reportButton")}
          </button>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-[999] bg-base/60" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-lg font-semibold text-neutral-50">
                {t("FloodWatch.formTitle")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
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
        </>
      )}

      {/* Detail sheet */}
      {selected && (
        <Suspense fallback={null}>
          <FloodReportDetail
            report={selected}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
