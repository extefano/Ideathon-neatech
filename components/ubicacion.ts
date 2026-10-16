export type PosicionUsuario = {
  lat: number;
  lng: number;
  precisionMetros: number;
};

export const ZOOM_UBICACION = 14;

export function mensajeErrorUbicacion(codigo: number): string {
  if (codigo === 1) {
    return 'Permiso de ubicación rechazado. Habilitalo en tu navegador y probá de nuevo.';
  }
  if (codigo === 3) {
    return 'La búsqueda de tu ubicación tardó demasiado. Probá de nuevo.';
  }
  return 'No pudimos obtener tu ubicación. Probá de nuevo.';
}

export function zoomUbicacion(zoomActual: number): number {
  return Math.max(zoomActual, ZOOM_UBICACION);
}
