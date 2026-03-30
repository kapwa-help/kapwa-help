import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { NeedPoint } from "@/lib/queries";

// Pin colors by status — the core visual language of the scope
const STATUS_COLORS: Record<string, string> = {
  verified: "var(--color-error)",      // Red: urgent, needs response
  in_transit: "var(--color-warning)",  // Amber: help is coming
  completed: "var(--color-success)",   // Green: fulfilled
};

function makeIcon(status: string) {
  const color = STATUS_COLORS[status] ?? "var(--color-neutral-400)";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid var(--color-neutral-50);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const ACCESS_KEYS: Record<string, string> = {
  truck: "Dashboard.accessTruck",
  "4x4": "Dashboard.access4x4",
  boat: "Dashboard.accessBoat",
  foot_only: "Dashboard.accessFootOnly",
  cut_off: "Dashboard.accessCutOff",
};

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type Props = {
  points: NeedPoint[];
};

export default function NeedsMap({ points }: Props) {
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
          >
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-semibold">{point.barangayName}, {point.municipality}</p>
                <p>{point.categoryName} — {t(`Dashboard.urgency_${point.urgency ?? "unset"}`, point.urgency ?? t("Dashboard.unset"))}</p>
                {point.accessStatus && (
                  <p className="text-xs">
                    {t("Dashboard.accessLabel")}: <strong>{ACCESS_KEYS[point.accessStatus] ? t(ACCESS_KEYS[point.accessStatus]) : point.accessStatus}</strong>
                  </p>
                )}
                {point.quantityNeeded && (
                  <p className="text-xs">{t("Dashboard.familyCount", { count: point.quantityNeeded })}</p>
                )}
                {point.notes && <p className="text-xs italic">{point.notes}</p>}
              </div>
            </Popup>
          </Marker>
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
