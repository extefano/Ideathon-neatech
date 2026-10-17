import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as authModule from '@/lib/auth';
import type { PerfilUsuario, RolUsuario } from '@/lib/auth';

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof authModule>();
  return { ...actual, getCurrentUser: vi.fn() };
});

vi.mock('@/lib/storage', () => ({
  createAdminClient: vi.fn(),
  subirArchivo: vi.fn(),
  sanitizarNombre: (s: string) => s,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/storage';
import { crearLoteAction, reintentarGfwAction } from '@/lib/actions';

type RespuestaMock = { data: unknown; error: { message: string } | null };

type CadenaMock = {
  select: (...args: unknown[]) => CadenaMock;
  eq: (...args: unknown[]) => CadenaMock;
  in: (...args: unknown[]) => CadenaMock;
  insert: (...args: unknown[]) => CadenaMock;
  update: (...args: unknown[]) => CadenaMock;
  upsert: (...args: unknown[]) => CadenaMock;
  order: (...args: unknown[]) => CadenaMock;
  limit: (...args: unknown[]) => CadenaMock;
  single: () => Promise<RespuestaMock>;
  maybeSingle: () => Promise<RespuestaMock>;
  then: (onFulfilled?: (valor: RespuestaMock) => unknown) => Promise<unknown>;
};

function crearCadena(respuesta: RespuestaMock): CadenaMock {
  const cadena = {} as CadenaMock;
  const encadenar = () => cadena;
  cadena.select = vi.fn(encadenar);
  cadena.eq = vi.fn(encadenar);
  cadena.in = vi.fn(encadenar);
  cadena.insert = vi.fn(encadenar);
  cadena.update = vi.fn(encadenar);
  cadena.upsert = vi.fn(encadenar);
  cadena.order = vi.fn(encadenar);
  cadena.limit = vi.fn(encadenar);
  cadena.single = vi.fn(async () => respuesta);
  cadena.maybeSingle = vi.fn(async () => respuesta);
  cadena.then = (onFulfilled) => Promise.resolve(respuesta).then(onFulfilled);
  return cadena;
}

function crearAdminMock(respuestas: Record<string, RespuestaMock>) {
  const cadenas: Record<string, CadenaMock> = {};
  const from = vi.fn((tabla: string) => {
    cadenas[tabla] ??= crearCadena(respuestas[tabla] ?? { data: null, error: null });
    return cadenas[tabla];
  });
  const admin = { from } as unknown as ReturnType<typeof createAdminClient>;
  return { admin, cadenas };
}

function crearUsuarioMock(rol: RolUsuario, extra: Partial<PerfilUsuario> = {}): PerfilUsuario {
  return {
    id: `mock-${rol.toLowerCase()}-id`,
    rol,
    nombre_completo: `Usuario ${rol}`,
    cuit: '20-12345678-9',
    matricula: null,
    tipo_comprador: null,
    wallet: null,
    productor_id: null,
    veterinario_id: null,
    comprador_id: null,
    email: `${rol.toLowerCase()}@muunar.test`,
    ...extra,
  };
}

function ultimoRedirect(): string {
  return String(vi.mocked(redirect).mock.calls.at(-1)?.[0] ?? '');
}

const POLIGONO_VALIDO = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-58.5, -34.5],
      [-58.4, -34.5],
      [-58.4, -34.6],
      [-58.5, -34.5],
    ],
  ],
});

const CSV_PESADAS = 'caravana_rfid,peso_kg\n032000000000001,300\n032000000000002,320\n';

const WALLET_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

