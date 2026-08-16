import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "@/lib/auth-context";
import { getPendingFloodReports, getAllFloodReports, type FloodReport } from "@/lib/flood-queries";

const FloodReportDetail = lazy(() => import("@/components/FloodReportDetail"));

type Tab = "pending" | "all";

export default function FloodWatchAdminPage() {
  const { t } = useTranslation();
  const { isAdmin, loading: authLoading } = useAuthContext();
  const [tab, setTab] = useState<Tab>("pending");
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FloodReport | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === "pending" ? await getPendingFloodReports() : await getAllFloodReports();
      setReports(data);
    } catch {
      // Silent — shows empty list
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (isAdmin) fetchReports();
  }, [isAdmin, fetchReports]);

  function handleStatusChange(id: string, status: "approved" | "rejected") {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
  }

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-base text-neutral-400">
        {t("App.loading")}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-base">
        <p className="text-neutral-400">{t("FloodWatch.adminRequired")}</p>
        <a
          href="/demo/en/login"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80"
        >
          {t("FloodWatch.login")}
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base">
      {/* Header */}
      <header className="border-b border-neutral-400/20 bg-secondary px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-50">
          {t("FloodWatch.adminTitle")}
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-neutral-400/20">
        <button
          onClick={() => setTab("pending")}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            tab === "pending" ? "border-b-2 border-primary text-primary" : "text-neutral-400"
          }`}
        >
          {t("FloodWatch.tabPending")}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            tab === "all" ? "border-b-2 border-primary text-primary" : "text-neutral-400"
          }`}
        >
          {t("FloodWatch.tabAll")}
        </button>
      </div>

      {/* Report list */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        {loading ? (
          <p className="text-center text-neutral-400">{t("App.loading")}</p>
        ) : reports.length === 0 ? (
          <p className="text-center text-neutral-400">
            {tab === "pending" ? t("FloodWatch.noPending") : t("FloodWatch.noReports")}
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelected(report)}
                className="flex w-full items-start gap-3 rounded-xl border border-neutral-400/20 bg-secondary p-3 text-left hover:border-primary/40"
              >
                {/\.(mp4|mov|webm|avi)$/i.test(report.photoUrl) ? (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-400/20 bg-base text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <img
                    src={report.photoUrl}
                    alt=""
                    className="h-16 w-16 flex-shrink-0 rounded-lg border border-neutral-400/20 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {report.weatherEvent && (
                      <span className="text-sm font-medium text-neutral-50">
                        {report.weatherEvent}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        report.status === "approved"
                          ? "bg-success/20 text-success"
                          : report.status === "rejected"
                            ? "bg-error/20 text-error"
                            : "bg-warning/20 text-warning"
                      }`}
                    >
                      {t(`FloodWatch.status_${report.status}`)}
                    </span>
                  </div>
                  {report.description && (
                    <p className="mt-1 truncate text-sm text-neutral-100">
                      {report.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(report.createdAt).toLocaleDateString()}
                    {report.reporterName && ` — ${report.reporterName}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      {selected && (
        <Suspense fallback={null}>
          <FloodReportDetail
            report={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
            showLocation
          />
        </Suspense>
      )}
    </div>
  );
}
