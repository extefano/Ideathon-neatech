'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';

const TILES = (
  <TileLayer
    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    attribution="Tiles: Esri World Imagery"
  />
);

export default function MapaPoligono({
  poligono,
  altura = 'h-64',
}: {
  poligono: unknown;
  altura?: string;
}) {
  const ring =
    (poligono as { coordinates?: number[][][] } | null)?.coordinates?.[0]?.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    ) ?? [];

  const centro: LatLngExpression = ring[0] ?? [-29.19, -58.08];

  return (
    <div className={`border-borde-fuerte overflow-hidden rounded-md border ${altura}`}>
      {ring.length >= 3 ? (
        <MapContainer
          bounds={ring}
          boundsOptions={{ padding: [28, 28], maxZoom: 15 }}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          {TILES}
          <Polygon positions={ring} pathOptions={{ color: '#FDDA24', weight: 2 }} />
        </MapContainer>
      ) : (
        <MapContainer center={centro} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
          {TILES}
        </MapContainer>
      )}
    </div>
  );
}
