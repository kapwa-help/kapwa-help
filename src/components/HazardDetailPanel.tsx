import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HazardPoint } from "@/lib/queries";
import { resolveHazard } from "@/lib/queries";

type Props = {
  hazard: HazardPoint;
  onClose: () => void;
  onResolve?: (id: string) => void;
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

export default function HazardDetailPanel({ hazard, onClose, onResolve, variant = "sheet" }: Props) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState(false);

  async function handleResolve() {
    setResolving(true);
    try {
      await resolveHazard(hazard.id);
      onResolve?.(hazard.id);
    } catch {
      setResolving(false);
    }
  }

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

      {/* Description as primary identifier */}
      <h3 className="mb-3 text-lg font-semibold text-neutral-50">
        {hazard.description}
      </h3>

      {/* Photo */}
      {hazard.photoUrl && (
        <div className="mb-4">
          <img
            src={hazard.photoUrl}
            alt={hazard.description}
            loading="lazy"
            className="w-full rounded-xl border border-neutral-400/20 object-cover"
          />
        </div>
      )}

      {/* Details */}
      <div className="mb-4 space-y-3 text-sm">
        {hazard.reportedBy && (
          <div>
            <span className="text-neutral-400">{t("HazardDetail.reportedBy")}</span>
            <p className="text-neutral-50">{hazard.reportedBy}</p>
          </div>
        )}

        {hazard.contactPhone && (
          <div>
            <span className="text-neutral-400">{t("HazardDetail.contactPhone")}</span>
            <p className="text-neutral-50">
              <a
                href={`tel:${hazard.contactPhone}`}
                className="text-primary hover:underline"
              >
                {hazard.contactPhone}
              </a>
            </p>
          </div>
        )}

        <div>
          <span className="text-neutral-400">{t("HazardDetail.reported")}</span>
          <p className="text-neutral-50">{formatRelativeTime(hazard.createdAt)}</p>
        </div>
      </div>

      {/* Resolve button */}
      <button
        onClick={handleResolve}
        disabled={resolving}
        className="w-full cursor-pointer rounded-lg bg-success/20 px-4 py-2.5 text-sm font-medium text-success hover:bg-success/30 disabled:opacity-50"
      >
        {resolving ? t("HazardDetail.resolving") : t("HazardDetail.markResolved")}
      </button>
    </>
  );

  if (variant === "panel") {
    return (
      <div role="region" aria-label={hazard.description} className="rounded-lg bg-base/30 p-4">
        {content}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={hazard.description}
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
