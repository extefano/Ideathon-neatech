import { sha256Hex } from '@/lib/crypto';
import type { ReporteHumedalV1 } from '@/lib/humedales';
import { jsonCanonico } from '@/lib/json-canonico';

/**
 * Manifiesto de origen v2: compromiso canónico que recibe Soroban en el Sello 1
 * (código, polígono normalizado y consulta GFW). El reporte de humedales es un
 * atributo informativo del lote: NO forma parte de este compromiso ni del
 * anclaje on-chain.
 */
export type ManifiestoOrigenV2 = {
  esquema: 'muunar.origen.v2';
  codigoLote: string;
  poligono: unknown;
  gfw: unknown;
};

/** Hash del reporte de humedales (snapshot interno del atributo, no on-chain). */
export function hashReporteHumedal(reporte: ReporteHumedalV1): string {
  return sha256Hex(jsonCanonico(reporte));
}

export function construirManifiestoOrigenV2(input: {
  codigoLote: string;
  poligono: unknown;
  gfw: unknown;
}): ManifiestoOrigenV2 {
  return {
    esquema: 'muunar.origen.v2',
    codigoLote: input.codigoLote,
    poligono: input.poligono,
    gfw: input.gfw,
  };
}
