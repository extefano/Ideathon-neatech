'use client';

import { DomEvent, divIcon } from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Marker, useMap } from 'react-leaflet';
import { mensajeErrorUbicacion, zoomUbicacion, type PosicionUsuario } from './ubicacion';

const OPCIONES_UBICACION: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 30000,
};

const ICONO_USUARIO = divIcon({
  className: '',
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#fdda24;border:2px solid #171717;box-shadow:0 0 0 2px rgba(253,218,36,0.45)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type EstadoUbicacion = 'buscando' | 'ubicado' | 'error';

export function UbicacionMapa({ poligono }: { poligono?: [number, number][] }) {
  const map = useMap();
  const panelRef = useRef<HTMLDivElement>(null);
  const [soportado] = useState(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );
  const [estado, setEstado] = useState<EstadoUbicacion>(soportado ? 'buscando' : 'error');
  const [posicion, setPosicion] = useState<PosicionUsuario | null>(null);
  const [error, setError] = useState<string | null>(
    soportado ? null : 'Tu navegador no admite geolocalización.',
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const primeraBusqueda = useRef(true);
  const interactuo = useRef(false);

  const pedirUbicacion = useCallback(() => {
    if (!soportado) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nueva: PosicionUsuario = {
          lat: coords.latitude,
          lng: coords.longitude,
          precisionMetros: coords.accuracy,
        };
        setPosicion(nueva);
        setEstado('ubicado');
        const centrar = !primeraBusqueda.current || !interactuo.current;
        primeraBusqueda.current = false;
        if (centrar) {
          map.flyTo([nueva.lat, nueva.lng], zoomUbicacion(map.getZoom()), { duration: 0.8 });
        } else {
          setAviso('Encontramos tu ubicación: usá «Mi ubicación» para centrar el mapa.');
        }
      },
      ({ code }) => {
        primeraBusqueda.current = false;
        setEstado('error');
        setError(mensajeErrorUbicacion(code));
      },
      OPCIONES_UBICACION,
    );
  }, [map, soportado]);

  const ubicar = useCallback(() => {
    if (!soportado) return;
    setEstado('buscando');
    setError(null);
    setAviso(null);
    pedirUbicacion();
  }, [pedirUbicacion, soportado]);

  const irAlEstablecimiento = useCallback(() => {
    if (!poligono || poligono.length < 3) return;
    setAviso(null);
    map.fitBounds(poligono, { padding: [28, 28], maxZoom: 15 });
  }, [map, poligono]);

  useEffect(() => {
    const marcarInteraccion = () => {
      interactuo.current = true;
    };
    map.on('dragstart', marcarInteraccion);
    map.on('click', marcarInteraccion);
    return () => {
      map.off('dragstart', marcarInteraccion);
      map.off('click', marcarInteraccion);
    };
  }, [map]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    DomEvent.disableClickPropagation(panel);
    DomEvent.disableScrollPropagation(panel);
  }, []);

  useEffect(() => {
    pedirUbicacion();
  }, [pedirUbicacion]);

  return (
    <>
      {posicion && (
        <>
          <Circle
            center={[posicion.lat, posicion.lng]}
            radius={posicion.precisionMetros}
            pathOptions={{
              color: '#fdda24',
              weight: 1,
              opacity: 0.5,
              fillColor: '#fdda24',
              fillOpacity: 0.08,
            }}
          />
          <Marker
            position={[posicion.lat, posicion.lng]}
            icon={ICONO_USUARIO}
            title="Estás acá"
            alt="Estás acá"
          />
        </>
      )}
      <div
        ref={panelRef}
        className="absolute top-2 right-2 z-[1000] flex max-w-[250px] flex-col items-end gap-1.5"
      >
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            disabled={estado === 'buscando'}
            className="border-brand text-brand rounded border bg-neutral-950/85 px-2.5 py-1.5 text-xs font-semibold hover:bg-neutral-900 disabled:opacity-60"
            onClick={ubicar}
          >
            Mi ubicación
          </button>
          {poligono && poligono.length >= 3 && (
            <button
              type="button"
              className="rounded border border-neutral-600 bg-neutral-950/85 px-2.5 py-1.5 text-xs text-neutral-100 hover:border-neutral-400 hover:bg-neutral-900"
              onClick={irAlEstablecimiento}
            >
              Ver establecimiento
            </button>
          )}
        </div>
        {error && (
          <p className="rounded border border-red-400/40 bg-neutral-950/85 px-2 py-1 text-[11px] text-red-400">
            {error}
          </p>
        )}
        {!error && aviso && (
          <p className="rounded bg-neutral-950/85 px-2 py-1 text-[11px] text-neutral-300">
            {aviso}
          </p>
        )}
        {!error && !aviso && estado === 'buscando' && (
          <p className="rounded bg-neutral-950/85 px-2 py-1 text-[11px] text-neutral-300">
            Buscando tu ubicación…
          </p>
        )}
      </div>
    </>
  );
}
