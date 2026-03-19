import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const MARKER_ICON = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:var(--color-error);border:2px solid var(--color-neutral-50);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type DeploymentPoint = {
  lat: number;
  lng: number;
  quantity: number | null;
  unit: string | null;
  orgName: string;
  categoryName: string;
};

type Props = {
  points: DeploymentPoint[];
};

export default function DeploymentMap({ points }: Props) {
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
    <div className="relative h-[24rem] overflow-hidden rounded-lg">
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
        {points.map((point, i) => (
          <Marker key={i} position={[point.lat, point.lng]} icon={MARKER_ICON}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{point.orgName}</p>
                <p>{point.categoryName}</p>
                {point.quantity != null && (
                  <p>
                    {point.quantity.toLocaleString()} {point.unit}
                  </p>
                )}
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
