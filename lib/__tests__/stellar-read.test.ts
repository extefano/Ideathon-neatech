import { describe, expect, it } from 'vitest';
import { leerLoteOnChain } from '@/lib/stellar-read';

describe('leerLoteOnChain', () => {
  it('sin contrato configurado informa que no se pudo comprobar', async () => {
    const lectura = await leerLoteOnChain('LOTE-00110', { contractId: '' });

    expect(lectura).toEqual({ estado: 'error', detalle: 'contrato_no_configurado' });
  });

  it('devuelve la raíz anclada cuando el lote existe', async () => {
    const lectura = await leerLoteOnChain('LOTE-00110', {
      cliente: {
        get_lote: async () => ({
          result: { eudr_geo_hash: 'a'.repeat(64), estado: 'OrigenVerificado', head_count: 30 },
        }),
      },
    });

    expect(lectura).toEqual({
      estado: 'existe',
      eudrGeoHash: 'a'.repeat(64),
      estadoContrato: 'OrigenVerificado',
    });
  });

  it('acepta la respuesta directa del contrato sin envoltorio result', async () => {
    const lectura = await leerLoteOnChain('LOTE-00110', {
      cliente: {
        get_lote: async () => ({ eudr_geo_hash: 'b'.repeat(64), estado: 'OrigenVerificado' }),
      },
    });

    expect(lectura).toEqual({
      estado: 'existe',
      eudrGeoHash: 'b'.repeat(64),
      estadoContrato: 'OrigenVerificado',
    });
  });

  it('distingue un lote inexistente (#2) de un error de infraestructura', async () => {
    const inexistente = await leerLoteOnChain('LOTE-99999', {
      cliente: {
        get_lote: async () => {
          throw new Error('HostError: Error(Contract, #2)');
        },
      },
    });
    expect(inexistente).toEqual({ estado: 'no_existe' });

    const caido = await leerLoteOnChain('LOTE-00110', {
      cliente: {
        get_lote: async () => {
          throw new Error('fetch failed: connect ETIMEDOUT');
        },
      },
    });
    expect(caido.estado).toBe('error');
    if (caido.estado !== 'error') return;
    expect(caido.detalle).toContain('ETIMEDOUT');
  });
});
