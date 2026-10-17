/**
 * Tipos y utilidades puras del análisis de humedales (seguros para cliente).
 * Los hashes y el manifiesto viven en `lib/reportes-ambientales.ts` (servidor).
 */

export const ESTADOS_HUMEDAL = [
  'VERIFICADO',
  'SIN_DATOS',
  'SIN_COBERTURA',
  'COBERTURA_PARCIAL',
  'ERROR_CONSULTA',
] as const;

export type EstadoHumedal = (typeof ESTADOS_HUMEDAL)[number];

export type PoligonoGeoJSON = { type: 'Polygon'; coordinates: number[][][] };

export type FuenteHumedal = {
  proveedor: string;
  dataset: string;
  version: string;
  fechaDatos: string | null;
  clases: string[];
  escala: string | null;
  url: string | null;
  licencia: string | null;
  atribucion: string | null;
  checksum: string | null;
  metodoVersion: string;
  esDemo: boolean;
};

export type MetodoHumedal = {
  version: string;
  motor: string;
  sridEntrada: number;
  sridCalculo: number;
  modelo: string;
};

export type ReporteHumedalV1 = {
  esquema: 'muunar.humedal.v1';
  estado: EstadoHumedal;
  motivo: string | null;
  poligono: PoligonoGeoJSON;
  superficieLoteHa: string | null;
  superficieHumedalHa: string | null;
  porcentajeHumedal: string | null;
  coberturaPct: string | null;
  fuente: FuenteHumedal | null;
  metodo: MetodoHumedal;
  calculadoEn: string;
};

/** Fila devuelta por la RPC `calcular_interseccion_humedal`. */
export type FilaHumedalRpc = {
  estado: string;
  motivo: string | null;
  poligono_normalizado: PoligonoGeoJSON;
  superficie_total_ha: number | null;
  superficie_total_ha_texto: string | null;
  superficie_humedal_ha: number | null;
  porcentaje_humedal: number | null;
  porcentaje_humedal_texto: string | null;
  cobertura_pct: number | null;
  fuente_humedal: FuenteHumedal | null;
  detalle_capas: unknown;
  metodo: MetodoHumedal;
  calculado_en: string;
};

export const METODO_HUMEDAL_V1: MetodoHumedal = {
  version: '1',
  motor: 'postgis',
  sridEntrada: 4326,
  sridCalculo: 6933,
  modelo: 'lambert-cylindrical-equal-area',
};

function normalizarEstado(estado: string): EstadoHumedal {
  if ((ESTADOS_HUMEDAL as readonly string[]).includes(estado)) {
    return estado as EstadoHumedal;
  }
  throw new Error(`Estado de humedal desconocido: ${estado}`);
}

const isoUtc = (valor: string): string => new Date(valor).toISOString();

export function construirReporteDesdeRpc(fila: FilaHumedalRpc): ReporteHumedalV1 {
  return {
    esquema: 'muunar.humedal.v1',
    estado: normalizarEstado(fila.estado),
    motivo: fila.motivo ?? null,
    poligono: fila.poligono_normalizado,
    superficieLoteHa: fila.superficie_total_ha_texto ?? null,
    superficieHumedalHa:
      fila.superficie_humedal_ha === null ? null : fila.superficie_humedal_ha.toString(),
    porcentajeHumedal: fila.porcentaje_humedal_texto ?? null,
    coberturaPct: fila.cobertura_pct === null ? null : fila.cobertura_pct.toString(),
    fuente: fila.fuente_humedal ?? null,
    metodo: fila.metodo,
    calculadoEn: isoUtc(fila.calculado_en),
  };
}

/**
 * Reporte cuando el motor espacial no respondió: la geometría ya fue validada
 * por separado y el estado queda explícito como ERROR_CONSULTA (nunca 0 %).
 */
export function construirReporteSinCalculo(input: {
  estado: Extract<EstadoHumedal, 'SIN_DATOS' | 'ERROR_CONSULTA'>;
  motivo: string;
  poligono: PoligonoGeoJSON;
  superficieLoteHaTexto: string | null;
  calculadoEn: string;
}): ReporteHumedalV1 {
  return {
    esquema: 'muunar.humedal.v1',
    estado: input.estado,
    motivo: input.motivo,
    poligono: input.poligono,
    superficieLoteHa: input.superficieLoteHaTexto,
    superficieHumedalHa: null,
    porcentajeHumedal: null,
    coberturaPct: null,
    fuente: null,
    metodo: METODO_HUMEDAL_V1,
    calculadoEn: isoUtc(input.calculadoEn),
  };
}

/** Presentación: '12.3400' → '12,34'; positivos ínfimos → '<0,01'; '0.0000' → '0'. */
export function formatearPorcentajeHumedal(texto: string | null): string | null {
  if (texto === null) return null;
  const n = Number(texto);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return '0';
  if (n > 0 && n < 0.01) return '<0,01';
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function formatearHectareas(texto: string | null): string | null {
  if (texto === null) return null;
  const n = Number(texto);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function etiquetaFuenteHumedal(
  fuente: Pick<FuenteHumedal, 'proveedor' | 'dataset' | 'version'>,
): string {
  return `${fuente.proveedor} · ${fuente.dataset} v${fuente.version}`;
}

/** Frase corta y honesta para tarjetas, ficha y pasaporte. */
export function descripcionHumedal(reporte: {
  estado: EstadoHumedal;
  porcentajeHumedal: string | null;
}): string {
  switch (reporte.estado) {
    case 'VERIFICADO': {
      const pct = formatearPorcentajeHumedal(reporte.porcentajeHumedal) ?? '—';
      return `${pct} % del campo`;
    }
    case 'COBERTURA_PARCIAL':
      return 'Sin dato: el campo queda fuera del área cubierta por la fuente (cobertura parcial)';
    case 'SIN_COBERTURA':
      return 'Sin dato: la fuente no cubre este campo';
    case 'SIN_DATOS':
      return 'Sin dato: no hay una fuente de humedales publicada';
    case 'ERROR_CONSULTA':
      return 'Sin dato (no se pudo calcular)';
  }
}
