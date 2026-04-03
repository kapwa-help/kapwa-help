import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";
import PinDetailSheet from "@/components/PinDetailSheet";
import { lazyWithReload } from "@/lib/lazy-reload";
import type { NeedPoint } from "@/lib/queries";

const NeedsMap = lazyWithReload(() => import("@/components/maps/NeedsMap"));

type Props = {
  needsPoints: NeedPoint[];
};

const ACCESS_KEYS: Record<string, string> = {
  truck: "Dashboard.accessTruck",
  "4x4": "Dashboard.access4x4",
  boat: "Dashboard.accessBoat",
  foot_only: "Dashboard.accessFootOnly",
  cut_off: "Dashboard.accessCutOff",
};

const ACCESS_FILTERS = [
  { value: "all", label: "Dashboard.allAccess" },
  { value: "truck", label: "Dashboard.accessTruck" },
  { value: "4x4", label: "Dashboard.access4x4" },
  { value: "boat", label: "Dashboard.accessBoat" },
  { value: "foot_only", label: "Dashboard.accessFootOnly" },
  { value: "cut_off", label: "Dashboard.accessCutOff" },
] as const;

export default function NeedsCoordinationMap({ needsPoints }: Props) {
  const { t } = useTranslation();
  const [accessFilter, setAccessFilter] = useState("all");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [selectedPoint, setSelectedPoint] = useState<NeedPoint | null>(null);

  const points = needsPoints.map((p) =>
    statusOverrides[p.id] ? { ...p, status: statusOverrides[p.id] } : p
  );

  const filtered =
    accessFilter === "all"
      ? points
      : points.filter((p) => p.accessStatus === accessFilter);

  function handleStatusChange(id: string, newStatus: string) {
    setStatusOverrides((prev) => ({ ...prev, [id]: newStatus }));
    setSelectedPoint((prev) =>
      prev?.id === id ? { ...prev, status: newStatus } : prev
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-50">
          {t("Dashboard.needsMap")}
        </h3>
        <span className="rounded-full bg-error/20 px-3 py-1 text-xs font-medium text-error">
          {t("Dashboard.liveNeeds")}
        </span>
      </div>

      {/* Access filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ACCESS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setAccessFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              accessFilter === f.value
                ? "bg-primary text-neutral-50"
                : "bg-base text-neutral-400 hover:text-neutral-50"
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map (2/3 width) */}
        <div className="lg:col-span-2">
          {filtered.length > 0 ? (
            <Suspense fallback={<MapSkeleton />}>
              <NeedsMap points={filtered} onPinSelect={setSelectedPoint} />
            </Suspense>
          ) : (
            <div className="flex h-[28rem] items-center justify-center rounded-lg bg-base/30">
              <p className="text-sm text-neutral-400/60">
                {t("Dashboard.noNeedsData")}
              </p>
            </div>
          )}
        </div>

        {/* Legend + summary sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Status legend */}
          <div className="rounded-lg bg-base/30 p-4">
            <h4 className="mb-3 text-sm font-medium text-neutral-50">
              {t("Dashboard.pinStatus")}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-error" />
                <span className="text-xs text-neutral-400">{t("Dashboard.statusVerified")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-warning" />
                <span className="text-xs text-neutral-400">{t("Dashboard.statusInTransit")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-success" />
                <span className="text-xs text-neutral-400">{t("Dashboard.statusCompleted")}</span>
              </div>
            </div>
          </div>

          {/* Needs list */}
          <div className="divide-y divide-neutral-400/20 overflow-y-auto lg:max-h-[20rem]">
            {filtered.map((need) => (
              <div
                key={need.id}
                className="flex items-start justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      need.status === "verified"
                        ? "bg-error"
                        : need.status === "in_transit"
                          ? "bg-warning"
                          : "bg-success"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-neutral-50">
                      {need.barangayName}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {need.gapCategory ?? t("Dashboard.unset")}
                      {need.accessStatus && ACCESS_KEYS[need.accessStatus] && ` · ${t(ACCESS_KEYS[need.accessStatus])}`}
                    </p>
                  </div>
                </div>
                {need.urgency === "critical" && (
                  <span className="rounded bg-error/20 px-2 py-0.5 text-xs font-medium text-error">
                    {t("Dashboard.critical")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedPoint && (
        <PinDetailSheet
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
