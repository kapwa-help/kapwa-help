import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { NeedPoint, HubPoint, HazardPoint } from "@/lib/queries";

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--color-neutral-400)",
  verified: "var(--color-error)",
  in_transit: "var(--color-warning)",
  confirmed: "var(--color-primary)",
};

function makeNeedIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "var(--color-neutral-400)";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid var(--color-neutral-50);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeHubIcon() {
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
      <path d="M12 3L2 12h3v8h14v-8h3L12 3z" fill="var(--color-primary)" stroke="var(--color-neutral-50)" stroke-width="1.5"/>
    </svg>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function makeHazardIcon() {
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="20" viewBox="0 0 24 22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
      <path d="M12 2L1 21h22L12 2z" fill="var(--color-warning)" stroke="var(--color-neutral-50)" stroke-width="1"/>
      <text x="12" y="18" text-anchor="middle" font-size="14" font-weight="bold" fill="var(--color-base)">!</text>
    </svg>`,
    iconSize: [22, 20],
    iconAnchor: [11, 20],
  });
}

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type Props = {
  needsPoints: NeedPoint[];
  hubs: HubPoint[];
  hazards: HazardPoint[];
  visibleLayers: { needs: boolean; hubs: boolean; hazards: boolean };
  onNeedSelect: (point: NeedPoint) => void;
  onHubSelect: (hub: HubPoint) => void;
  onHazardSelect: (hazard: HazardPoint) => void;
};

export default function ReliefMapLeaflet({
  needsPoints,
  hubs,
  hazards,
  visibleLayers,
  onNeedSelect,
  onHubSelect,
  onHazardSelect,
}: Props) {
  const { t } = useTranslation();
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const errorCount = useRef(0);

  const handleTileError = useCallback(() => {
    errorCount.current += 1;
    if (errorCount.current >= TILE_ERROR_THRESHOLD) {
      setTilesUnavailable(true);
    }
  }, []);

  const handleTileLoad = useCallback(() => {
    errorCount.current = 0;
    setTilesUnavailable(false);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: handleTileError,
            tileload: handleTileLoad,
          }}
        />

        {/* Needs markers */}
        {visibleLayers.needs &&
          needsPoints.map((point) => (
            <Marker
              key={`need-${point.id}`}
              position={[point.lat, point.lng]}
              icon={makeNeedIcon(point.status)}
              eventHandlers={{ click: () => onNeedSelect(point) }}
            />
          ))}

        {/* Hub markers */}
        {visibleLayers.hubs &&
          hubs.map((hub) => (
            <Marker
              key={`hub-${hub.id}`}
              position={[hub.lat, hub.lng]}
              icon={makeHubIcon()}
              eventHandlers={{ click: () => onHubSelect(hub) }}
            />
          ))}

        {/* Hazard markers */}
        {visibleLayers.hazards &&
          hazards.map((hazard) => (
            <Marker
              key={`hazard-${hazard.id}`}
              position={[hazard.lat, hazard.lng]}
              icon={makeHazardIcon()}
              eventHandlers={{ click: () => onHazardSelect(hazard) }}
            />
          ))}
      </MapContainer>
      {tilesUnavailable && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center bg-base/80"
        >
          <p className="text-neutral-400 text-sm">
            {t("Dashboard.mapTilesUnavailable")}
          </p>
        </div>
      )}
    </div>
  );
}
