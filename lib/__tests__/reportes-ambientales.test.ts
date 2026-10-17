import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@/lib/crypto';
import { construirManifiestoOrigenV2, hashReporteHumedal } from '@/lib/reportes-ambientales';
import { jsonCanonico } from '@/lib/json-canonico';
import type { ReporteHumedalV1 } from '@/lib/humedales';

const POLIGONO = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-58.1, -29.5],
      [-58.1, -29.45],
      [-58.07, -29.45],
      [-58.1, -29.5],
    ],
  ],
};

const REPORTE: ReporteHumedalV1 = {
  esquema: 'muunar.humedal.v1',
  estado: 'VERIFICADO',
  motivo: null,
  poligono: POLIGONO,
  superficieLoteHa: '100.0000',
  superficieHumedalHa: '50.0000',
  porcentajeHumedal: '50.0000',
  coberturaPct: '100',
  fuente: null,
  metodo: {
    version: '1',
    motor: 'postgis',
    sridEntrada: 4326,
    sridCalculo: 6933,
    modelo: 'lambert-cylindrical-equal-area',
  },
  calculadoEn: '2026-10-17T05:00:00.000Z',
};

const REPORTE_CANONICO =
  '{"calculadoEn":"2026-10-17T05:00:00.000Z","coberturaPct":"100","esquema":"muunar.humedal.v1","estado":"VERIFICADO","fuente":null,"metodo":{"modelo":"lambert-cylindrical-equal-area","motor":"postgis","sridCalculo":6933,"sridEntrada":4326,"version":"1"},"motivo":null,"poligono":{"coordinates":[[[-58.1,-29.5],[-58.1,-29.45],[-58.07,-29.45],[-58.1,-29.5]]],"type":"Polygon"},"porcentajeHumedal":"50.0000","superficieHumedalHa":"50.0000","superficieLoteHa":"100.0000"}';

const HASH_REPORTE = '08343e9f850f92d71af563249bdb554dd9faeafc44820143d5756867221ae2f9';

const GFW = { checkedAt: '2026-10-17T05:00:00.000Z', totalLossHa: 0 };

// El manifiesto del Sello 1 compromete código, polígono y GFW. El reporte de
// humedales es un atributo informativo y NO entra en este compromiso.
const MANIFIESTO_CANONICO =
  '{"codigoLote":"LOTE-00110","esquema":"muunar.origen.v2","gfw":{"checkedAt":"2026-10-17T05:00:00.000Z","totalLossHa":0},"poligono":{"coordinates":[[[-58.1,-29.5],[-58.1,-29.45],[-58.07,-29.45],[-58.1,-29.5]]],"type":"Polygon"}}';

const HASH_MANIFIESTO = 'a4a8ef42b875f0659c75f322ca110eb2758edd197ee3d0aa285d7c64dbc826a1';

describe('hashReporteHumedal', () => {
  it('hashea los bytes canónicos del reporte (vector fijo)', () => {
    expect(jsonCanonico(REPORTE)).toBe(REPORTE_CANONICO);
    expect(hashReporteHumedal(REPORTE)).toBe(HASH_REPORTE);
  });

  it('cambia al modificar cualquier campo del análisis', () => {
    expect(hashReporteHumedal({ ...REPORTE, porcentajeHumedal: '50.0001' })).not.toBe(HASH_REPORTE);
    expect(hashReporteHumedal({ ...REPORTE, estado: 'SIN_DATOS' })).not.toBe(HASH_REPORTE);
    expect(hashReporteHumedal({ ...REPORTE, calculadoEn: '2026-10-17T05:00:00.001Z' })).not.toBe(
      HASH_REPORTE,
    );
  });
});

describe('manifiesto de origen v2', () => {
  it('produce un vector fijo sin incluir el reporte de humedales', () => {
    const manifiesto = construirManifiestoOrigenV2({
      codigoLote: 'LOTE-00110',
      poligono: POLIGONO,
      gfw: GFW,
    });

    expect(jsonCanonico(manifiesto)).toBe(MANIFIESTO_CANONICO);
    expect(sha256Hex(jsonCanonico(manifiesto))).toBe(HASH_MANIFIESTO);
    expect('humedales' in manifiesto).toBe(false);
    expect(jsonCanonico(manifiesto)).not.toContain('humedal');
  });

  it('el orden de las claves del GFW no altera el hash', () => {
    const a = construirManifiestoOrigenV2({
      codigoLote: 'LOTE-00110',
      poligono: POLIGONO,
      gfw: { totalLossHa: 0, checkedAt: '2026-10-17T05:00:00.000Z' },
    });
    expect(sha256Hex(jsonCanonico(a))).toBe(HASH_MANIFIESTO);
  });
});
