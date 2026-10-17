export type Punto = [number, number];

export type EstadoDibujo = {
  activo: boolean;
  borrador: Punto[];
};

export const ESTADO_DIBUJO_INICIAL: EstadoDibujo = { activo: false, borrador: [] };

export const MIN_VERTICES = 3;

export function activarDibujo(puntosGuardados: Punto[]): EstadoDibujo {
  return { activo: true, borrador: [...puntosGuardados] };
}

export function agregarPunto(estado: EstadoDibujo, punto: Punto): EstadoDibujo {
  if (!estado.activo) return estado;
  return { activo: true, borrador: [...estado.borrador, punto] };
}

export function deshacerPunto(estado: EstadoDibujo): EstadoDibujo {
  if (!estado.activo || estado.borrador.length === 0) return estado;
  return { activo: true, borrador: estado.borrador.slice(0, -1) };
}

export function cancelarDibujo(): EstadoDibujo {
  return ESTADO_DIBUJO_INICIAL;
}

export function puedeGuardar(estado: EstadoDibujo): boolean {
  return estado.activo && estado.borrador.length >= MIN_VERTICES;
}

export function guardarDibujo(estado: EstadoDibujo): {
  estado: EstadoDibujo;
  poligono: string | null;
} {
  if (!puedeGuardar(estado)) return { estado, poligono: null };
  return { estado: ESTADO_DIBUJO_INICIAL, poligono: poligonoDesdePuntos(estado.borrador) };
}

export function puntosVisibles(estado: EstadoDibujo, puntosGuardados: Punto[]): Punto[] {
  return estado.activo ? estado.borrador : puntosGuardados;
}

export function poligonoDesdePuntos(puntos: Punto[]): string {
  const ring = puntos.map(([lat, lng]) => [lng, lat]);
  const primero = puntos[0];
  ring.push([primero[1], primero[0]]);
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] });
}

export function puntosDesdePoligono(texto: string): Punto[] {
  if (!texto) return [];
  try {
    const parsed = JSON.parse(texto) as { coordinates?: unknown; geometry?: unknown };
    const geom = (parsed.geometry ?? parsed) as { type?: string; coordinates?: number[][][] };
    if (geom.type !== 'Polygon' || !geom.coordinates?.[0]) return [];
    return geom.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng]);
  } catch {
    return [];
  }
}

/**
 * Detecta anillos interiores (agujeros) en un Polygon o Feature con geometry
 * Polygon. El editor de mapa solo dibuja el anillo exterior, así que un
 * polígono con agujeros no debe entrar en modo dibujo (se perderían).
 */
export function poligonoTieneAgujeros(texto: string): boolean {
  if (!texto) return false;
  try {
    const parsed = JSON.parse(texto) as { coordinates?: unknown; geometry?: unknown };
    const geom = (parsed.geometry ?? parsed) as { type?: string; coordinates?: unknown };
    if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return false;
    return geom.coordinates.length > 1;
  } catch {
    return false;
  }
}
