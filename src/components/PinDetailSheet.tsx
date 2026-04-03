import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { updateSubmissionStatus } from "@/lib/queries";
import type { NeedPoint } from "@/lib/queries";

const STATUS_ORDER = ["pending", "verified", "in_transit", "completed", "resolved"] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-neutral-400",
  verified: "bg-error",
  in_transit: "bg-warning",
  completed: "bg-success",
  resolved: "bg-primary",
};

const STATUS_BUTTON_COLORS: Record<string, string> = {
  verified: "bg-error hover:bg-error/80",
  in_transit: "bg-warning hover:bg-warning/80",
  completed: "bg-success hover:bg-success/80",
  resolved: "bg-primary hover:bg-primary/80",
};

const STATUS_KEYS: Record<string, string> = {
  pending: "PinDetail.statusPending",
  verified: "PinDetail.statusVerified",
  in_transit: "PinDetail.statusInTransit",
  completed: "PinDetail.statusCompleted",
  resolved: "PinDetail.statusResolved",
};

const MARK_KEYS: Record<string, string> = {
  verified: "PinDetail.markVerified",
  in_transit: "PinDetail.markInTransit",
  completed: "PinDetail.markCompleted",
  resolved: "PinDetail.markResolved",
};

const ACCESS_KEYS: Record<string, string> = {
  truck: "Dashboard.accessTruck",
  "4x4": "Dashboard.access4x4",
  boat: "Dashboard.accessBoat",
  foot_only: "Dashboard.accessFootOnly",
  cut_off: "Dashboard.accessCutOff",
};

type Props = {
  point: NeedPoint;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: string) => void;
};

export default function PinDetailSheet({ point, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const currentIndex = STATUS_ORDER.indexOf(point.status as typeof STATUS_ORDER[number]);
  const forwardStatuses = STATUS_ORDER.slice(currentIndex + 1);
  const isResolved = point.status === "resolved";

  async function handleTransition(newStatus: string) {
    if (!isOnline) return;
    setUpdating(newStatus);
    setError(null);
    try {
      await updateSubmissionStatus(point.id, newStatus);
      onStatusChange(point.id, newStatus);
    } catch {
      setError(t("PinDetail.updateError"));
    } finally {
      setUpdating(null);
    }
  }

  const relativeTime = formatRelativeTime(point.createdAt);

  return (
    <>
      {/* Backdrop — click outside to close */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={`${point.barangayName}, ${point.municipality}`}
        className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-full ${STATUS_COLORS[point.status] ?? "bg-neutral-400"}`} />
            <span className="text-xs font-medium text-neutral-400">
              {t(STATUS_KEYS[point.status] ?? "PinDetail.statusPending")}
            </span>
          </div>
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

        {/* Location */}
        <h3 className="mb-3 text-lg font-semibold text-neutral-50">
          {point.barangayName}, {point.municipality}
        </h3>

        {/* Details grid */}
        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-neutral-400">{t("PinDetail.gapCategory")}</span>
            <p className="text-neutral-50">{point.gapCategory ?? t("Dashboard.unset")}</p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.urgency")}</span>
            <p className="text-neutral-50">
              {t(`Dashboard.urgency_${point.urgency ?? "unset"}`, point.urgency ?? "")}
            </p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.access")}</span>
            <p className="text-neutral-50">
              {point.accessStatus && ACCESS_KEYS[point.accessStatus]
                ? t(ACCESS_KEYS[point.accessStatus])
                : point.accessStatus ?? ""}
            </p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.families")}</span>
            <p className="text-neutral-50">{point.quantityNeeded ?? "—"}</p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.contactName")}</span>
            <p className="text-neutral-50">{point.contactName}</p>
          </div>
          <div>
            <span className="text-neutral-400">{t("PinDetail.submitted")}</span>
            <p className="text-neutral-50">{relativeTime}</p>
          </div>
        </div>

        {/* Notes */}
        {point.notes && (
          <div className="mb-4">
            <span className="text-sm text-neutral-400">{t("PinDetail.notes")}</span>
            <p className="mt-1 text-sm text-neutral-100">{point.notes}</p>
          </div>
        )}

        {/* Step indicator */}
        <div className="mb-4" aria-hidden="true">
          <div className="flex items-center justify-between">
            {STATUS_ORDER.map((s, i) => {
              const isCurrent = s === point.status;
              const isPast = i < currentIndex;
              return (
                <div key={s} className="flex flex-1 items-center">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      isCurrent
                        ? STATUS_COLORS[s]
                        : isPast
                          ? STATUS_COLORS[s] + " opacity-60"
                          : "bg-neutral-400/30"
                    }`}
                  />
                  {i < STATUS_ORDER.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 ${
                        isPast ? "bg-neutral-400/40" : "bg-neutral-400/20"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status actions */}
        {isResolved ? (
          <p className="text-center text-sm text-neutral-400">
            {t("PinDetail.resolvedMessage")}
          </p>
        ) : (
          <div className="space-y-2">
            {!isOnline && (
              <p className="text-center text-xs text-warning">
                {t("PinDetail.offlineMessage")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {forwardStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleTransition(s)}
                  disabled={!isOnline || updating !== null}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-50 transition-colors disabled:opacity-50 ${
                    STATUS_BUTTON_COLORS[s] ?? "bg-neutral-400"
                  }`}
                >
                  {updating === s ? t("PinDetail.updating") : t(MARK_KEYS[s])}
                </button>
              ))}
            </div>
            {error && (
              <p className="text-center text-xs text-error">{error}</p>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
