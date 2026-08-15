import { MapContainer, TileLayer, Marker, Tooltip, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { FloodReport } from "@/lib/flood-queries";

const LA_UNION_CENTER: [number, number] = [16.62, 120.35];
const DEFAULT_ZOOM = 11;

const floodIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#007EA7;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface Props {
  reports: FloodReport[];
  onSelect: (report: FloodReport) => void;
}

export default function FloodWatchMap({ reports, onSelect }: Props) {
  return (
    <MapContainer
      center={LA_UNION_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ZoomControl position="bottomright" />
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={floodIcon}
          eventHandlers={{ click: () => onSelect(report) }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {report.weatherEvent ?? report.description ?? new Date(report.createdAt).toLocaleDateString()}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
