import { describe, expect, it } from 'vitest';
import {
  METODO_HUMEDAL_V1,
  construirReporteDesdeRpc,
  construirReporteSinCalculo,
  descripcionHumedal,
  formatearHectareas,
  formatearPorcentajeHumedal,
  type FilaHumedalRpc,
} from '@/lib/humedales';

const filaBase: FilaHumedalRpc = {
  estado: 'VERIFICADO',
  motivo: null,
  poligono_normalizado: {
    type: 'Polygon',
    coordinates: [
      [
        [-58.1, -29.5],
        [-58.07, -29.5],
        [-58.07, -29.45],
        [-58.1, -29.45],
        [-58.1, -29.5],
      ],
    ],
  },
  superficie_total_ha: 55.4945,
  superficie_total_ha_texto: '55.4945',
  superficie_humedal_ha: 27.7473,
  porcentaje_humedal: 50.0,
  porcentaje_humedal_texto: '50.0000',
  cobertura_pct: 100,
  fuente_humedal: {
    proveedor: 'DEMO',
    dataset: 'humedales-demo-nea',
    version: '1',
    fechaDatos: '2026-01-01',
    clases: ['humedal-demo'],
    escala: 'sintética',
    url: null,
    licencia: 'Datos sintéticos',
    atribucion: 'Muunar',
    checksum: null,
    metodoVersion: '1',
    esDemo: true,
  },
  detalle_capas: [],
  metodo: METODO_HUMEDAL_V1,
  calculado_en: '2026-10-17T05:00:00.123456+00:00',
};

describe('construirReporteDesdeRpc', () => {
  it('mapea la fila del RPC al reporte v1 con textos decimales', () => {
    const reporte = construirReporteDesdeRpc(filaBase);

    expect(reporte.esquema).toBe('muunar.humedal.v1');
    expect(reporte.estado).toBe('VERIFICADO');
    expect(reporte.superficieLoteHa).toBe('55.4945');
    expect(reporte.porcentajeHumedal).toBe('50.0000');
    expect(reporte.metodo.sridCalculo).toBe(6933);
    expect(reporte.calculadoEn).toBe('2026-10-17T05:00:00.123Z');
  });

  it('conserva null en los desconocidos sin inventar ceros', () => {
    const reporte = construirReporteDesdeRpc({
      ...filaBase,
      estado: 'COBERTURA_PARCIAL',
      motivo: 'fuera_de_cobertura',
      superficie_humedal_ha: null,
      porcentaje_humedal: null,
      porcentaje_humedal_texto: null,
      cobertura_pct: 61.5,
    });

    expect(reporte.estado).toBe('COBERTURA_PARCIAL');
    expect(reporte.porcentajeHumedal).toBeNull();
    expect(reporte.coberturaPct).toBe('61.5');
  });

  it('rechaza estados desconocidos', () => {
    expect(() => construirReporteDesdeRpc({ ...filaBase, estado: 'MAGIC' })).toThrow(
      'Estado de humedal desconocido',
    );
  });
});

describe('construirReporteSinCalculo', () => {
  it('genera un reporte ERROR_CONSULTA explícito y sin porcentaje', () => {
    const reporte = construirReporteSinCalculo({
      estado: 'ERROR_CONSULTA',
      motivo: 'error_servidor',
      poligono: filaBase.poligono_normalizado,
      superficieLoteHaTexto: '55.4945',
      calculadoEn: '2026-10-17T05:00:00.000Z',
    });

    expect(reporte.estado).toBe('ERROR_CONSULTA');
    expect(reporte.porcentajeHumedal).toBeNull();
    expect(reporte.superficieLoteHa).toBe('55.4945');
    expect(reporte.fuente).toBeNull();
  });
});

describe('formateo de campo', () => {
  it('formatea porcentajes en es-AR con dos decimales', () => {
    expect(formatearPorcentajeHumedal('50.0000')).toBe('50');
    expect(formatearPorcentajeHumedal('12.3400')).toBe('12,34');
    expect(formatearPorcentajeHumedal('1234.5000')).toBe('1.234,5');
  });

  it('distingue cero de ausencia y de valores ínfimos', () => {
    expect(formatearPorcentajeHumedal('0.0000')).toBe('0');
    expect(formatearPorcentajeHumedal('0.0040')).toBe('<0,01');
    expect(formatearPorcentajeHumedal(null)).toBeNull();
  });

  it('formatea hectáreas', () => {
    expect(formatearHectareas('1234.5678')).toBe('1.234,57');
    expect(formatearHectareas(null)).toBeNull();
  });
});

describe('descripcionHumedal', () => {
  it('describe el resultado verificable sin jerga', () => {
    expect(descripcionHumedal({ estado: 'VERIFICADO', porcentajeHumedal: '50.0000' })).toBe(
      '50 % del campo',
    );
    expect(descripcionHumedal({ estado: 'SIN_DATOS', porcentajeHumedal: null })).toContain(
      'Sin dato',
    );
    expect(descripcionHumedal({ estado: 'COBERTURA_PARCIAL', porcentajeHumedal: null })).toContain(
      'cobertura parcial',
    );
  });
});
