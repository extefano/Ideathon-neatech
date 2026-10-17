import { describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@/lib/crypto';
import type { GfwResult } from '@/lib/gfw';
import { jsonCanonico } from '@/lib/json-canonico';
import {
  MENSAJE_CLAVE_USADA,
  clasificarFalloEnvio,
  decidirReplay,
  ejecutarOrigen,
  huellaCreacion,
  verificarTitularidadLote,
  type DepsOrigen,
  type EnvioOrigen,
  type EscrituraLote,
  type InputOrigen,
} from '@/lib/origen';

const POLIGONO = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-58.1, -29.5],
      [-58.07, -29.5],
      [-58.07, -29.45],
      [-58.1, -29.45],
      [-58.1, -29.5],
    ],
  ],
};

const GFW_OK: GfwResult = {
  totalLossHa: 0,
  byYear: [],
  checkedAt: '2026-10-17T05:00:00.000Z',
  criterio: 'test',
};

type Registro = {
  gfw: number;
  envios: EnvioOrigen[];
  escrituras: EscrituraLote[];
  rechazos: EscrituraLote[];
  lecturas: number;
};

function crearHarness(overrides: Partial<DepsOrigen> = {}) {
  const registro: Registro = { gfw: 0, envios: [], escrituras: [], rechazos: [], lecturas: 0 };
  let raizEnCadena: string | null = null;

  const deps: DepsOrigen = {
    consultarGfw: async () => {
      registro.gfw += 1;
      return GFW_OK;
    },
    enviarOrigen: async (envio) => {
      registro.envios.push(envio);
      raizEnCadena = envio.eudrGeoHash;
      return { txHash: `TX-${registro.envios.length}` };
    },
    leerOnChain: async () => {
      registro.lecturas += 1;
      return raizEnCadena === null
        ? { estado: 'no_existe' }
        : { estado: 'existe', eudrGeoHash: raizEnCadena, estadoContrato: 'OrigenVerificado' };
    },
    modoAnclaje: () => ({ red: 'testnet', contratoId: 'C-TEST', modo: 'fake' }),
    actualizarLote: async (escritura) => {
      registro.escrituras.push(escritura);
      return { error: null };
    },
    registrarRechazo: async (escritura) => {
      registro.rechazos.push(escritura);
      return { error: null };
    },
    ahora: () => '2026-10-17T12:00:00.000Z',
    ...overrides,
  };

  return { deps, registro };
}

function crearInput(overrides: Partial<InputOrigen> = {}): InputOrigen {
  return {
    loteId: 'lote-1',
    codigoLote: 'LOTE-00042',
    poligono: POLIGONO,
    productorWallet: 'G'.repeat(56),
    renspaDocHash: 'r'.repeat(64),
    rfidHash: 'f'.repeat(64),
    headCount: 30,
    initialAvgWeightKg: 180,
    targetWeightKg: 320,
    financingAmount: 12000,
    origenEstado: 'PENDIENTE',
    origenManifest: null,
    origenManifestHash: null,
    txHashExistente: null,
    ...overrides,
  };
}

function manifiestoPreparado(): { texto: string; raiz: string } {
  const texto = jsonCanonico({ esquema: 'muunar.origen.v2', codigoLote: 'LOTE-00042' });
  return { texto, raiz: sha256Hex(texto) };
}

