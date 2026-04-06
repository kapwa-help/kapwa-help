import { Suspense, useMemo, useState } from "react";
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

const STATUS_PRIORITY: Record<string, number> = {
  verified: 0,
  in_transit: 1,
  completed: 2,
  pending: 3,
};

const URGENCY_PRIORITY: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const URGENCY_STYLES: Record<string, string> = {
  critical: "bg-error/20 text-error",
  high: "bg-warning/20 text-warning",
  medium: "bg-neutral-400/20 text-neutral-400",
  low: "bg-neutral-400/10 text-neutral-400/60",
};

const STATUS_CONFIG = [
  { status: "verified", dot: "bg-error", label: "Dashboard.statusVerified" },
  { status: "in_transit", dot: "bg-warning", label: "Dashboard.statusInTransit" },
  { status: "completed", dot: "bg-success", label: "Dashboard.statusCompleted" },
  { status: "pending", dot: "bg-neutral-400", label: "Dashboard.statusPending" },
] as const;

const STATUS_MAP: Record<string, { dot: string; label: string }> = Object.fromEntries(
  STATUS_CONFIG.map((s) => [s.status, { dot: s.dot, label: s.label }])
);

export default function NeedsCoordinationMap({ needsPoints }: Props) {
  const { t } = useTranslation();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [selectedPoint, setSelectedPoint] = useState<NeedPoint | null>(null);

  // Apply local status overrides
  const allPoints = useMemo(
    () =>
      needsPoints.map((p) =>
        statusOverrides[p.id] ? { ...p, status: statusOverrides[p.id] } : p
      ),
    [needsPoints, statusOverrides]
  );

  // Sidebar: all points, sorted by status priority then urgency
  const sortedPoints = useMemo(() => {
    return [...allPoints].sort((a, b) => {
      const statusDiff =
        (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return (
        (URGENCY_PRIORITY[a.urgency ?? "low"] ?? 99) -
        (URGENCY_PRIORITY[b.urgency ?? "low"] ?? 99)
      );
    });
  }, [allPoints]);

  // Legend counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, verified: 0, in_transit: 0, completed: 0 };
    for (const p of allPoints) {
      if (p.status in c) c[p.status]++;
    }
    return c;
  }, [allPoints]);

  function handleStatusChange(id: string, newStatus: string) {
    setStatusOverrides((prev) => ({ ...prev, [id]: newStatus }));
    setSelectedPoint((prev) =>
      prev?.id === id ? { ...prev, status: newStatus } : prev
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      {/* Header + inline legend */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
        <h3 className="w-full text-center text-lg font-semibold text-neutral-50 lg:w-auto lg:text-left lg:text-xl">
          {t("Dashboard.needsMap")}
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
          {STATUS_CONFIG.map((item) => (
            <div key={item.status} className="flex items-center gap-1.5 rounded-full bg-base/30 px-3 py-1">
              <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
              <span className="text-xs text-neutral-400 lg:text-sm">
                {counts[item.status]} {t(item.label)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Map + Sidebar grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map (2/3 width) */}
        <div className="lg:col-span-2">
          {allPoints.length > 0 ? (
            <Suspense fallback={<MapSkeleton />}>
              <NeedsMap points={allPoints} onPinSelect={setSelectedPoint} />
            </Suspense>
          ) : (
            <div className="flex h-[28rem] items-center justify-center rounded-lg bg-base/30">
              <p className="text-sm text-neutral-400/60">
                {t("Dashboard.noNeedsData")}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Desktop: pin detail replaces sidebar content */}
          {selectedPoint ? (
            <div className="hidden lg:block lg:max-h-[28rem] lg:overflow-y-auto">
              <PinDetailSheet
                point={selectedPoint}
                onClose={() => setSelectedPoint(null)}
                onStatusChange={handleStatusChange}
                variant="panel"
              />
            </div>
          ) : null}

          {/* Needs list (hidden on desktop when detail panel is open) */}
          <div className={selectedPoint ? "lg:hidden" : ""}>
            <div className="divide-y divide-neutral-400/20 overflow-y-auto lg:max-h-[28rem]">
              {sortedPoints.map((need) => (
                <button
                  key={need.id}
                  onClick={() => setSelectedPoint(need)}
                  className="flex w-full items-start justify-between py-3 text-left transition-colors hover:bg-neutral-400/10 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_MAP[need.status]?.dot ?? "bg-neutral-400"}`}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{t(STATUS_MAP[need.status]?.label ?? "Dashboard.statusPending")}</span>
                    <div>
                      <p className={`text-sm ${need.status === "completed" ? "text-neutral-400" : "text-neutral-50"}`}>
                        {need.barangayName}
                      </p>
                      <p className={`text-xs ${need.status === "completed" ? "text-neutral-400/60" : "text-neutral-400"}`}>
                        {need.gapCategory ?? t("Dashboard.unset")}
                        {need.accessStatus && ACCESS_KEYS[need.accessStatus] && ` \u00b7 ${t(ACCESS_KEYS[need.accessStatus])}`}
                      </p>
                    </div>
                  </div>
                  {need.urgency && need.urgency in URGENCY_STYLES && (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[need.urgency] ?? URGENCY_STYLES.low}`}>
                      {t(`Dashboard.urgency${need.urgency.charAt(0).toUpperCase()}${need.urgency.slice(1)}`)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: bottom sheet overlay */}
      {selectedPoint && (
        <div className="lg:hidden">
          <PinDetailSheet
            point={selectedPoint}
            onClose={() => setSelectedPoint(null)}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}
    </div>
  );
}