function crearFormularioLote(): FormData {
  const formData = new FormData();
  formData.set('renspa', '12.345.6.78901/02');
  formData.set('marcaLiquida', 'true');
  formData.set('provincia', 'Córdoba');
  formData.set('localidad', 'Río Cuarto');
  formData.set('poligono', POLIGONO_VALIDO);
  formData.set('tipoOperacion', 'Invernada / Engorde');
  formData.set('categoria', 'Novillitos');
  formData.set('raza', 'Braford');
  formData.set('tipoRodeo', 'Rodeo general');
  formData.set('edadMeses', '24');
  formData.set('denticion', 'Dientes de leche');
  formData.set('tratamientoNutricional', 'Ninguno');
  formData.set('moneda', 'USDC');
  formData.set('montoTotalFinanciacion', '15000');
  formData.set('pesoObjetivoKg', '340');
  formData.set('plazoMeses', '6');
  formData.set('fechaVigencia', '2026-11-01');
  formData.set('descripcionOperacion', 'Invernada de novillitos para exportación a la UE.');
  formData.set('productor_nombre', 'Otro');
  formData.set('productor_cuit', '00-00000000-0');
  formData.set('productor_wallet', WALLET_TESTNET);
  formData.set('archivo_rfid_csv', new File([CSV_PESADAS], 'pesadas.csv', { type: 'text/csv' }));
  return formData;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('crearLoteAction (guard de rol)', () => {
  it('rechaza la creación de lote sin sesión', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const estado = await crearLoteAction({ errors: [] }, new FormData());

    expect(estado.errors).toHaveLength(1);
    expect(estado.errors[0]).toContain('Productor');
  });

  it('rechaza la creación de lote a un usuario sin rol PRODUCTOR', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(crearUsuarioMock('VETERINARIO'));

    const estado = await crearLoteAction({ errors: [] }, new FormData());

    expect(estado.errors).toHaveLength(1);
    expect(estado.errors[0]).toContain('Productor');
  });
});

describe('crearLoteAction (identidad desde la sesión)', () => {
  it('usa nombre y CUIT de la sesión e ignora los valores del formulario', async () => {
    vi.stubEnv('GFW_API_KEY', '');
    vi.mocked(getCurrentUser).mockResolvedValue(
      crearUsuarioMock('PRODUCTOR', {
        nombre_completo: 'Cabaña Sesión SA',
        cuit: '30-11111111-1',
        productor_id: 'prod-sesion',
      }),
    );
    const { admin, cadenas } = crearAdminMock({
      caravanas: { data: [], error: null },
      productores: { data: { id: 'prod-sesion' }, error: null },
      lotes: { data: { id: 'lote-1', codigo_lote: 'LOTE-TEST-1' }, error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(admin);

    const estado = await crearLoteAction({ errors: [] }, crearFormularioLote());

    expect(cadenas['productores'].upsert).toHaveBeenCalledWith(
      {
        wallet: WALLET_TESTNET,
        nombre_razon_social: 'Cabaña Sesión SA',
        cuit: '30-11111111-1',
      },
      { onConflict: 'wallet' },
    );
    expect(estado.errors).toHaveLength(1);
    expect(estado.errors[0]).toContain('LOTE-TEST-1');
    expect(estado.errors[0]).toContain('GFW_API_KEY');
  });
});

describe('reintentarGfwAction (guard de sesión y propiedad del lote)', () => {
  it('rechaza el reintento EUDR sin sesión', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const formData = new FormData();
    formData.set('codigo', 'LOTE-1');

    await expect(reintentarGfwAction(formData)).rejects.toThrow(/NEXT_REDIRECT/);

    expect(ultimoRedirect()).toContain('error=');
  });

  it('rechaza el reintento EUDR cuando el lote es de otro productor', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      crearUsuarioMock('PRODUCTOR', { productor_id: 'prod-login', wallet: 'GWALLET-LOGIN' }),
    );
    const { admin } = crearAdminMock({
      lotes: {
        data: {
          id: 'lote-ajeno',
          codigo_lote: 'LOTE-AJENO',
          productor_id: 'prod-otro',
          productor_wallet: 'GWALLET-OTRO',
        },
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(admin);
    const formData = new FormData();
    formData.set('codigo', 'LOTE-AJENO');

    await expect(reintentarGfwAction(formData)).rejects.toThrow(/NEXT_REDIRECT/);

    expect(decodeURIComponent(ultimoRedirect())).toContain('dueño del lote');
  });

  it('deja reintentar al productor dueño del lote (wallet coincide)', async () => {
    vi.stubEnv('GFW_API_KEY', '');
    vi.mocked(getCurrentUser).mockResolvedValue(
      crearUsuarioMock('PRODUCTOR', { productor_id: null, wallet: 'GDEMO-PRODUCTOR' }),
    );
    const { admin } = crearAdminMock({
      lotes: {
        data: {
          id: 'lote-1',
          codigo_lote: 'LOTE-1',
          productor_id: 'prod-otro',
          productor_wallet: 'GDEMO-PRODUCTOR',
        },
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(admin);
    const formData = new FormData();
    formData.set('codigo', 'LOTE-1');

    await expect(reintentarGfwAction(formData)).rejects.toThrow(/NEXT_REDIRECT/);

    expect(ultimoRedirect()).toContain('gfw=error');
  });
});
