import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import type { NeedPoint } from "@/lib/queries";

const STATUS_COLORS: Record<string, string> = {
  verified: "var(--color-error)",
  in_transit: "var(--color-warning)",
  completed: "var(--color-success)",
};

function makeIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "var(--color-neutral-400)";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid var(--color-neutral-50);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type Props = {
  points: NeedPoint[];
  onPinSelect: (point: NeedPoint) => void;
};

export default function NeedsMap({ points, onPinSelect }: Props) {
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
    <div className="relative h-[28rem] overflow-hidden rounded-lg">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: handleTileError,
            tileload: handleTileLoad,
          }}
        />
        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={makeIcon(point.status)}
            eventHandlers={{ click: () => onPinSelect(point) }}
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
