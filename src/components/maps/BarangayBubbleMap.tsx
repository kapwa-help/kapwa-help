import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from "react-leaflet";

type BarangayData = {
  id: string;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  categories: { name: string; icon: string | null; total: number }[];
  totalQuantity: number;
};

type Props = {
  barangays: BarangayData[];
};

const LA_UNION_CENTER: [number, number] = [16.67, 120.35];

export default function BarangayBubbleMap({ barangays }: Props) {
  return (
    <MapContainer
      center={LA_UNION_CENTER}
      zoom={11}
      className="h-full w-full rounded-2xl"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {barangays.map((brgy) => (
        <CircleMarker
          key={brgy.id}
          center={[brgy.lat, brgy.lng]}
          radius={Math.max(8, Math.sqrt(brgy.totalQuantity) * 2)}
          pathOptions={{
            fillColor: "#007EA7",
            fillOpacity: 0.6,
            color: "#80CED7",
            weight: 2,
          }}
        >
          <Popup>
            <div style={{ color: "#001A26" }}>
              <h3 className="font-semibold">{brgy.name}, {brgy.municipality}</h3>
              <p className="text-xs">{brgy.totalQuantity.toLocaleString()} total items</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {brgy.categories.map((cat) => (
                  <li key={cat.name}>
                    {cat.icon && `${cat.icon} `}{cat.name}: {cat.total.toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
