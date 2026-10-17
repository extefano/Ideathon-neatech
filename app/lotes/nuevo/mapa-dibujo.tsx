'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { UbicacionMapa } from '@/components/ubicacion-mapa';
import { MIN_VERTICES, type Punto } from './dibujo';

function ClickHandler({
  activo,
  onAgregar,
}: {
  activo: boolean;
  onAgregar: (punto: Punto) => void;
}) {
  useMapEvents({
    click(event) {
      if (!activo) return;
      onAgregar([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function ClaseModoDibujo({ activo }: { activo: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle('leaflet-dibujo-activo', activo);
    return () => container.classList.remove('leaflet-dibujo-activo');
  }, [map, activo]);
  return null;
}

export default function MapaDibujo({
  puntos,
  activo,
  onAgregar,
}: {
  puntos: Punto[];
  activo: boolean;
  onAgregar: (punto: Punto) => void;
}) {
  // Centro por defecto dentro del área cubierta por la fuente INH cargada
  // (cuenca piloto del A° Yaguarí), para que dibujar y analizar dé resultado.
  const centro: LatLngExpression = puntos.length > 0 ? puntos[0] : [-29.48, -58.06];
  const positions: LatLngExpression[] = puntos;
  const estilo = {
    color: '#FDDA24',
    weight: 2,
    dashArray: activo ? '6 6' : undefined,
  };

  return (
    <div
      className={`relative h-80 overflow-hidden rounded-md border ${
        activo ? 'border-brand-fuerte ring-brand-fuerte/40 ring-2' : 'border-borde-fuerte'
      }`}
    >
      <MapContainer center={centro} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles: Esri World Imagery"
        />
        <ClaseModoDibujo activo={activo} />
        <ClickHandler activo={activo} onAgregar={onAgregar} />
        <UbicacionMapa poligono={puntos.length >= MIN_VERTICES ? puntos : undefined} />
        {puntos.length >= MIN_VERTICES ? (
          <Polygon positions={positions} pathOptions={estilo} />
        ) : (
          <Polyline positions={positions} pathOptions={estilo} />
        )}
      </MapContainer>
      {activo && (
        <span className="bg-brand pointer-events-none absolute top-2 left-2 z-[1000] rounded px-2 py-1 text-xs font-semibold text-neutral-950 shadow">
          Modo dibujo — clic para agregar vértices
        </span>
      )}
    </div>
  );
}
