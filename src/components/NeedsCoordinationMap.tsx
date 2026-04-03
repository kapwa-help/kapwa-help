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
  pending: 0,
  verified: 1,
  in_transit: 2,
  completed: 3,
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

const STATUS_DOT: Record<string, string> = {
  pending: "bg-neutral-400",
  verified: "bg-error",
  in_transit: "bg-primary",
  completed: "bg-success",
};

const LEGEND_ITEMS = [
  { status: "pending", dot: "bg-neutral-400", label: "Dashboard.statusPending" },
  { status: "verified", dot: "bg-error", label: "Dashboard.statusVerified" },
  { status: "in_transit", dot: "bg-primary", label: "Dashboard.statusInTransit" },
] as const;

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

  // Map pins: only actionable statuses
  const mapPoints = useMemo(
    () => allPoints.filter((p) => p.status !== "completed"),
    [allPoints]
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
    const c: Record<string, number> = { pending: 0, verified: 0, in_transit: 0 };
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
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-50">
          {t("Dashboard.needsMap")}
        </h3>
        <span className="rounded-full bg-error/20 px-3 py-1 text-xs font-medium text-error">
          {t("Dashboard.liveNeeds")}
        </span>
      </div>

      {/* Horizontal legend with counts */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${item.dot}`} />
            <span className="text-xs text-neutral-400">
              {counts[item.status]} {t(item.label)}
            </span>
          </div>
        ))}
      </div>

      {/* Map + Sidebar grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map (2/3 width) */}
        <div className="lg:col-span-2">
          {mapPoints.length > 0 ? (
            <Suspense fallback={<MapSkeleton />}>
              <NeedsMap points={mapPoints} onPinSelect={setSelectedPoint} />
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
            <div className="hidden lg:block">
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
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[need.status] ?? "bg-neutral-400"}`}
                    />
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
                  {need.urgency && (
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
