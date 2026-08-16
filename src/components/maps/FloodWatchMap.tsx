import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, ZoomControl, useMap } from "react-leaflet";
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

const selectedFloodIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:0;border-radius:50%;background:#80CED7;opacity:0.3;animation:flood-ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
    <div style="position:absolute;inset:3px;border-radius:50%;background:#80CED7;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface Props {
  reports: FloodReport[];
  selectedId?: string | null;
  onSelect: (report: FloodReport) => void;
}

function FitApprovedReports({ reports }: Pick<Props, "reports">) {
  const map = useMap();

  useEffect(() => {
    if (reports.length === 0) return;

    const bounds = L.latLngBounds(reports.map((report) => [report.lat, report.lng]));
    if (!bounds.isValid()) return;

    if (reports.length === 1) {
      map.setView(bounds.getCenter(), 13);
      return;
    }

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, reports]);

  return null;
}

export default function FloodWatchMap({ reports, selectedId, onSelect }: Props) {
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
      <FitApprovedReports reports={reports} />
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={report.id === selectedId ? selectedFloodIcon : floodIcon}
          zIndexOffset={report.id === selectedId ? 1000 : 0}
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
