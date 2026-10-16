import { describe, expect, it } from 'vitest';
import { calcularSuperficieHa, parseAndValidatePolygon } from '@/lib/geo';

const poligonoMercedes = {
  type: 'Polygon',
  coordinates: [
    [
      [-58.0, -29.0],
      [-58.1, -29.0],
      [-58.1, -29.1],
      [-58.0, -29.1],
      [-58.0, -29.0],
    ],
  ],
};

describe('parseAndValidatePolygon', () => {
  it('valida un polígono cerrado dentro de Argentina y calcula hectáreas', () => {
    const r = parseAndValidatePolygon(JSON.stringify(poligonoMercedes));

    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.superficieHa).toBeGreaterThan(10000);
    expect(r.superficieHa).toBeLessThan(11200);
  });

  it('acepta un Feature con geometry Polygon', () => {
    const feature = { type: 'Feature', geometry: poligonoMercedes };
    expect(parseAndValidatePolygon(JSON.stringify(feature)).ok).toBe(true);
  });

  it('rechaza anillo abierto', () => {
    const abierto = {
      type: 'Polygon',
      coordinates: [
        [
          [-58.0, -29.0],
          [-58.1, -29.0],
          [-58.1, -29.1],
          [-58.05, -29.05],
        ],
      ],
    };
    const r = parseAndValidatePolygon(JSON.stringify(abierto));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('cerrado'))).toBe(true);
  });

  it('rechaza polígonos fuera de Argentina', () => {
    const espana = {
      type: 'Polygon',
      coordinates: [
        [
          [-3.7, 40.4],
          [-3.8, 40.4],
          [-3.8, 40.5],
          [-3.7, 40.5],
          [-3.7, 40.4],
        ],
      ],
    };
    const r = parseAndValidatePolygon(JSON.stringify(espana));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('argentino'))).toBe(true);
  });

  it('rechaza JSON inválido y tipos que no son Polygon', () => {
    expect(parseAndValidatePolygon('no-json').ok).toBe(false);
    expect(parseAndValidatePolygon('{"type":"Point","coordinates":[0,0]}').ok).toBe(false);
  });
});

describe('calcularSuperficieHa', () => {
  it('devuelve 0 con anillos incompletos', () => {
    expect(calcularSuperficieHa([])).toBe(0);
  });
});
