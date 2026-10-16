'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { MapContainer, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';

function ClickHandler({ onAgregar }: { onAgregar: (punto: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onAgregar([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

export default function MapaDibujo({
  puntos,
  onAgregar,
}: {
  puntos: [number, number][];
  onAgregar: (punto: [number, number]) => void;
}) {
  const centro: LatLngExpression = puntos.length > 0 ? puntos[0] : [-29.19, -58.08];
  const positions: LatLngExpression[] = puntos;

  return (
    <div className="h-80 overflow-hidden rounded-md border border-neutral-700">
      <MapContainer center={centro} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles: Esri World Imagery"
        />
        <ClickHandler onAgregar={onAgregar} />
        {puntos.length >= 3 ? (
          <Polygon positions={positions} pathOptions={{ color: '#FDDA24', weight: 2 }} />
        ) : (
          <Polyline positions={positions} pathOptions={{ color: '#FDDA24', weight: 2 }} />
        )}
      </MapContainer>
    </div>
  );
}
