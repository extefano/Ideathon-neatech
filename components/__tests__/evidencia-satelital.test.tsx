import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EvidenciaSatelital } from '@/components/evidencia-satelital';

vi.mock('@/components/mapa-lote', () => ({
  MapaLote: () => <div data-testid="mapa-mock">Mapa mock</div>,
}));

describe('EvidenciaSatelital', () => {
  const dummyPoligono = {
    type: 'Polygon',
    coordinates: [
      [
        [-61.9, -33.7],
        [-61.84, -33.7],
        [-61.84, -33.65],
        [-61.9, -33.65],
        [-61.9, -33.7],
      ],
    ],
  };

  it('muestra estado Conforme EUDR cuando no hay pérdida (totalLossHa === 0)', () => {
    const html = renderToStaticMarkup(
      <EvidenciaSatelital
        poligono={dummyPoligono}
        gfw={{
          totalLossHa: 0,
          byYear: [],
          checkedAt: '2026-10-16T10:30:00.000Z',
          criterio: 'umd_tree_cover_loss >= 2021 (corte reglamentario EUDR: 31/12/2020)',
        }}
      />,
    );

    // Badge y veredicto
    expect(html).toContain('✓ Conforme EUDR · Libre de deforestación');
    expect(html).toContain('0,00 ha');
    expect(html).toContain(
      'La parcela analizada no presenta pérdida de bosque nativo desde la fecha de corte reglamentaria.',
    );

    // Explicación pedagógica del corte EUDR
    expect(html).toContain('Corte reglamentario EUDR (31/12/2020)');
    expect(html).toContain('Reglamento de la Unión Europea sobre deforestación');

    // Fuente y fecha humana
    expect(html).toContain('Global Forest Watch (Universidad de Maryland / Hansen)');
    expect(html).toContain('Verificado satelitalmente el');

    // Detalle técnico colapsable
    expect(html).toContain('Ver detalle técnico de auditoría');
    expect(html).toContain('umd_tree_cover_loss (Hansen / UMD)');
  });

  it('muestra estado No conforme EUDR con desglose anual cuando totalLossHa > 0', () => {
    const html = renderToStaticMarkup(
      <EvidenciaSatelital
        poligono={dummyPoligono}
        gfw={{
          totalLossHa: 10.56,
          byYear: [
            { year: 2021, lossHa: 4.2 },
            { year: 2023, lossHa: 6.36 },
          ],
          checkedAt: '2026-10-16T07:34:33.000Z',
          criterio: 'umd_tree_cover_loss >= 2021',
        }}
      />,
    );

    // Badge y veredicto
    expect(html).toContain('✕ No conforme EUDR · Pérdida arbórea detectada');
    expect(html).toContain('10,56 ha');
    expect(html).toContain('no es apto para exportación EUDR');

    // Desglose de años en tags/chips
    expect(html).toContain('Desglose por año detectado:');
    expect(html).toContain('2021:');
    expect(html).toContain('4,20 ha');
    expect(html).toContain('2023:');
    expect(html).toContain('6,36 ha');

    // Detalle técnico colapsable con el criterio API
    expect(html).toContain('umd_tree_cover_loss &gt;= 2021');
  });

  it('muestra mensaje adecuado cuando no hay consulta satelital (gfw === null)', () => {
    const html = renderToStaticMarkup(<EvidenciaSatelital poligono={dummyPoligono} gfw={null} />);

    expect(html).toContain('Sin análisis satelital');
    expect(html).toContain('Sin consulta satelital GFW registrada.');
    expect(html).toContain('Corte reglamentario EUDR (31/12/2020)');
    // No debe mostrar detalle técnico de auditoría si no hay consulta
    expect(html).not.toContain('Ver detalle técnico de auditoría');
  });
});
