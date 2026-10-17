import { sha256Hex } from '@/lib/crypto';
import { hayDeforestacion, type GfwResult } from '@/lib/gfw';
import { jsonCanonico } from '@/lib/json-canonico';
import { construirManifiestoOrigenV2 } from '@/lib/reportes-ambientales';
import type { LecturaLoteOnChain } from '@/lib/stellar-read';

export const ORIGEN_ESTADOS = [
  'PENDIENTE',
  'PREPARADO',
  'ENVIADO',
  'CONFIRMADO',
  'DEMO',
  'CONFLICTO',
  'RECHAZADO',
] as const;

export type OrigenEstado = (typeof ORIGEN_ESTADOS)[number];

export type EscrituraLote = { loteId: string; patch: Record<string, unknown> };

export type ErrorEscritura = { message: string; code?: string } | null;

export type EnvioOrigen = {
  codigoLote: string;
  productorWallet: string;
  renspaDocHash: string;
  rfidListHash: string;
  eudrGeoHash: string;
  headCount: number;
  initialAvgWeightKg: number;
  targetWeightKg: number;
  financingAmount: number;
};

export type DepsOrigen = {
  consultarGfw: (input: { poligono: unknown }) => Promise<GfwResult>;
  enviarOrigen: (input: EnvioOrigen) => Promise<{ txHash: string }>;
  leerOnChain: (codigoLote: string) => Promise<LecturaLoteOnChain>;
  modoAnclaje: () => { red: string; contratoId: string | null; modo: 'fake' | 'real' };
  actualizarLote: (escritura: EscrituraLote) => Promise<{ error: ErrorEscritura }>;
  registrarRechazo: (escritura: EscrituraLote) => Promise<{ error: ErrorEscritura }>;
  ahora?: () => string;
};

export type InputOrigen = {
  loteId: string;
  codigoLote: string;
  poligono: unknown;
  productorWallet: string;
  renspaDocHash: string;
  rfidHash: string;
  headCount: number;
  initialAvgWeightKg: number;
  targetWeightKg: number;
  financingAmount: number;
  origenEstado: OrigenEstado;
  origenManifest: string | null;
  origenManifestHash: string | null;
  txHashExistente: string | null;
};

export type ResultadoOrigen =
  | { estado: 'confirmado'; txHash: string | null; reconciliado: boolean; reutilizado: boolean }
  | { estado: 'rechazado' }
  | { estado: 'rechazado_previo'; error: string }
  | { estado: 'sin_cambios' }
  | { estado: 'conflicto'; error: string }
  | { estado: 'reintentar_envio'; error: string }
  | { estado: 'reintentar_conciliacion'; error: string };

const mensaje = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type Preparacion =
  | { ok: true; texto: string; raiz: string; reutilizado: boolean }
  | { ok: false; resultado: ResultadoOrigen };

function confirmacionPatch(
  modo: { red: string; contratoId: string | null; modo: 'fake' | 'real' },
  txHash: string | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    seal_1_eudr: true,
    estado_publicacion: 'DISPONIBLE',
    origen_estado: modo.modo === 'real' ? 'CONFIRMADO' : 'DEMO',
    anclaje_red: modo.red,
    anclaje_contrato_id: modo.contratoId,
    anclaje_estado: modo.modo === 'real' ? 'CONFIRMADO' : 'DEMO',
  };
  if (txHash) patch.soroban_create_tx_hash = txHash;
  return patch;
}

/**
 * Fallo "definido" (la invocación fue rechazada y no quedó nada en la red) vs
 * "incierto" (timeout/red/ya-existe: puede haber quedado anclado). El caso #1
 * del contrato ("el lote ya existe") exige reconciliar, nunca reenviar a ciegas.
 */
