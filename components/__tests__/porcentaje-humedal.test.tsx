import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PorcentajeHumedal } from '@/components/porcentaje-humedal';
import {
  construirReporteDesdeRpc,
  construirReporteSinCalculo,
  METODO_HUMEDAL_V1,
  type FilaHumedalRpc,
} from '@/lib/humedales';

const poligono = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-58.1, -29.5],
      [-58.07, -29.5],
      [-58.07, -29.45],
      [-58.1, -29.5],
    ],
  ],
};

const filaVerificada: FilaHumedalRpc = {
  estado: 'VERIFICADO',
  motivo: null,
  poligono_normalizado: poligono,
  superficie_total_ha: 55.4945,
  superficie_total_ha_texto: '55.4945',
  superficie_humedal_ha: 27.7473,
  porcentaje_humedal: 50,
  porcentaje_humedal_texto: '50.0000',
  cobertura_pct: 100,
  fuente_humedal: {
    proveedor: 'INH',
    dataset: 'inh-nivel4-nea',
    version: '2024',
    fechaDatos: '2023-12-31',
    clases: ['humedal'],
    escala: '1:250000',
    url: null,
    licencia: 'CC BY 4.0',
    atribucion: 'INH/MAyDS',
    checksum: null,
    metodoVersion: '1',
    esDemo: false,
  },
  detalle_capas: [],
  metodo: METODO_HUMEDAL_V1,
  calculado_en: '2026-10-17T05:00:00.000Z',
};

describe('PorcentajeHumedal', () => {
  it('muestra el porcentaje, la fuente y los detalles técnicos', () => {
    const html = renderToStaticMarkup(
      <PorcentajeHumedal reporte={construirReporteDesdeRpc(filaVerificada)} />,
    );

    expect(html).toContain('50 % del campo');
    expect(html).toContain('INH · inh-nivel4-nea v2024');
    expect(html).toContain('datos de 2023-12-31');
    expect(html).toContain('Detalles técnicos');
    expect(html).not.toContain('Datos de demostración');
  });

  it('marca los datos de demostración', () => {
    const html = renderToStaticMarkup(
      <PorcentajeHumedal
        reporte={construirReporteDesdeRpc({
          ...filaVerificada,
          fuente_humedal: { ...filaVerificada.fuente_humedal!, proveedor: 'DEMO', esDemo: true },
        })}
      />,
    );

    expect(html).toContain('Datos de demostración');
  });

  it('“sin dato” nunca se presenta como 0 %', () => {
    const html = renderToStaticMarkup(
      <PorcentajeHumedal
        reporte={construirReporteSinCalculo({
          estado: 'ERROR_CONSULTA',
          motivo: 'error_servidor',
          poligono,
          superficieLoteHaTexto: '55.4945',
          calculadoEn: '2026-10-17T05:00:00.000Z',
        })}
      />,
    );

    expect(html).toContain('Sin dato de humedal');
    expect(html).not.toContain('0 %');
    expect(html).toContain('Podés continuar con el registro');
  });

  it('explica la cobertura parcial sin mostrar porcentaje', () => {
    const html = renderToStaticMarkup(
      <PorcentajeHumedal
        reporte={construirReporteDesdeRpc({
          ...filaVerificada,
          estado: 'COBERTURA_PARCIAL',
          motivo: 'fuera_de_cobertura',
          porcentaje_humedal: null,
          porcentaje_humedal_texto: null,
          superficie_humedal_ha: null,
          cobertura_pct: 61.5,
        })}
      />,
    );

    expect(html).toContain('Sin dato de humedal');
    expect(html).toContain('cobertura parcial');
    expect(html).toContain('fuera del área que cubre la fuente');
    expect(html).toContain('61.5');
  });
});
