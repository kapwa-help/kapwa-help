import { useTranslation } from "react-i18next";
import type { BarangayDistributionEntry } from "@/lib/cache";

type Props = {
  barangay: BarangayDistributionEntry;
  onClose: () => void;
  variant?: "panel" | "sheet";
};

export default function BarangayDetailPanel({ barangay, onClose, variant = "panel" }: Props) {
  const { t } = useTranslation();

  const content = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-50">
            {barangay.name}, {barangay.municipality}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            {barangay.totalQuantity.toLocaleString()} {t("Deployments.totalItems")} · {barangay.categories.length} {t("Deployments.categories")}
          </p>
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

      {/* Category breakdown */}
      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t("Deployments.aidBreakdown")}
        </h4>
        <div className="space-y-1.5">
          {barangay.categories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between text-sm">
              <span className="text-neutral-50">
                {cat.icon && `${cat.icon} `}{cat.name}
              </span>
              <span className="font-medium text-neutral-100">{cat.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment history */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t("Deployments.deliveryHistory")}
        </h4>
        <div className="divide-y divide-neutral-400/10">
          {barangay.deployments.map((d, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-neutral-50">
                  {d.categoryIcon && `${d.categoryIcon} `}{d.categoryName}
                </p>
                <p className="text-xs text-neutral-400">{d.orgName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-neutral-50">
                  {d.quantity?.toLocaleString() ?? "—"} {d.unit ?? ""}
                </p>
                <p className="text-xs text-neutral-400">{d.date ?? ""}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (variant === "panel") {
    return <div className="flex-1 overflow-y-auto p-4">{content}</div>;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={`${barangay.name}, ${barangay.municipality}`}
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
