import { useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const LA_UNION_CENTER: L.LatLngTuple = [16.62, 120.35];
const DEFAULT_ZOOM = 11;
const PLACED_ZOOM = 14;

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#007EA7;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface Props {
  coords: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  readOnly?: boolean;
}

function MapClickHandler({ onChange }: Pick<Props, "onChange">) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function validCoords(coords: { lat: number; lng: number } | null): coords is { lat: number; lng: number } {
  return coords != null && Number.isFinite(coords.lat) && Number.isFinite(coords.lng);
}

function FlyToCoords({ coords }: { coords: { lat: number; lng: number } | null }) {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    if (!validCoords(coords) || hasFlown.current) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    hasFlown.current = true;
    map.flyTo([coords.lat, coords.lng], PLACED_ZOOM, { duration: 0.8 });
  }, [map, coords]);

  return null;
}

export default function LocationPicker({ coords, onChange, readOnly }: Props) {
  const safe = validCoords(coords);

  const handleDragEnd = useCallback(
    (e: L.DragEndEvent) => {
      const latlng = (e.target as L.Marker).getLatLng();
      onChange({ lat: latlng.lat, lng: latlng.lng });
    },
    [onChange],
  );

  return (
    <MapContainer
      center={safe ? [coords.lat, coords.lng] : LA_UNION_CENTER}
      zoom={safe ? PLACED_ZOOM : DEFAULT_ZOOM}
      zoomControl={false}
      className="h-full w-full rounded-xl"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {!readOnly && <MapClickHandler onChange={onChange} />}
      <FlyToCoords coords={coords} />
      {safe && (
        <Marker
          position={[coords.lat, coords.lng]}
          icon={pinIcon}
          draggable={!readOnly}
          eventHandlers={readOnly ? {} : { dragend: handleDragEnd }}
        />
      )}
    </MapContainer>
  );
}