describe('ejecutarOrigen', () => {
  it('prueba decisiva: si la cadena confirma pero falla la escritura de confirmación, el reintento confirma sin reenviar', async () => {
    let fallarConfirmacion = true;
    const escrituras: EscrituraLote[] = [];
    const { deps, registro } = crearHarness({
      actualizarLote: async (escritura) => {
        escrituras.push(escritura);
        if (fallarConfirmacion && escritura.patch.seal_1_eudr === true) {
          return { error: { message: 'timeout guardando la confirmación' } };
        }
        return { error: null };
      },
    });

    const primero = await ejecutarOrigen(deps, crearInput());

    expect(primero.estado).toBe('reintentar_conciliacion');
    expect(registro.envios).toHaveLength(1);
    const preparado = escrituras.find((e) => e.patch.origen_estado === 'PREPARADO');
    expect(preparado).toBeDefined();
    const raiz = String(preparado?.patch.origen_manifest_hash);
    const manifiesto = String(preparado?.patch.origen_manifest);
    expect(raiz).toMatch(/^[0-9a-f]{64}$/);

    fallarConfirmacion = false;
    const reintento = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'ENVIADO',
        origenManifest: manifiesto,
        origenManifestHash: raiz,
        txHashExistente: null,
      }),
    );

    expect(reintento).toMatchObject({
      estado: 'confirmado',
      reconciliado: true,
      txHash: null,
    });
    expect(registro.envios).toHaveLength(1);
    expect(escrituras.every((e) => e.loteId === 'lote-1')).toBe(true);
    const confirmacion = escrituras.at(-1)?.patch;
    expect(confirmacion).toMatchObject({
      seal_1_eudr: true,
      estado_publicacion: 'DISPONIBLE',
      origen_estado: 'DEMO',
    });
    // El hash de la transacción se perdió con la confirmación fallida: la
    // reconciliación confirma por raíz, no inventa un hash.
    expect(confirmacion).not.toHaveProperty('soroban_create_tx_hash');
  });

  it('con manifiesto congelado el reintento no vuelve a consultar GFW ni reescribe el manifiesto', async () => {
    const consultarGfw = vi.fn(async () => {
      throw new Error('GFW no debería llamarse en un reintento con manifiesto preparado');
    });
    const { deps, registro } = crearHarness({ consultarGfw });
    const preparado = manifiestoPreparado();

    const resultado = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'PREPARADO',
        origenManifest: preparado.texto,
        origenManifestHash: preparado.raiz,
      }),
    );

    expect(resultado).toMatchObject({ estado: 'confirmado', reutilizado: true });
    expect(consultarGfw).not.toHaveBeenCalled();
    expect(registro.envios).toHaveLength(1);
    expect(registro.envios[0].eudrGeoHash).toBe(preparado.raiz);
    expect(registro.escrituras.some((e) => 'origen_manifest' in e.patch)).toBe(false);
    expect(registro.escrituras.some((e) => 'origen_preparado_en' in e.patch)).toBe(false);
  });

  it('no_existe en la reconciliación reenvía desde el manifiesto preparado', async () => {
    const { deps, registro } = crearHarness({
      leerOnChain: async () => {
        registro.lecturas += 1;
        return { estado: 'no_existe' };
      },
    });
    const preparado = manifiestoPreparado();

    const resultado = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'ENVIADO',
        origenManifest: preparado.texto,
        origenManifestHash: preparado.raiz,
      }),
    );

    expect(resultado).toMatchObject({ estado: 'confirmado', reconciliado: false });
    expect(registro.envios).toHaveLength(1);
    expect(registro.envios[0].eudrGeoHash).toBe(preparado.raiz);
    expect(registro.escrituras.map((e) => e.patch.origen_estado)).toEqual(['ENVIADO', 'DEMO']);
  });

  it('un error de red en la reconciliación mantiene ENVIADO y no toca el lote', async () => {
    const { deps, registro } = crearHarness({
      leerOnChain: async () => ({ estado: 'error', detalle: 'fetch failed: ETIMEDOUT' }),
    });
    const preparado = manifiestoPreparado();

    const resultado = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'ENVIADO',
        origenManifest: preparado.texto,
        origenManifestHash: preparado.raiz,
      }),
    );

    expect(resultado.estado).toBe('reintentar_conciliacion');
    expect(registro.envios).toHaveLength(0);
    expect(registro.escrituras).toHaveLength(0);
  });

  it('si la raíz anclada no coincide con la preparada marca CONFLICTO y no reenvía', async () => {
    const { deps, registro } = crearHarness({
      leerOnChain: async () => ({
        estado: 'existe',
        eudrGeoHash: 'a'.repeat(64),
        estadoContrato: 'OrigenVerificado',
      }),
    });
    const preparado = manifiestoPreparado();

    const resultado = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'ENVIADO',
        origenManifest: preparado.texto,
        origenManifestHash: preparado.raiz,
      }),
    );

    expect(resultado.estado).toBe('conflicto');
    expect(registro.envios).toHaveLength(0);
    // El conflicto se persiste para congelar la evidencia y bloquear reintentos.
    expect(registro.escrituras).toHaveLength(1);
    expect(registro.escrituras[0].patch).toEqual({ origen_estado: 'CONFLICTO' });
  });

  it('en modo demo sin contrato configurado un ENVIADO se reenvía (no hay cadena que reconciliar)', async () => {
    const { deps, registro } = crearHarness({
      leerOnChain: async () => {
        registro.lecturas += 1;
        return { estado: 'error', detalle: 'contrato_no_configurado' };
      },
    });
    const preparado = manifiestoPreparado();

    const resultado = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'ENVIADO',
        origenManifest: preparado.texto,
        origenManifestHash: preparado.raiz,
      }),
    );

    expect(resultado).toMatchObject({ estado: 'confirmado', reconciliado: false });
    expect(registro.envios).toHaveLength(1);
    expect(registro.envios[0].eudrGeoHash).toBe(preparado.raiz);
  });

  it('un CONFLICTO previo no se reintenta automáticamente', async () => {
    const { deps, registro } = crearHarness();
    const preparado = manifiestoPreparado();

    const resultado = await ejecutarOrigen(
      deps,
      crearInput({
        origenEstado: 'CONFLICTO',
        origenManifest: preparado.texto,
        origenManifestHash: preparado.raiz,
      }),
    );

    expect(resultado.estado).toBe('conflicto');
    expect(registro.lecturas).toBe(0);
    expect(registro.envios).toHaveLength(0);
    expect(registro.escrituras).toHaveLength(0);
  });

  it('deforestación detectada: persiste el rechazo y no envía nada', async () => {
    const gfwConPerdida: GfwResult = {
      totalLossHa: 3.5,
      byYear: [{ year: 2022, lossHa: 3.5 }],
      checkedAt: '2026-10-17T05:00:00.000Z',
      criterio: 'test',
    };
    const { deps, registro } = crearHarness({ consultarGfw: async () => gfwConPerdida });

    const resultado = await ejecutarOrigen(deps, crearInput());

    expect(resultado).toEqual({ estado: 'rechazado' });
    expect(registro.envios).toHaveLength(0);
    expect(registro.escrituras).toHaveLength(0);
    expect(registro.rechazos).toHaveLength(1);
    expect(registro.rechazos[0].patch).toMatchObject({
      origen_estado: 'RECHAZADO',
      estado_publicacion: 'RECHAZADO_EUDR',
    });
    expect(registro.rechazos[0].patch.origen_manifest_hash).toBe(
      sha256Hex(String(registro.rechazos[0].patch.origen_manifest)),
    );

    const reintento = await ejecutarOrigen(deps, crearInput({ origenEstado: 'RECHAZADO' }));
    expect(reintento.estado).toBe('rechazado_previo');
    expect(registro.envios).toHaveLength(0);
    expect(registro.rechazos).toHaveLength(1);
  });

  it('un fallo definido del envío vuelve a PREPARADO sin quedar ENVIADO', async () => {
    const { deps, registro } = crearHarness({
      enviarOrigen: async () => {
        throw new Error('Error(Contract, #9): Peso inválido');
      },
    });

    const resultado = await ejecutarOrigen(deps, crearInput());

    expect(resultado.estado).toBe('reintentar_envio');
    expect(registro.escrituras.map((e) => e.patch.origen_estado).filter(Boolean)).toEqual([
      'PREPARADO',
      'ENVIADO',
      'PREPARADO',
    ]);
  });

  it('un fallo incierto del envío deja el lote ENVIADO para reconciliar', async () => {
    const { deps, registro } = crearHarness({
      enviarOrigen: async () => {
        throw new Error('fetch failed: connect ETIMEDOUT');
      },
    });

    const resultado = await ejecutarOrigen(deps, crearInput());

    expect(resultado.estado).toBe('reintentar_conciliacion');
    expect(registro.escrituras.map((e) => e.patch.origen_estado).filter(Boolean)).toEqual([
      'PREPARADO',
      'ENVIADO',
    ]);
  });

  it('si no se puede marcar ENVIADO no se invoca Stellar', async () => {
    const { deps, registro } = crearHarness({
      actualizarLote: async (escritura) => {
        if (escritura.patch.origen_estado === 'ENVIADO') {
          return { error: { message: 'conexión a la base caída' } };
        }
        return { error: null };
      },
    });

    const resultado = await ejecutarOrigen(deps, crearInput());

    expect(resultado.estado).toBe('reintentar_envio');
    expect(registro.envios).toHaveLength(0);
  });

  it('si falla la persistencia del manifiesto preparado no se envía', async () => {
    const { deps, registro } = crearHarness({
      actualizarLote: async (escritura) => {
        if (escritura.patch.origen_estado === 'PREPARADO') {
          return { error: { message: 'disco lleno' } };
        }
        return { error: null };
      },
    });

    const resultado = await ejecutarOrigen(deps, crearInput());

    expect(resultado.estado).toBe('reintentar_envio');
    expect(registro.envios).toHaveLength(0);
  });

  it('un lote ya confirmado no dispara ninguna dependencia', async () => {
    const { deps, registro } = crearHarness();

    const resultado = await ejecutarOrigen(deps, crearInput({ origenEstado: 'DEMO' }));

    expect(resultado).toEqual({ estado: 'sin_cambios' });
    expect(registro.gfw).toBe(0);
    expect(registro.envios).toHaveLength(0);
    expect(registro.escrituras).toHaveLength(0);
    expect(registro.lecturas).toBe(0);
  });
});

