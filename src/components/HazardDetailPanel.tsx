import { useTranslation } from "react-i18next";
import type { HazardPoint } from "@/lib/queries";

type Props = {
  hazard: HazardPoint;
  onClose: () => void;
  variant?: "sheet" | "panel";
};

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

export default function HazardDetailPanel({ hazard, onClose, variant = "sheet" }: Props) {
  const { t } = useTranslation();

  const content = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center text-warning text-sm">
            ⚠
          </span>
          <span className="text-xs font-medium text-neutral-400">
            {t("ReliefMap.layerHazards")}
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

      {/* Hazard type */}
      <h3 className="mb-3 text-lg font-semibold text-neutral-50">
        {t(`HazardDetail.${hazard.hazardType}`)}
      </h3>

      {/* Details */}
      <div className="mb-4 space-y-3 text-sm">
        {hazard.description && (
          <div>
            <span className="text-neutral-400">{t("HazardDetail.description")}</span>
            <p className="mt-1 text-neutral-100">{hazard.description}</p>
          </div>
        )}

        {hazard.reportedBy && (
          <div>
            <span className="text-neutral-400">{t("HazardDetail.reportedBy")}</span>
            <p className="text-neutral-50">{hazard.reportedBy}</p>
          </div>
        )}

        <div>
          <span className="text-neutral-400">{t("HazardDetail.reported")}</span>
          <p className="text-neutral-50">{formatRelativeTime(hazard.createdAt)}</p>
        </div>
      </div>
    </>
  );

  if (variant === "panel") {
    return (
      <div role="region" aria-label={t(`HazardDetail.${hazard.hazardType}`)} className="rounded-lg bg-base/30 p-4">
        {content}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={t(`HazardDetail.${hazard.hazardType}`)}
        className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">{content}</div>
      </div>
    </>
  );
}
