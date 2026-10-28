import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

export interface MapStop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  sequence_order?: number;
}

function readGovPrimary() {
  if (typeof document === "undefined") {
    return "#1351b4";
  }
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--gov-primary")
      .trim() || "#1351b4"
  );
}

function buildStopIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 2px color-mix(in srgb, ${color} 35%, transparent)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ??
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const TILE_ATTRIBUTION =
  (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) {
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
  }, [map, key, points]);

  return null;
}

export function MapView({
  stops,
  height = 340,
  connect = true,
}: {
  stops: MapStop[];
  height?: number;
  connect?: boolean;
}) {
  const primary = useMemo(readGovPrimary, []);
  const icon = useMemo(() => buildStopIcon(primary), [primary]);
  const valid = stops
    .filter(
      (stop): stop is MapStop & { latitude: number; longitude: number } =>
        typeof stop.latitude === "number" && typeof stop.longitude === "number",
    )
    .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

  if (valid.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-sm text-muted-foreground"
        style={{ height }}
      >
        Nenhuma parada com coordenadas cadastradas.
      </div>
    );
  }

  const points = valid.map(
    (stop) => [stop.latitude, stop.longitude] as [number, number],
  );
  const center = points[0];

  return (
    <div style={{ height }} data-testid="map-view">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitBounds points={points} />
        {connect && points.length > 1 && (
          <Polyline positions={points} pathOptions={{ color: primary }} />
        )}
        {valid.map((stop, index) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={icon}
          >
            <Popup>
              <strong>{stop.name}</strong>
              <br />
              Parada {stop.sequence_order ?? index + 1}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
