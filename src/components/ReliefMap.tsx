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
          onNeedSelect={(p) => setSelected({ type: "need", data: p })}
          onHubSelect={(h) => setSelected({ type: "hub", data: h })}
          onHazardSelect={(h) => setSelected({ type: "hazard", data: h })}
        />
      </Suspense>

      {/* Summary bar — top center */}
      <div className="absolute left-2 right-2 top-3 z-[500] flex items-center justify-center gap-1.5 lg:top-4 lg:gap-2">
        <div className="flex items-center gap-1 rounded-full bg-secondary/85 px-2 py-0.5 backdrop-blur-sm lg:px-3 lg:py-1">
          <span className="text-xs text-neutral-400 lg:text-sm">
            {activeNeedsCount} {t("ReliefMap.activeNeeds")} · {hubs.length}{" "}
            {t("ReliefMap.hubs")} · {hazards.length} {t("ReliefMap.hazards")}
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
