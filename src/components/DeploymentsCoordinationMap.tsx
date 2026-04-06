import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";
import BarangayDetailPanel from "@/components/BarangayDetailPanel";
import { lazyWithReload } from "@/lib/lazy-reload";
import type {
  BarangayDistributionEntry,
  RecentDeploymentEntry,
} from "@/lib/cache";

const BarangayBubbleMap = lazyWithReload(
  () => import("@/components/maps/BarangayBubbleMap")
);

type Props = {
  barangayDistribution: BarangayDistributionEntry[];
  recentDeployments: RecentDeploymentEntry[];
  totalDeliveries: number;
  peopleServed: number;
  barangaysReached: number;
};

export default function DeploymentsCoordinationMap({
  barangayDistribution,
  recentDeployments,
  totalDeliveries,
  peopleServed,
  barangaysReached,
}: Props) {
  const { t } = useTranslation();
  const [selectedBarangay, setSelectedBarangay] =
    useState<BarangayDistributionEntry | null>(null);
  const [listOpen, setListOpen] = useState(false);

  function handleSelectFromDeployment(d: RecentDeploymentEntry) {
    const match = barangayDistribution.find(
      (b) => b.name === d.barangayName && b.municipality === d.municipality
    );
    if (match) {
      setSelectedBarangay(match);
      setListOpen(false);
    }
  }

  const stats = [
    { label: t("Deployments.totalDeliveries"), value: totalDeliveries },
    { label: t("Deployments.peopleServed"), value: peopleServed },
    { label: t("Deployments.barangaysReached"), value: barangaysReached },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Map */}
      {barangayDistribution.length > 0 ? (
        <Suspense fallback={<MapSkeleton />}>
          <BarangayBubbleMap
            barangays={barangayDistribution}
            selectedId={selectedBarangay?.id ?? null}
            onSelect={setSelectedBarangay}
          />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center bg-base/30">
          <p className="text-sm text-neutral-400/60">
            {t("Deployments.noData")}
          </p>
        </div>
      )}

      {/* Stats pills — top center */}
      <div className="absolute left-2 right-2 top-3 z-[500] flex items-center justify-center gap-1.5 lg:left-[340px] lg:right-[340px] lg:top-4 lg:gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-1.5 rounded-full bg-secondary/85 px-2 py-0.5 backdrop-blur-sm lg:px-3 lg:py-1"
          >
            <span className="text-xs font-medium text-neutral-50 lg:text-sm">
              {s.value.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400 lg:text-sm">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Left detail panel — desktop */}
      {selectedBarangay && (
        <div className="absolute bottom-4 left-4 top-4 z-[500] hidden w-[320px] flex-col overflow-hidden rounded-xl bg-secondary/90 backdrop-blur-sm lg:flex">
          <BarangayDetailPanel
            barangay={selectedBarangay}
            onClose={() => setSelectedBarangay(null)}
            variant="panel"
          />
        </div>
      )}

      {/* Right sidebar — desktop */}
      <div className="absolute bottom-4 right-4 top-4 z-[500] hidden w-[320px] flex-col overflow-hidden rounded-xl bg-secondary/90 backdrop-blur-sm lg:flex">
        <h3 className="border-b border-neutral-400/20 px-4 py-3 text-sm font-semibold text-neutral-50">
          {t("Deployments.recentDeployments")}
        </h3>
        <div className="flex-1 divide-y divide-neutral-400/10 overflow-y-auto">
          {recentDeployments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-400/60">
              {t("Deployments.noData")}
            </p>
          ) : (
            recentDeployments.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelectFromDeployment(d)}
                className="flex w-full items-start justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-400/10"
              >
                <div>
                  <p className="text-sm text-neutral-50">
                    {d.categoryIcon && `${d.categoryIcon} `}
                    {d.categoryName}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {d.orgName} &rarr; {d.barangayName}, {d.municipality}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-neutral-50">
                    {d.quantity?.toLocaleString() ?? "—"} {d.unit ?? ""}
                  </p>
                  <p className="text-xs text-neutral-400">{d.date ?? ""}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Mobile FAB — recent deployments */}
      <button
        onClick={() => setListOpen(true)}
        aria-label={t("Deployments.recentDeployments")}
        className="absolute bottom-4 right-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-neutral-50 shadow-lg lg:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {recentDeployments.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-neutral-50">
            {recentDeployments.length}
          </span>
        )}
      </button>

      {/* Mobile bottom sheet — recent deployments */}
      {listOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setListOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label={t("Deployments.recentDeployments")}
            className="fixed inset-x-0 bottom-0 z-[1000] max-h-[60vh] animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="text-sm font-semibold text-neutral-50">
                {t("Deployments.recentDeployments")}
              </h3>
              <button
                onClick={() => setListOpen(false)}
                aria-label={t("PinDetail.close")}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div
              className="divide-y divide-neutral-400/20 overflow-y-auto px-5 pb-5"
              style={{ maxHeight: "calc(60vh - 4rem)" }}
            >
              {recentDeployments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleSelectFromDeployment(d)}
                  className="flex w-full items-start justify-between py-3 text-left transition-colors hover:bg-neutral-400/10"
                >
                  <div>
                    <p className="text-sm text-neutral-50">
                      {d.categoryIcon && `${d.categoryIcon} `}
                      {d.categoryName}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {d.orgName} &rarr; {d.barangayName}, {d.municipality}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-50">
                      {d.quantity?.toLocaleString() ?? "—"} {d.unit ?? ""}
                    </p>
                    <p className="text-xs text-neutral-400">{d.date ?? ""}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom sheet — barangay detail */}
      {selectedBarangay && (
        <div className="lg:hidden">
          <BarangayDetailPanel
            barangay={selectedBarangay}
            onClose={() => setSelectedBarangay(null)}
            variant="sheet"
          />
        </div>
      )}
    </div>
  );
}
