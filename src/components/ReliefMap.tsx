import { Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import MapSkeleton from "@/components/maps/MapSkeleton";
import MapLegend, { type LayerVisibility } from "@/components/MapLegend";
import PinDetailSheet from "@/components/PinDetailSheet";
import HubDetailPanel from "@/components/HubDetailPanel";
import HazardDetailPanel from "@/components/HazardDetailPanel";
import { lazyWithReload } from "@/lib/lazy-reload";
import type { NeedPoint, HubPoint, HazardPoint } from "@/lib/queries";

const ReliefMapLeaflet = lazyWithReload(
  () => import("@/components/maps/ReliefMapLeaflet")
);

type Props = {
  needsPoints: NeedPoint[];
  hubs: HubPoint[];
  hazards: HazardPoint[];
};

type Selected =
  | { type: "need"; data: NeedPoint }
  | { type: "hub"; data: HubPoint }
  | { type: "hazard"; data: HazardPoint }
  | null;

export default function ReliefMap({ needsPoints, hubs, hazards }: Props) {
  const { t } = useTranslation();
  const [layers, setLayers] = useState<LayerVisibility>({
    needs: true,
    hubs: true,
    hazards: true,
  });
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Selected>(null);

  // Apply local status overrides
  const allPoints = useMemo(
    () =>
      needsPoints.map((p) =>
        statusOverrides[p.id] ? { ...p, status: statusOverrides[p.id] } : p
      ),
    [needsPoints, statusOverrides]
  );

  // Summary counts
  const activeNeedsCount = allPoints.filter(
    (p) => p.status === "verified" || p.status === "in_transit"
  ).length;

  function toggleLayer(layer: keyof LayerVisibility) {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  function handleStatusChange(id: string, newStatus: string) {
    setStatusOverrides((prev) => ({ ...prev, [id]: newStatus }));
    setSelected((prev) =>
      prev?.type === "need" && prev.data.id === id
        ? { type: "need", data: { ...prev.data, status: newStatus } }
        : prev
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Map */}
      <Suspense fallback={<MapSkeleton />}>
        <ReliefMapLeaflet
          needsPoints={allPoints}
          hubs={hubs}
          hazards={hazards}
          visibleLayers={layers}
          onNeedSelect={(p: NeedPoint) => setSelected({ type: "need", data: p })}
          onHubSelect={(h: HubPoint) => setSelected({ type: "hub", data: h })}
          onHazardSelect={(h: HazardPoint) => setSelected({ type: "hazard", data: h })}
        />
      </Suspense>

      {/* Summary bar — top center */}
      <div className="absolute left-2 right-2 top-3 z-[500] flex items-center justify-center lg:top-4">
        <div className="flex items-center gap-3 rounded-full border border-neutral-400/20 bg-secondary/90 px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.3)] backdrop-blur-sm lg:gap-4 lg:px-4 lg:py-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-error" />
            <span className="text-xs font-semibold text-neutral-50 lg:text-sm">{activeNeedsCount}</span>
            <span className="text-xs text-neutral-400 lg:text-sm">{t("ReliefMap.activeNeeds")}</span>
          </span>
          <span className="text-neutral-400/40">·</span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" className="shrink-0">
              <path d="M12 3L2 12h3v8h14v-8h3L12 3z" fill="var(--color-primary)" stroke="var(--color-neutral-50)" strokeWidth="1.5"/>
            </svg>
            <span className="text-xs font-semibold text-neutral-50 lg:text-sm">{hubs.length}</span>
            <span className="text-xs text-neutral-400 lg:text-sm">{t("ReliefMap.hubs")}</span>
          </span>
          <span className="text-neutral-400/40">·</span>
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="11" viewBox="0 0 24 22" className="shrink-0">
              <path d="M12 2L1 21h22L12 2z" fill="var(--color-warning)" stroke="var(--color-neutral-50)" strokeWidth="1"/>
              <text x="12" y="18" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--color-base)">!</text>
            </svg>
            <span className="text-xs font-semibold text-neutral-50 lg:text-sm">{hazards.length}</span>
            <span className="text-xs text-neutral-400 lg:text-sm">{t("ReliefMap.hazards")}</span>
          </span>
        </div>
      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-4 left-4 z-[500]">
        <MapLegend layers={layers} onToggle={toggleLayer} />
      </div>

      {/* Desktop detail panel — right side */}
      {selected && (
        <div className="absolute bottom-4 right-4 top-4 z-[500] hidden w-[320px] flex-col overflow-hidden rounded-xl bg-secondary/90 backdrop-blur-sm lg:flex">
          <div className="flex-1 overflow-y-auto p-4">
            {selected.type === "need" && (
              <PinDetailSheet
                point={selected.data}
                onClose={() => setSelected(null)}
                onStatusChange={handleStatusChange}
                variant="panel"
              />
            )}
            {selected.type === "hub" && (
              <HubDetailPanel
                hub={selected.data}
                onClose={() => setSelected(null)}
                variant="panel"
              />
            )}
            {selected.type === "hazard" && (
              <HazardDetailPanel
                hazard={selected.data}
                onClose={() => setSelected(null)}
                variant="panel"
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile: bottom sheet for selected item */}
      {selected && (
        <div className="lg:hidden">
          {selected.type === "need" && (
            <PinDetailSheet
              point={selected.data}
              onClose={() => setSelected(null)}
              onStatusChange={handleStatusChange}
            />
          )}
          {selected.type === "hub" && (
            <HubDetailPanel
              hub={selected.data}
              onClose={() => setSelected(null)}
            />
          )}
          {selected.type === "hazard" && (
            <HazardDetailPanel
              hazard={selected.data}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
