import { StrKey } from '@stellar/stellar-sdk';

// Conversión de datos de la app a los tipos del contrato `trazabilidad`.
// Pesos en gramos (u32) y montos en la unidad mínima del token (i128, 7 decimales).

export const TOKEN_DECIMALES = 7;
const FACTOR = 10 ** TOKEN_DECIMALES;

export function esWalletStellar(valor: string): boolean {
  return StrKey.isValidEd25519PublicKey(valor);
}

/** 10000.5 USDC -> 100005000000n */
export function aUnidadesToken(monto: number): bigint {
  return BigInt(Math.round(monto * FACTOR));
}

/** 100005000000n -> 10000.5 */
export function desdeUnidadesToken(unidades: bigint): number {
  return Math.round((Number(unidades) / FACTOR) * 100) / 100;
}

export const kgAGramos = (kg: number): number => Math.round(kg * 1000);

export type ArgsContrato = Record<string, string | number | bigint>;

export type OrigenInput = {
  codigoLote: string;
  productorWallet: string;
  renspaDocHash: string;
  rfidListHash: string;
  eudrGeoHash: string;
  cabezas: number;
  pesoInicialKg: number;
  pesoObjetivoKg: number;
  monto: number;
};

export function argsOrigen(i: OrigenInput): ArgsContrato {
  return {
    codigo: i.codigoLote,
    producer: i.productorWallet,
    renspa_doc_hash: i.renspaDocHash,
    rfid_list_hash: i.rfidListHash,
    eudr_geo_hash: i.eudrGeoHash,
    head_count: i.cabezas,
    initial_avg_weight_g: kgAGramos(i.pesoInicialKg),
    target_weight_g: kgAGramos(i.pesoObjetivoKg),
    financing_amount: aUnidadesToken(i.monto),
  };
}

export function argsFondeo(i: {
  codigoLote: string;
  compradorWallet: string;
  monto: number;
}): ArgsContrato {
  return { codigo: i.codigoLote, buyer: i.compradorWallet, amount: aUnidadesToken(i.monto) };
}

export function argsSanidad(i: {
  codigoLote: string;
  vetWallet: string;
  pesoMes4Kg: number;
  adpvGramosDia: number;
  actaHash: string;
  csvMes4Hash: string;
}): ArgsContrato {
  return {
    codigo: i.codigoLote,
    vet: i.vetWallet,
    midterm_avg_weight_g: kgAGramos(i.pesoMes4Kg),
    adpv_g_per_day: i.adpvGramosDia,
    vaccination_acta_hash: i.actaHash,
    midterm_weights_hash: i.csvMes4Hash,
  };
}

export function argsCierre(i: {
  codigoLote: string;
  compradorWallet: string;
  pesoFinalKg: number;
  dteHash: string;
  recepcionHash: string;
}): ArgsContrato {
  return {
    codigo: i.codigoLote,
    buyer: i.compradorWallet,
    final_avg_weight_g: kgAGramos(i.pesoFinalKg),
    dte_pdf_hash: i.dteHash,
    reception_hash: i.recepcionHash,
  };
}

/** Métodos del contrato y el orden de sus argumentos (debe coincidir con `lib.rs`). */
export const ORDEN_ARGS = {
  create_and_verify_origin: [
    'codigo',
    'producer',
    'renspa_doc_hash',
    'rfid_list_hash',
    'eudr_geo_hash',
    'head_count',
    'initial_avg_weight_g',
    'target_weight_g',
    'financing_amount',
  ],
  authorize_vet: ['vet'],
  fund_lot_escrow: ['codigo', 'buyer', 'amount'],
  verify_sanitary_milestone: [
    'codigo',
    'vet',
    'midterm_avg_weight_g',
    'adpv_g_per_day',
    'vaccination_acta_hash',
    'midterm_weights_hash',
  ],
  complete_delivery_and_settle: [
    'codigo',
    'buyer',
    'final_avg_weight_g',
    'dte_pdf_hash',
    'reception_hash',
  ],
} as const;

export type MetodoContrato = keyof typeof ORDEN_ARGS;

/** Traduce un código de error del contrato (`Error(Contract, #N)`) a un mensaje en español. */
const ERRORES_CONTRATO: Record<number, string> = {
  1: 'El lote ya existe en el contrato',
  2: 'El lote no existe en el contrato (¿se emitió el Sello 1?)',
  3: 'El lote no está en el estado correcto para esta operación',
  4: 'El monto no coincide con el financiamiento del lote',
  5: 'Auto-compra bloqueada: el comprador no puede ser el productor',
  6: 'Esta wallet no está autorizada como veterinario acreditado para este lote',
  7: 'ADPV fuera del rango biológico (0,5–1,3 kg/día): desembolso frenado',
  8: 'La wallet no coincide con el comprador que fondeó el lote',
  9: 'Peso inválido',
};

export function mensajeErrorContrato(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  const match = /Error\(Contract,\s*#(\d+)\)/.exec(texto) ?? /#(\d+)/.exec(texto);
  if (match) {
    const mensaje = ERRORES_CONTRATO[Number(match[1])];
    if (mensaje) return mensaje;
  }
  if (/trustline|op_no_trust|trust/i.test(texto)) {
    return 'Falta la trustline de USDC en alguna de las cuentas involucradas (comprador o productor)';
  }
  if (/insufficient|balance/i.test(texto)) {
    return 'Saldo insuficiente de USDC en la wallet del comprador';
  }
  return texto;
}
