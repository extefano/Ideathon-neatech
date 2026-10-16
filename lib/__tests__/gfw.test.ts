import { describe, expect, it, vi } from 'vitest';
import { consultarDeforestacion, hayDeforestacion } from '@/lib/gfw';

const geometry = { type: 'Polygon', coordinates: [] as number[][] };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('consultarDeforestacion', () => {
  it('suma la pérdida por año y arma el resultado', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({
        data: [
          { umd_tree_cover_loss__year: 2021, loss_ha: 1.25 },
          { umd_tree_cover_loss__year: 2023, loss_ha: 2.75 },
        ],
      }),
    );

    const r = await consultarDeforestacion({
      geometry,
      apiKey: 'test-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => new Date('2026-10-16T00:00:00Z'),
    });

    expect(r.totalLossHa).toBe(4);
    expect(r.byYear).toEqual([
      { year: 2021, lossHa: 1.25 },
      { year: 2023, lossHa: 2.75 },
    ]);
    expect(r.checkedAt).toBe('2026-10-16T00:00:00.000Z');
    expect(hayDeforestacion(r)).toBe(true);

    const init = fetchImpl.mock.calls[0][1];
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('test-key');
  });

  it('sin pérdidas => 0 ha y sin deforestación', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));

    const r = await consultarDeforestacion({
      geometry,
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(r.totalLossHa).toBe(0);
    expect(hayDeforestacion(r)).toBe(false);
  });

  it('error HTTP => lanza con el status', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'boom' }, 500));

    await expect(
      consultarDeforestacion({
        geometry,
        apiKey: 'k',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('500');
  });
});