describe('idempotencia con huella de creación', () => {
  const base = {
    renspa: '12.345.6.78901/02',
    poligonoHash: 'p'.repeat(64),
    rfidHash: 'f'.repeat(64),
    monto: 12000,
    cabezas: 30,
  };

  it('es determinística y cambia si cambia cualquier dato', () => {
    const h1 = huellaCreacion(base);
    const h2 = huellaCreacion({ ...base });
    const h3 = huellaCreacion({ ...base, monto: 12001 });

    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h3).not.toBe(h1);
  });

  it('clave existente con huella igual redirige al lote existente', () => {
    const huella = huellaCreacion(base);

    expect(decidirReplay({ existente: null, huella })).toEqual({ accion: 'crear' });
    expect(
      decidirReplay({ existente: { codigoLote: 'LOTE-00042', creacionHuella: huella }, huella }),
    ).toEqual({ accion: 'redirigir', codigoLote: 'LOTE-00042' });
  });

  it('un lote legacy sin huella registrada se redirige (no se puede comparar)', () => {
    expect(
      decidirReplay({
        existente: { codigoLote: 'LOTE-00007', creacionHuella: null },
        huella: 'h'.repeat(64),
      }),
    ).toEqual({ accion: 'redirigir', codigoLote: 'LOTE-00007' });
  });

  it('clave usada con otra huella es conflicto explícito', () => {
    expect(
      decidirReplay({
        existente: { codigoLote: 'LOTE-00042', creacionHuella: 'a'.repeat(64) },
        huella: 'b'.repeat(64),
      }),
    ).toEqual({ accion: 'conflicto', error: MENSAJE_CLAVE_USADA });
  });
});

