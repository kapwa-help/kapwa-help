import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { updateSubmissionStatus, updateDeploymentStatus } from "@/lib/queries";
import type { NeedPoint } from "@/lib/queries";
import ClaimForm from "@/components/ClaimForm";

const STATUS_ORDER = ["pending", "verified", "in_transit", "completed", "resolved"] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-neutral-400",
  verified: "bg-error",
  in_transit: "bg-warning",
  completed: "bg-success",
  resolved: "bg-primary",
};

const STATUS_RING_COLORS: Record<string, string> = {
  pending: "ring-neutral-400",
  verified: "ring-error",
  in_transit: "ring-warning",
  completed: "ring-success",
  resolved: "ring-primary",
};

const STATUS_KEYS: Record<string, string> = {
  pending: "PinDetail.statusPending",
  verified: "PinDetail.statusVerified",
  in_transit: "PinDetail.statusInTransit",
  completed: "PinDetail.statusCompleted",
  resolved: "PinDetail.statusResolved",
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
  variant?: "sheet" | "panel";
};

export default function PinDetailSheet({ point, onClose, onStatusChange, variant = "sheet" }: Props) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Reset photo state when pin status changes (e.g. dispatch → delivery)
  useEffect(() => {
    setPhotoFile(null);
  }, [point.status]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    // TODO: Upload to Supabase Storage when bucket is configured
  }

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

  async function handleTransition(newStatus: string) {
    if (!isOnline) return;
    setUpdating(newStatus);
    setError(null);
    try {
      await updateSubmissionStatus(point.id, newStatus);
      // When resolving, also mark the linked deployment as received
      if (newStatus === "resolved") {
        try {
          await updateDeploymentStatus(point.id, "received");
        } catch {
          // Non-fatal — deployment may not exist (manually advanced pins)
        }
      }
      onStatusChange(point.id, newStatus);
    } catch {
      setError(t("PinDetail.updateError"));
    } finally {
      setUpdating(null);
    }
  }

  const relativeTime = formatRelativeTime(point.createdAt);

  const content = (
    <>
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

      {/* Interactive status stepper */}
      <div className="mb-2">
        {!isOnline && (
          <p className="mb-2 text-center text-xs text-warning">
            {t("PinDetail.offlineMessage")}
          </p>
        )}
        <div className="flex items-start">
          {STATUS_ORDER.map((s, i) => {
            const isCurrent = s === point.status;
            const isPast = i < currentIndex;
            const isUpdating = updating === s;
            return (
              <div key={s} className="flex flex-1 items-start">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => handleTransition(s)}
                    disabled={isCurrent || !isOnline || updating !== null}
                    aria-label={t(STATUS_KEYS[s])}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`h-7 w-7 rounded-full transition-all ${
                      isCurrent
                        ? `${STATUS_COLORS[s]} ring-2 ${STATUS_RING_COLORS[s]} ring-offset-2 ring-offset-secondary`
                        : isPast
                          ? `${STATUS_COLORS[s]} opacity-60 hover:opacity-100`
                          : "bg-neutral-400/30 hover:bg-neutral-400/50"
                    } disabled:cursor-default ${!isCurrent ? "disabled:opacity-30" : ""}`}
                  >
                    {isUpdating && (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-50 border-t-transparent" />
                    )}
                  </button>
                  <span className={`mt-1.5 text-center text-[10px] leading-tight ${
                    isCurrent ? "font-medium text-neutral-50" : "text-neutral-400"
                  }`}>
                    {t(STATUS_KEYS[s])}
                  </span>
                </div>
                {i < STATUS_ORDER.length - 1 && (
                  <div
                    className={`mt-3.5 h-0.5 flex-1 ${
                      isPast ? "bg-neutral-400/40" : "bg-neutral-400/20"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <p className="mt-2 text-center text-xs text-error">{error}</p>
        )}
      </div>

      {/* Claim form — verified pins only */}
      {point.status === "verified" && (
        <div className="mt-4">
          <ClaimForm
            point={point}
            onClaimed={() => onStatusChange(point.id, "in_transit")}
          />
        </div>
      )}

      {/* Dispatch photo — in_transit pins only */}
      {point.status === "in_transit" && (
        <div className="mt-4">
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-400/20 bg-base/30 py-2.5 text-sm text-neutral-400 hover:text-neutral-50 hover:border-neutral-400/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            {photoFile ? t("PinDetail.photoAdded") : t("PinDetail.addDispatchPhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Delivery photo — completed pins only */}
      {point.status === "completed" && (
        <div className="mt-4">
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-400/20 bg-base/30 py-2.5 text-sm text-neutral-400 hover:text-neutral-50 hover:border-neutral-400/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            {photoFile ? t("PinDetail.photoAdded") : t("PinDetail.addDeliveryPhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </label>
        </div>
      )}
    </>
  );

  if (variant === "panel") {
    return (
      <div
        role="region"
        aria-label={`${point.barangayName}, ${point.municipality}`}
        className="rounded-lg bg-base/30 p-4"
      >
        {content}
      </div>
    );
  }

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
          {content}
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