export function clasificarFalloEnvio(error: unknown): 'incierto' | 'no_enviado' {
  const texto = mensaje(error);
  if (/Error\(Contract,\s*#1\)/.test(texto) || /ya existe en el contrato/i.test(texto)) {
    return 'incierto';
  }
  const patron =
    /fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|network|timed?\s?out|timeout|aborted|abort|429|50[0-4]\b/i;
  return patron.test(texto) ? 'incierto' : 'no_enviado';
}

async function prepararManifiesto(deps: DepsOrigen, input: InputOrigen): Promise<Preparacion> {
  let gfw: GfwResult;
  try {
    gfw = await deps.consultarGfw({ poligono: input.poligono });
  } catch (error) {
    return {
      ok: false,
      resultado: {
        estado: 'reintentar_envio',
        error: `Global Forest Watch no respondió: ${mensaje(error)}`,
      },
    };
  }

  const manifiesto = construirManifiestoOrigenV2({
    codigoLote: input.codigoLote,
    poligono: input.poligono,
    gfw,
  });
  const texto = jsonCanonico(manifiesto);
  const raiz = sha256Hex(texto);

  if (hayDeforestacion(gfw)) {
    const { error } = await deps.registrarRechazo({
      loteId: input.loteId,
      patch: {
        gfw_consulta: gfw,
        eudr_geo_hash: raiz,
        origen_manifest: texto,
        origen_manifest_hash: raiz,
        estado_publicacion: 'RECHAZADO_EUDR',
        origen_estado: 'RECHAZADO',
      },
    });
    if (error) {
      return {
        ok: false,
        resultado: {
          estado: 'reintentar_envio',
          error: `Se detectó deforestación pero no se pudo guardar la evidencia del rechazo: ${error.message}`,
        },
      };
    }
    return { ok: false, resultado: { estado: 'rechazado' } };
  }

  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const { error } = await deps.actualizarLote({
    loteId: input.loteId,
    patch: {
      gfw_consulta: gfw,
      eudr_geo_hash: raiz,
      origen_manifest: texto,
      origen_manifest_hash: raiz,
      origen_estado: 'PREPARADO',
      origen_preparado_en: ahora(),
    },
  });
  if (error) {
    return {
      ok: false,
      resultado: {
        estado: 'reintentar_envio',
        error: `No se pudo preparar y guardar el manifiesto de origen: ${error.message}`,
      },
    };
  }

  return { ok: true, texto, raiz, reutilizado: false };
}

async function obtenerPreparacion(deps: DepsOrigen, input: InputOrigen): Promise<Preparacion> {
  // Manifiesto congelado: bytes y raíz se reutilizan tal cual; no se vuelve a
  // consultar GFW ni se reescriben timestamps.
  if (input.origenManifest) {
    return {
      ok: true,
      texto: input.origenManifest,
      raiz: input.origenManifestHash ?? sha256Hex(input.origenManifest),
      reutilizado: true,
    };
  }
  return prepararManifiesto(deps, input);
}

async function enviarYConfirmar(
  deps: DepsOrigen,
  input: InputOrigen,
  modo: { red: string; contratoId: string | null; modo: 'fake' | 'real' },
  preparacion: { texto: string; raiz: string; reutilizado: boolean },
): Promise<ResultadoOrigen> {
  const { error: errorEnviado } = await deps.actualizarLote({
    loteId: input.loteId,
    patch: { origen_estado: 'ENVIADO' },
  });
  if (errorEnviado) {
    return {
      estado: 'reintentar_envio',
      error: `No se pudo registrar el intento de envío (${errorEnviado.message}); no se envió nada on-chain. Reintentá.`,
    };
  }

  let envio: { txHash: string };
  try {
    envio = await deps.enviarOrigen({
      codigoLote: input.codigoLote,
      productorWallet: input.productorWallet,
      renspaDocHash: input.renspaDocHash,
      rfidListHash: input.rfidHash,
      eudrGeoHash: preparacion.raiz,
      headCount: input.headCount,
      initialAvgWeightKg: input.initialAvgWeightKg,
      targetWeightKg: input.targetWeightKg,
      financingAmount: input.financingAmount,
    });
  } catch (error) {
    const detalle = mensaje(error);
    if (clasificarFalloEnvio(error) === 'incierto') {
      return {
        estado: 'reintentar_conciliacion',
        error: `El envío on-chain quedó en estado incierto (${detalle}). Reintentá: se reconciliará el lote ${input.codigoLote} sin reenviar si ya quedó anclado.`,
      };
    }
    await deps.actualizarLote({ loteId: input.loteId, patch: { origen_estado: 'PREPARADO' } });
    return {
      estado: 'reintentar_envio',
      error: `El registro on-chain no se pudo completar y no se envió: ${detalle}. Reintentá.`,
    };
  }

  const { error } = await deps.actualizarLote({
    loteId: input.loteId,
    patch: confirmacionPatch(modo, envio.txHash),
  });
  if (error) {
    return {
      estado: 'reintentar_conciliacion',
      error: `La transacción ${envio.txHash} se envió pero no se pudo guardar la confirmación (${error.message}). El lote ${input.codigoLote} no se pierde: al reintentar se reconcilia contra la cadena sin reenviar.`,
    };
  }

  return {
    estado: 'confirmado',
    txHash: envio.txHash,
    reconciliado: false,
    reutilizado: preparacion.reutilizado,
  };
}

async function reconciliar(
  deps: DepsOrigen,
  input: InputOrigen,
  modo: { red: string; contratoId: string | null; modo: 'fake' | 'real' },
): Promise<ResultadoOrigen> {
  const esperada = input.origenManifest
    ? (input.origenManifestHash ?? sha256Hex(input.origenManifest))
    : null;

  let lectura: LecturaLoteOnChain;
  try {
    lectura = await deps.leerOnChain(input.codigoLote);
  } catch (error) {
    lectura = { estado: 'error', detalle: mensaje(error) };
  }

  // Sin contrato configurado (modo demo) no hay cadena que consultar: el envío
  // local es determinista, así que un ENVIADO sin confirmación se reenvía sin
  // riesgo de doble anclaje.
  if (
    lectura.estado === 'error' &&
    modo.modo === 'fake' &&
    lectura.detalle.includes('contrato_no_configurado')
  ) {
    lectura = { estado: 'no_existe' };
  }

  if (lectura.estado === 'error') {
    return {
      estado: 'reintentar_conciliacion',
      error: `No se pudo comprobar el lote ${input.codigoLote} en Stellar (${lectura.detalle}). Se mantiene ENVIADO; reintentá en unos segundos.`,
    };
  }

  if (lectura.estado === 'existe') {
    if (esperada === null) {
      // Best-effort: el conflicto se persiste para congelar la evidencia y
      // bloquear reintentos automáticos.
      await deps.actualizarLote({ loteId: input.loteId, patch: { origen_estado: 'CONFLICTO' } });
      return {
        estado: 'conflicto',
        error: `El lote ${input.codigoLote} ya existe on-chain pero no hay manifiesto preparado para comparar. No se reenvía: revisá la evidencia antes de continuar.`,
      };
    }
    if (lectura.eudrGeoHash !== esperada) {
      await deps.actualizarLote({ loteId: input.loteId, patch: { origen_estado: 'CONFLICTO' } });
      return {
        estado: 'conflicto',
        error: `CONFLICTO: la raíz anclada del lote ${input.codigoLote} no coincide con la preparada. No se reenvía automáticamente; revisá la evidencia del origen.`,
      };
    }
    const { error } = await deps.actualizarLote({
      loteId: input.loteId,
      patch: confirmacionPatch(modo, input.txHashExistente),
    });
    if (error) {
      return {
        estado: 'reintentar_conciliacion',
        error: `La cadena ya registra el lote ${input.codigoLote} con la raíz correcta, pero no se pudo guardar la confirmación (${error.message}). Reintentá: se reconciliará sin reenviar.`,
      };
    }
    return {
      estado: 'confirmado',
      txHash: input.txHashExistente,
      reconciliado: true,
      reutilizado: true,
    };
  }

  const preparacion = await obtenerPreparacion(deps, input);
  if (!preparacion.ok) return preparacion.resultado;
  return enviarYConfirmar(deps, input, modo, preparacion);
}

/**
 * Núcleo recuperable del alta del origen: preparar → enviar → confirmar, con
 * reconciliación idempotente contra la cadena. Sin red ni base de datos: todas
 * las dependencias se inyectan para poder probarlo con fakes.
 */
export async function ejecutarOrigen(
  deps: DepsOrigen,
  input: InputOrigen,
): Promise<ResultadoOrigen> {
  if (input.origenEstado === 'RECHAZADO') {
    return {
      estado: 'rechazado_previo',
      error:
        'Este lote ya fue rechazado por pérdida de bosque (EUDR): su evidencia quedó congelada y no admite un nuevo anclaje.',
    };
  }
  if (input.origenEstado === 'CONFIRMADO' || input.origenEstado === 'DEMO') {
    return { estado: 'sin_cambios' };
  }
  if (input.origenEstado === 'CONFLICTO') {
    return {
      estado: 'conflicto',
      error: `El origen del lote ${input.codigoLote} quedó en CONFLICTO (la raíz anclada no coincide con la preparada) y requiere revisión manual; no se reintenta automáticamente.`,
    };
  }

  const modo = deps.modoAnclaje();

  if (input.origenEstado === 'ENVIADO') {
    return reconciliar(deps, input, modo);
  }

  const preparacion = await obtenerPreparacion(deps, input);
  if (!preparacion.ok) return preparacion.resultado;
  return enviarYConfirmar(deps, input, modo, preparacion);
}

export type DatosHuellaCreacion = {
  renspa: string;
  poligonoHash: string;
  rfidHash: string;
  monto: number;
  cabezas: number;
  pesoObjetivoKg?: number;
  categoria?: string;
  raza?: string;
  tipoOperacion?: string;
  tipoRodeo?: string;
  plazoMeses?: number;
  fechaVigencia?: string;
  moneda?: string;
};

/** Huella de los datos de alta para detectar reenvíos de la misma clave con datos distintos. */
export function huellaCreacion(datos: DatosHuellaCreacion): string {
  return sha256Hex(
    jsonCanonico({
      renspa: datos.renspa,
      poligonoHash: datos.poligonoHash,
      rfidHash: datos.rfidHash,
      monto: datos.monto,
      cabezas: datos.cabezas,
      pesoObjetivoKg: datos.pesoObjetivoKg ?? null,
      categoria: datos.categoria ?? null,
      raza: datos.raza ?? null,
      tipoOperacion: datos.tipoOperacion ?? null,
      tipoRodeo: datos.tipoRodeo ?? null,
      plazoMeses: datos.plazoMeses ?? null,
      fechaVigencia: datos.fechaVigencia ?? null,
      moneda: datos.moneda ?? null,
    }),
  );
}

export const MENSAJE_CLAVE_USADA =
  'La clave de envío ya fue usada con otros datos. Recargá la página y verificá el lote ya registrado.';

export type DecisionReplay =
  | { accion: 'crear' }
  | { accion: 'redirigir'; codigoLote: string }
  | { accion: 'conflicto'; error: string };

export function decidirReplay(input: {
  existente: { codigoLote: string; creacionHuella: string | null } | null;
  huella: string;
}): DecisionReplay {
  if (!input.existente) return { accion: 'crear' };
  // Huella ausente = lote creado antes de este control: no se puede comparar,
  // se conserva el comportamiento histórico (redirigir al lote existente).
  if (input.existente.creacionHuella === null || input.existente.creacionHuella === input.huella) {
    return { accion: 'redirigir', codigoLote: input.existente.codigoLote };
  }
  return { accion: 'conflicto', error: MENSAJE_CLAVE_USADA };
}

export const MENSAJE_LOTE_AJENO =
  'Este lote pertenece a otro productor: solo la cuenta que lo creó puede reintentar el anclaje EUDR.';

/** `creadoPor === null` es un lote legacy (sin dueño registrado): se permite reintentar. */
export function verificarTitularidadLote(input: {
  creadoPor: string | null;
  usuarioId: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.creadoPor !== null && input.creadoPor !== input.usuarioId) {
    return { ok: false, error: MENSAJE_LOTE_AJENO };
  }
  return { ok: true };
}
