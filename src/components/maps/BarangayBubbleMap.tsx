import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import type { BarangayDistributionEntry } from "@/lib/cache";

function makeLabelIcon(name: string, isSelected: boolean) {
  const dot = isSelected ? "var(--color-accent)" : "var(--color-primary)";
  const ring = isSelected ? "var(--color-accent)" : "var(--color-neutral-50)";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;gap:6px;white-space:nowrap">
      <div style="width:12px;height:12px;border-radius:50%;background:${dot};border:2px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.4);flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8),0 0 6px rgba(0,0,0,0.6)">${name}</span>
    </div>`,
    iconSize: [120, 16],
    iconAnchor: [6, 8],
  });
}

const DEFAULT_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const TILE_ERROR_THRESHOLD = 3;

type Props = {
  barangays: BarangayDistributionEntry[];
  selectedId: string | null;
  onSelect: (barangay: BarangayDistributionEntry) => void;
};

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 13, { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

export default function BarangayBubbleMap({ barangays, selectedId, onSelect }: Props) {
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

  const selected = barangays.find((b) => b.id === selectedId);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: handleTileError,
            tileload: handleTileLoad,
          }}
        />
        {barangays.map((brgy) => (
          <Marker
            key={brgy.id}
            position={[brgy.lat, brgy.lng]}
            icon={makeLabelIcon(brgy.name, brgy.id === selectedId)}
            eventHandlers={{ click: () => onSelect(brgy) }}
          />
        ))}
        {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}
      </MapContainer>
      {tilesUnavailable && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center bg-base/80"
        >
          <p className="text-sm text-neutral-400">
            {t("Dashboard.mapTilesUnavailable")}
          </p>
        </div>
      )}
    </div>
  );
}
