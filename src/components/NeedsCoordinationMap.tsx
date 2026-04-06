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
  const [listOpen, setListOpen] = useState(false);

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
    <div className="relative flex h-full w-full flex-col">
      {/* Map fills entire container */}
      {allPoints.length > 0 ? (
        <Suspense fallback={<MapSkeleton />}>
          <NeedsMap points={allPoints} onPinSelect={setSelectedPoint} />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center bg-base/30">
          <p className="text-sm text-neutral-400/60">
            {t("Dashboard.noNeedsData")}
          </p>
        </div>
      )}

      {/* Status pills overlay — top */}
      <div className="absolute left-2 right-2 top-3 z-[500] flex items-center justify-center gap-1.5 lg:left-4 lg:right-[340px] lg:top-4 lg:gap-2">
        {STATUS_CONFIG.map((item) => (
          <div key={item.status} className="flex items-center gap-1 rounded-full bg-secondary/85 px-2 py-0.5 backdrop-blur-sm lg:gap-1.5 lg:px-3 lg:py-1">
            <span className={`h-2 w-2 rounded-full lg:h-2.5 lg:w-2.5 ${item.dot}`} />
            <span className="text-xs text-neutral-400 lg:text-sm">
              {counts[item.status]} {t(item.label)}
            </span>
          </div>
        ))}
      </div>

      {/* Sidebar overlay — right (desktop only) */}
      <div className="absolute bottom-4 right-4 top-4 z-[500] hidden w-[320px] flex-col overflow-hidden rounded-xl bg-secondary/90 backdrop-blur-sm lg:flex">
        {selectedPoint ? (
          <div className="flex-1 overflow-y-auto p-4">
            <PinDetailSheet
              point={selectedPoint}
              onClose={() => setSelectedPoint(null)}
              onStatusChange={handleStatusChange}
              variant="panel"
            />
          </div>
        ) : (
          <div className="flex-1 divide-y divide-neutral-400/20 overflow-y-auto">
            {sortedPoints.map((need) => (
              <button
                key={need.id}
                onClick={() => setSelectedPoint(need)}
                className="flex w-full items-start justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-400/10"
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
                      {need.aidCategoryIcon ? `${need.aidCategoryIcon} ` : ""}{need.aidCategoryName ?? t("Dashboard.unset")}
                      {need.accessStatus && ACCESS_KEYS[need.accessStatus] && ` · ${t(ACCESS_KEYS[need.accessStatus])}`}
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
        )}
      </div>

      {/* Mobile: list toggle button — bottom left */}
      <button
        onClick={() => setListOpen(true)}
        aria-label={t("Dashboard.showNeedsList")}
        className="absolute bottom-4 left-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-neutral-50 shadow-lg lg:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        {allPoints.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-neutral-50">
            {allPoints.length}
          </span>
        )}
      </button>

      {/* Mobile: needs list bottom sheet */}
      {listOpen && (
        <div className="lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setListOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label={t("Dashboard.needsList")}
            className="fixed inset-x-0 bottom-0 z-[1000] max-h-[60vh] animate-slide-up rounded-t-2xl border border-neutral-400/20 bg-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-neutral-400/40" />
            </div>
            {/* Header with close */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="text-sm font-semibold text-neutral-50">{t("Dashboard.needsMap")}</h3>
              <button
                onClick={() => setListOpen(false)}
                aria-label={t("PinDetail.close")}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {/* Scrollable list */}
            <div className="divide-y divide-neutral-400/20 overflow-y-auto px-5 pb-5" style={{ maxHeight: "calc(60vh - 4rem)" }}>
              {sortedPoints.map((need) => (
                <button
                  key={need.id}
                  onClick={() => { setListOpen(false); setSelectedPoint(need); }}
                  className="flex w-full items-start justify-between py-3 text-left transition-colors hover:bg-neutral-400/10"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_MAP[need.status]?.dot ?? "bg-neutral-400"}`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className={`text-sm ${need.status === "completed" ? "text-neutral-400" : "text-neutral-50"}`}>
                        {need.barangayName}
                      </p>
                      <p className={`text-xs ${need.status === "completed" ? "text-neutral-400/60" : "text-neutral-400"}`}>
                        {need.aidCategoryIcon ? `${need.aidCategoryIcon} ` : ""}{need.aidCategoryName ?? t("Dashboard.unset")}
                        {need.accessStatus && ACCESS_KEYS[need.accessStatus] && ` · ${t(ACCESS_KEYS[need.accessStatus])}`}
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
      )}

      {/* Mobile: pin detail bottom sheet (existing behavior) */}
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
