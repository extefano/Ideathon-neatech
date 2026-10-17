import { describe, expect, it } from 'vitest';
import {
  hayFiltrosHumedal,
  hayFiltrosMercado,
  parsearFiltrosHumedal,
  parsearFiltrosMercado,
} from '@/app/mercado/filtros';

describe('parsearFiltrosHumedal', () => {
  it('sin parámetros no filtra y no acumula errores', () => {
    expect(parsearFiltrosHumedal({})).toEqual({
      min: null,
      max: null,
      sinDato: false,
      errores: [],
    });
    expect(hayFiltrosHumedal(parsearFiltrosHumedal({}))).toBe(false);
  });

  it('parsea un rango inclusivo válido', () => {
    const filtros = parsearFiltrosHumedal({ humMin: '0', humMax: '100' });

    expect(filtros).toEqual({ min: 0, max: 100, sinDato: false, errores: [] });
    expect(hayFiltrosHumedal(filtros)).toBe(true);
  });

  it('rechaza extremos iguales invertidos y fuera de dominio', () => {
    expect(parsearFiltrosHumedal({ humMin: '60', humMax: '20' }).errores[0]).toContain('mayor');
    expect(parsearFiltrosHumedal({ humMin: '-1' }).errores).toHaveLength(1);
    expect(parsearFiltrosHumedal({ humMax: '100.5' }).errores).toHaveLength(1);
    expect(parsearFiltrosHumedal({ humMin: 'texto' }).errores).toHaveLength(1);
    expect(parsearFiltrosHumedal({ humMin: 'Infinity' }).errores).toHaveLength(1);
  });

  it('“solo sin dato” no convive con un rango', () => {
    const filtros = parsearFiltrosHumedal({ humSinDato: '1', humMin: '10' });

    expect(filtros.sinDato).toBe(true);
    expect(filtros.errores[0]).toContain('no ambos');
  });

  it('parámetros repetidos: conserva el primero', () => {
    const filtros = parsearFiltrosHumedal({ humMin: ['10', '20'] });

    expect(filtros.min).toBe(10);
    expect(filtros.errores).toEqual([]);
  });
});

describe('parsearFiltrosMercado', () => {
  it('sin parámetros no arma filtros para la consulta', () => {
    expect(parsearFiltrosMercado({})).toEqual({
      provincia: undefined,
      categoria: undefined,
      raza: undefined,
      moneda: undefined,
    });
    expect(hayFiltrosMercado(parsearFiltrosMercado({}))).toBe(false);
  });

  it('recorta espacios y descarta valores vacíos o en blanco', () => {
    expect(
      parsearFiltrosMercado({
        provincia: '  Santa Fe  ',
        categoria: '   ',
        raza: '',
        moneda: 'USDC',
      }),
    ).toEqual({
      provincia: 'Santa Fe',
      categoria: undefined,
      raza: undefined,
      moneda: 'USDC',
    });
    expect(hayFiltrosMercado(parsearFiltrosMercado({ moneda: 'USDC' }))).toBe(true);
  });

  it('parámetros repetidos: conserva el primero', () => {
    expect(parsearFiltrosMercado({ raza: ['Angus', 'Hereford'] }).raza).toBe('Angus');
  });

  it('no inventa valores a partir de humedal u otros parámetros', () => {
    expect(parsearFiltrosMercado({ humMin: '10', otra: 'x' })).toEqual({
      provincia: undefined,
      categoria: undefined,
      raza: undefined,
      moneda: undefined,
    });
  });
});
