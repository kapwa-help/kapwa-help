import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FloodReport } from "@/lib/flood-queries";
import { updateFloodReportStatus } from "@/lib/flood-queries";
import { useAuthContext } from "@/lib/auth-context";
import { AdminOnly } from "@/components/AdminOnly";

interface Props {
  report: FloodReport;
  onClose: () => void;
  onStatusChange?: (id: string, status: "approved" | "rejected") => void;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi)$/i.test(url);
}

export default function FloodReportDetail({ report, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(status: "approved" | "rejected") {
    if (!user) return;
    setUpdating(true);
    try {
      await updateFloodReportStatus(report.id, status, user.id);
      onStatusChange?.(report.id, status);
    } catch {
      setUpdating(false);
    }
  }

  const dateStr = report.photoTakenAt
    ? new Date(report.photoTakenAt).toLocaleDateString()
    : new Date(report.createdAt).toLocaleDateString();

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={report.weatherEvent ?? t("FloodWatch.reportDetail")}
        className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <span className="text-xs font-medium text-neutral-400">
              {dateStr}
            </span>
            <button
              onClick={onClose}
              aria-label={t("PinDetail.close")}
              className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Photo/Video */}
          {isVideoUrl(report.photoUrl) ? (
            <video
              src={report.photoUrl}
              controls
              className="mb-4 w-full rounded-xl border border-neutral-400/20"
            />
          ) : (
            <img
              src={report.photoUrl}
              alt={report.description ?? ""}
              loading="lazy"
              className="mb-4 w-full rounded-xl border border-neutral-400/20 object-cover"
            />
          )}

          {/* Weather event */}
          {report.weatherEvent && (
            <h3 className="mb-2 text-lg font-semibold text-neutral-50">
              {report.weatherEvent}
            </h3>
          )}

          {/* Description */}
          {report.description && (
            <p className="mb-4 text-sm text-neutral-100">{report.description}</p>
          )}

          {/* Status badge */}
          <div className="mb-4">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
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

          {/* Admin-only: PII + actions */}
          <AdminOnly>
            <div className="space-y-3 border-t border-neutral-400/20 pt-4">
              {report.reporterName && (
                <div className="text-sm">
                  <span className="text-neutral-400">{t("FloodWatch.reporterName")}</span>
                  <p className="text-neutral-50">{report.reporterName}</p>
                </div>
              )}
              {report.reporterPhone && (
                <div className="text-sm">
                  <span className="text-neutral-400">{t("FloodWatch.reporterPhone")}</span>
                  <p className="text-neutral-50">
                    <a href={`tel:${report.reporterPhone}`} className="text-primary hover:underline">
                      {report.reporterPhone}
                    </a>
                  </p>
                </div>
              )}

              {report.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleStatusChange("approved")}
                    disabled={updating}
                    className="flex-1 cursor-pointer rounded-lg bg-success/20 px-4 py-2.5 text-sm font-medium text-success hover:bg-success/30 disabled:opacity-50"
                  >
                    {t("FloodWatch.approve")}
                  </button>
                  <button
                    onClick={() => handleStatusChange("rejected")}
                    disabled={updating}
                    className="flex-1 cursor-pointer rounded-lg bg-error/20 px-4 py-2.5 text-sm font-medium text-error hover:bg-error/30 disabled:opacity-50"
                  >
                    {t("FloodWatch.reject")}
                  </button>
                </div>
              )}
            </div>
          </AdminOnly>
        </div>
      </div>
    </>
  );
}
