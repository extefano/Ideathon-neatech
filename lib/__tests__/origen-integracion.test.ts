import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reintentarGfwAction } from '@/lib/actions';

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  });
  const getCurrentUser = vi.fn();
  const estado: { lote: Record<string, unknown> | null } = { lote: null };
  return { redirect, getCurrentUser, estado };
});

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

vi.mock('@/lib/storage', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.estado.lote, error: null }),
        }),
      }),
    }),
  }),
  subirArchivo: vi.fn(),
  sanitizarNombre: (nombre: string) => nombre,
}));

function formDataCon(codigo: string): FormData {
  const fd = new FormData();
  fd.set('codigo', codigo);
  return fd;
}

const LOTE_BASE = {
  id: 'lote-1',
  codigo_lote: 'LOTE-00042',
  seal_1_eudr: false,
  origen_estado: 'PENDIENTE',
  origen_manifest: null,
  origen_manifest_hash: null,
  poligono_geojson: { type: 'Polygon', coordinates: [] },
};

describe('reintentarGfwAction (integración del cableado)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.estado.lote = { ...LOTE_BASE };
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-b', rol: 'PRODUCTOR' });
  });

  it('un lote de otro productor se rechaza con mensaje explícito sin operar la red', async () => {
    mocks.estado.lote = { ...LOTE_BASE, creado_por: 'user-a', origen_estado: 'ENVIADO' };

    await expect(reintentarGfwAction(formDataCon('LOTE-00042'))).rejects.toThrow(/^REDIRECT:/);
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    const url = String(mocks.redirect.mock.calls[0][0]);
    expect(url).toContain('/lotes/LOTE-00042?gfw=error');
    expect(url).toContain('otro%20productor');
  });

  it('un lote legacy sin creado_por pasa el control de titularidad', async () => {
    mocks.estado.lote = { ...LOTE_BASE, creado_por: null, origen_estado: 'RECHAZADO' };

    await expect(reintentarGfwAction(formDataCon('LOTE-00042'))).rejects.toThrow(/^REDIRECT:/);
    const url = String(mocks.redirect.mock.calls[0][0]);
    expect(url).toContain('rechazado');
    expect(url).not.toContain('otro%20productor');
  });
});
