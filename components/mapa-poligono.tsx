'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';
import { UbicacionMapa } from './ubicacion-mapa';

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
      <MapContainer center={centro} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles: Esri World Imagery"
        />
        {ring.length >= 3 && (
          <Polygon positions={ring} pathOptions={{ color: '#FDDA24', weight: 2 }} />
        )}
        <UbicacionMapa poligono={ring.length >= 3 ? ring : undefined} />
      </MapContainer>
    </div>
  );
}
