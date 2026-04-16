import { useTranslation } from "react-i18next";
import type { HubPoint } from "@/lib/queries";

type Props = {
  hub: HubPoint;
  onClose: () => void;
  variant?: "sheet" | "panel";
};

export default function HubDetailPanel({ hub, onClose, variant = "sheet" }: Props) {
  const { t } = useTranslation();

  const content = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-xs font-bold text-neutral-50">
            H
          </span>
          <span className="text-xs font-medium text-neutral-400">
            {t("ReliefMap.layerHubs")}
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

      {/* Hub name */}
      <h3 className="mb-1 text-lg font-semibold text-neutral-50">{hub.name}</h3>

      {/* Description — subtitle */}
      {hub.description && (
        <p className="mb-4 text-sm text-neutral-400">{hub.description}</p>
      )}

      {/* Inventory — category checklist */}
      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-neutral-400">
          {t("HubDetail.inventory")}
        </p>
        {hub.inventory.length === 0 ? (
          <p className="text-sm text-neutral-400/60">{t("HubDetail.noInventory")}</p>
        ) : (
          <div className="space-y-2">
            {hub.inventory.map((item) => (
              <div
                key={item.categoryName}
                className="flex items-center gap-2 rounded-lg bg-base/30 px-3 py-2"
              >
                <span className="text-sm">{item.categoryIcon}</span>
                <span className="text-sm text-neutral-50">{item.categoryName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes — free-text status/needs */}
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-400">
          {t("HubDetail.notes")}
        </p>
        {hub.notes ? (
          <p className="whitespace-pre-line rounded-lg bg-base/30 px-3 py-2 text-sm text-neutral-50">
            {hub.notes}
          </p>
        ) : (
          <p className="text-sm text-neutral-400/60">{t("HubDetail.noNotes")}</p>
        )}
      </div>
    </>
  );

  if (variant === "panel") {
    return (
      <div role="region" aria-label={hub.name} className="rounded-lg bg-base/30 p-4">
        {content}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={hub.name}
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