describe('titularidad del reintento', () => {
  it('rechaza el reintento cuando el lote pertenece a otro productor', () => {
    const ajeno = verificarTitularidadLote({ creadoPor: 'user-a', usuarioId: 'user-b' });
    expect(ajeno.ok).toBe(false);
    if (!ajeno.ok) expect(ajeno.error).toContain('otro productor');
  });

  it('permite el reintento del titular y de lotes legacy sin dueño', () => {
    expect(verificarTitularidadLote({ creadoPor: 'user-b', usuarioId: 'user-b' }).ok).toBe(true);
    expect(verificarTitularidadLote({ creadoPor: null, usuarioId: 'user-b' }).ok).toBe(true);
  });
});

describe('clasificarFalloEnvio', () => {
  it('trata el "lote ya existe" del contrato como incierto (hay que reconciliar)', () => {
    expect(clasificarFalloEnvio(new Error('HostError: Error(Contract, #1)'))).toBe('incierto');
    expect(clasificarFalloEnvio(new Error('El lote ya existe en el contrato'))).toBe('incierto');
  });

  it('trata timeouts y errores de red como inciertos', () => {
    expect(clasificarFalloEnvio(new Error('fetch failed'))).toBe('incierto');
    expect(clasificarFalloEnvio(new Error('connect ETIMEDOUT'))).toBe('incierto');
  });

  it('un rechazo de contrato distinto de #1 queda como no enviado', () => {
    expect(clasificarFalloEnvio(new Error('Error(Contract, #9)'))).toBe('no_enviado');
    expect(clasificarFalloEnvio(new Error('ADPV fuera del rango biológico'))).toBe('no_enviado');
  });
});
