import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => {
  const llamadas: [string, ...unknown[]][] = [];
  const respuesta: { data: unknown; error: { message: string } | null } = {
    data: [],
    error: null,
  };
  const builder: Record<string, unknown> = {};

  for (const metodo of ['select', 'eq', 'gte', 'lte', 'is', 'order', 'limit'] as const) {
    builder[metodo] = (...args: unknown[]) => {
      llamadas.push([metodo, ...args]);
      return builder;
    };
  }
  builder.then = (resolver: (valor: unknown) => unknown) => resolver(respuesta);

  return { llamadas, respuesta, cliente: { from: () => builder } };
});

vi.mock('@/lib/storage', () => ({
  createAdminClient: () => falso.cliente,
}));

import { listarLotes } from '@/lib/queries';

function argumentosDe(metodo: string): unknown[][] {
  return falso.llamadas.filter(([m]) => m === metodo).map(([, ...args]) => args);
}

describe('listarLotes', () => {
  beforeEach(() => {
    falso.llamadas.length = 0;
    falso.respuesta.data = [];
    falso.respuesta.error = null;
  });

  it('aplica estado y los cuatro filtros de mercado dentro de la consulta', async () => {
    await listarLotes({
      estado: 'DISPONIBLE',
      provincia: 'Santa Fe',
      categoria: 'Novillito',
      raza: 'Angus',
      moneda: 'USDC',
    });

    expect(argumentosDe('eq')).toEqual([
      ['estado_publicacion', 'DISPONIBLE'],
      ['provincia', 'Santa Fe'],
      ['categoria', 'Novillito'],
      ['raza', 'Angus'],
      ['moneda', 'USDC'],
    ]);
  });

  it('aplica todos los filtros antes del límite de 60', async () => {
    await listarLotes({
      estado: 'DISPONIBLE',
      provincia: 'Santa Fe',
      humedal: { min: 10, max: 40 },
    });

    const indiceLimite = falso.llamadas.findIndex(([metodo]) => metodo === 'limit');
    const indicesFiltros = falso.llamadas.flatMap(([metodo], indice) =>
      ['eq', 'gte', 'lte', 'is'].includes(metodo) ? [indice] : [],
    );

    expect(falso.llamadas[indiceLimite]).toEqual(['limit', 60]);
    expect(indicesFiltros.length).toBeGreaterThan(0);
    for (const indice of indicesFiltros) {
      expect(indice).toBeLessThan(indiceLimite);
    }
  });

  it('aplica el rango de humedal de forma inclusiva', async () => {
    await listarLotes({ humedal: { min: 0, max: 100 } });

    expect(argumentosDe('gte')).toEqual([['porcentaje_humedal', 0]]);
    expect(argumentosDe('lte')).toEqual([['porcentaje_humedal', 100]]);
  });

  it('“solo sin dato” ignora el rango y busca nulos', async () => {
    await listarLotes({ estado: 'DISPONIBLE', humedal: { soloSinDato: true, min: 5 } });

    expect(argumentosDe('is')).toEqual([['porcentaje_humedal', null]]);
    expect(argumentosDe('gte')).toEqual([]);
    expect(argumentosDe('lte')).toEqual([]);
  });

  it('ignora filtros vacíos o indefinidos', async () => {
    await listarLotes({ estado: 'DISPONIBLE', provincia: '', categoria: undefined });

    expect(argumentosDe('eq')).toEqual([['estado_publicacion', 'DISPONIBLE']]);
  });

  it('propaga el error de la consulta con contexto', async () => {
    falso.respuesta.error = { message: 'boom' };

    await expect(listarLotes()).rejects.toThrow('Error listando lotes: boom');
  });
});
