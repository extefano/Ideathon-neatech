import {
  Address,
  Asset,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
  type xdr,
  type Transaction,
} from '@stellar/stellar-sdk';
import { KeypairSigner } from '@stellar/stellar-sdk/contract';
import { sha256Hex } from '@/lib/crypto';
import { invocarContrato } from '@/lib/stellar-invoke';
import {
  ORDEN_ARGS,
  argsOrigen,
  esWalletStellar,
  type ArgsContrato,
  type MetodoContrato,
  type OrigenInput,
} from '@/lib/stellar-args';
import {
  STELLAR_CONTRACT_ID,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
  USDC_ASSET_CODE,
  USDC_ASSET_ISSUER,
  explorerTxUrl,
} from '@/lib/stellar-config';

function fallbackWallet(wallet: string | null | undefined, fallback: string): string {
  if (wallet && esWalletStellar(wallet)) return wallet;
  return fallback;
}

export type StellarTx = { txHash: string; explorerUrl: string };

export type CreateOriginInput = {
  codigoLote: string;
  producerWallet: string;
  renspaDocHash: string;
  rfidListHash: string;
  eudrGeoHash: string;
  headCount: number;
  initialAvgWeightKg: number;
  targetWeightKg: number;
  financingAmount: number;
  tokenSacAddress: string;
};

export type FundLotInput = {
  codigoLote: string;
  buyerWallet: string;
  amount: number;
};

export type VerifySanitaryInput = {
  codigoLote: string;
  vetWallet: string;
  midtermAvgWeightKg: number;
  adpvGramsPerDay: number;
  vaccinationActaHash: string;
  midtermRfidWeightsHash: string;
};

export type CompleteDeliveryInput = {
  codigoLote: string;
  buyerWallet: string;
  finalAvgWeightKg: number;
  dtePdfHash: string;
  receptionHash: string;
  shortfallDeduction: number;
};

export interface StellarTraceabilityClient {
  createAndVerifyOrigin(input: CreateOriginInput): Promise<StellarTx>;
  fundLotEscrow(input: FundLotInput): Promise<StellarTx>;
  verifySanitaryMilestone(input: VerifySanitaryInput): Promise<StellarTx>;
  completeDeliveryAndSettle(input: CompleteDeliveryInput): Promise<StellarTx>;
}

/**
 * Modo demo: genera tx hashes deterministas para cuando no hay red o keys configuradas.
 */
export class FakeStellarClient implements StellarTraceabilityClient {
  constructor(private readonly salt: string = 'demo-2026') {}

  async createAndVerifyOrigin(input: CreateOriginInput): Promise<StellarTx> {
    return this.tx('create_and_verify_origin', input);
  }

  async fundLotEscrow(input: FundLotInput): Promise<StellarTx> {
    return this.tx('fund_lot_escrow', input);
  }

  async verifySanitaryMilestone(input: VerifySanitaryInput): Promise<StellarTx> {
    return this.tx('verify_sanitary_milestone', input);
  }

  async completeDeliveryAndSettle(input: CompleteDeliveryInput): Promise<StellarTx> {
    return this.tx('complete_delivery_and_settle', input);
  }

  private tx(method: string, input: unknown): StellarTx {
    const txHash = sha256Hex(`fake-soroban:${this.salt}:${method}:${JSON.stringify(input)}`);
    return { txHash, explorerUrl: explorerTxUrl(txHash) };
  }
}

/**
 * Cliente real sobre Soroban testnet para las llamadas del servidor (oráculo / admin).
 */
export class SorobanServerClient implements StellarTraceabilityClient {
  async createAndVerifyOrigin(input: CreateOriginInput): Promise<StellarTx> {
    const admin = adminKeypair();
    const { txHash } = await crearOrigenOnChain({
      codigoLote: input.codigoLote,
      productorWallet: fallbackWallet(input.producerWallet, admin.publicKey()),
      renspaDocHash: input.renspaDocHash,
      rfidListHash: input.rfidListHash,
      eudrGeoHash: input.eudrGeoHash,
      cabezas: input.headCount,
      pesoInicialKg: input.initialAvgWeightKg,
      pesoObjetivoKg: input.targetWeightKg,
      monto: input.financingAmount,
    });
    return { txHash, explorerUrl: explorerTxUrl(txHash) };
  }

  async fundLotEscrow(input: FundLotInput): Promise<StellarTx> {
    // Si se invoca desde el servidor (fallback), firma con admin
    const admin = adminKeypair();
    const { txHash } = await invocarContrato({
      metodo: 'fund_lot_escrow',
      args: {
        codigo: input.codigoLote,
        buyer: fallbackWallet(input.buyerWallet, admin.publicKey()),
        amount: BigInt(Math.round(input.amount * 10_000_000)),
      },
      publicKey: admin.publicKey(),
      signTransaction: new KeypairSigner(admin, STELLAR_NETWORK_PASSPHRASE),
    });
    return { txHash, explorerUrl: explorerTxUrl(txHash) };
  }

  async verifySanitaryMilestone(input: VerifySanitaryInput): Promise<StellarTx> {
    const admin = adminKeypair();
    const { txHash } = await invocarContrato({
      metodo: 'verify_sanitary_milestone',
      args: {
        codigo: input.codigoLote,
        vet: fallbackWallet(input.vetWallet, admin.publicKey()),
        midterm_avg_weight_g: Math.round(input.midtermAvgWeightKg * 1000),
        adpv_g_per_day: input.adpvGramsPerDay,
        vaccination_acta_hash: input.vaccinationActaHash,
        midterm_weights_hash: input.midtermRfidWeightsHash,
      },
      publicKey: admin.publicKey(),
      signTransaction: new KeypairSigner(admin, STELLAR_NETWORK_PASSPHRASE),
    });
    return { txHash, explorerUrl: explorerTxUrl(txHash) };
  }

  async completeDeliveryAndSettle(input: CompleteDeliveryInput): Promise<StellarTx> {
    const admin = adminKeypair();
    const { txHash } = await invocarContrato({
      metodo: 'complete_delivery_and_settle',
      args: {
        codigo: input.codigoLote,
        buyer: fallbackWallet(input.buyerWallet, admin.publicKey()),
        final_avg_weight_g: Math.round(input.finalAvgWeightKg * 1000),
        dte_pdf_hash: input.dtePdfHash,
        reception_hash: input.receptionHash,
      },
      publicKey: admin.publicKey(),
      signTransaction: new KeypairSigner(admin, STELLAR_NETWORK_PASSPHRASE),
    });
    return { txHash, explorerUrl: explorerTxUrl(txHash) };
  }
}

export const TOKEN_SAC_TESTNET_USDC =
  process.env.NEXT_PUBLIC_STELLAR_USDC_SAC ??
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

export function getStellarClient(): StellarTraceabilityClient {
  const modo = process.env.STELLAR_MODE ?? 'fake';
  if (modo === 'real') {
    if (!STELLAR_CONTRACT_ID || !process.env.STELLAR_ADMIN_SECRET) {
      throw new Error(
        'Modo real incompleto: faltan NEXT_PUBLIC_STELLAR_CONTRACT_ID o STELLAR_ADMIN_SECRET. Corregí la configuración o usá STELLAR_MODE=fake para la demo.',
      );
    }
    return new SorobanServerClient();
  }
  return new FakeStellarClient();
}

/** Contexto de anclaje para registrar en la evidencia del lote (nunca como real si es demo). */
export function contextoAnclajeStellar(): {
  red: 'testnet' | 'public';
  contratoId: string | null;
  modo: 'fake' | 'real';
} {
  const red = STELLAR_NETWORK_PASSPHRASE.includes('Public') ? 'public' : 'testnet';
  return {
    red,
    contratoId: STELLAR_CONTRACT_ID || null,
    modo: (process.env.STELLAR_MODE ?? 'fake') === 'real' ? 'real' : 'fake',
  };
}

export function adminKeypair(): Keypair {
  const secret = process.env.STELLAR_ADMIN_SECRET;
  if (!secret) {
    throw new Error('Falta STELLAR_ADMIN_SECRET en el entorno del servidor (cuenta oráculo/admin)');
  }
  return Keypair.fromSecret(secret);
}

/** Sello 1: lo firma el oráculo/admin del backend tras validar el polígono contra GFW. */
export async function crearOrigenOnChain(input: OrigenInput): Promise<{ txHash: string }> {
  const admin = adminKeypair();
  const producer = fallbackWallet(input.productorWallet, admin.publicKey());
  const { txHash } = await invocarContrato({
    metodo: 'create_and_verify_origin',
    args: argsOrigen({
      ...input,
      productorWallet: producer,
    }),
    publicKey: admin.publicKey(),
    signTransaction: new KeypairSigner(admin, STELLAR_NETWORK_PASSPHRASE),
  });
  return { txHash };
}

/** Habilita una wallet de veterinario en el contrato (solo admin). */
export async function autorizarVeterinarioOnChain(vetWallet: string): Promise<{ txHash: string }> {
  const admin = adminKeypair();
  const vet = fallbackWallet(vetWallet, admin.publicKey());
  const { txHash } = await invocarContrato({
    metodo: 'authorize_vet',
    args: { vet },
    publicKey: admin.publicKey(),
    signTransaction: new KeypairSigner(admin, STELLAR_NETWORK_PASSPHRASE),
  });
  return { txHash };
}

type RespuestaTx = {
  status: string;
  envelopeXdr?: xdr.TransactionEnvelope;
  returnValue?: xdr.ScVal;
};

export type FuenteTx = { getTransaction(hash: string): Promise<RespuestaTx> };

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function obtenerTxExitosa(fuente: FuenteTx, txHash: string, intentos: number) {
  for (let i = 0; i < intentos; i++) {
    const res = await fuente.getTransaction(txHash);
    if (res.status === 'SUCCESS') return res;
    if (res.status === 'FAILED') {
      throw new Error('La transacción fue rechazada por la red (FAILED)');
    }
    await esperar(1000);
  }
  throw new Error('La transacción no se encontró en la red (todavía NOT_FOUND)');
}

const normalizar = (valor: unknown): string => String(valor);

type InvokeContractArgsLike = {
  contractAddress: xdr.ScAddress;
  functionName: { toString(): string; bytes?: Uint8Array };
  args: xdr.ScVal[];
};

type HostFunctionLike = {
  type: string;
  invokeContract?: InvokeContractArgsLike;
};

/**
 * Verifica on-chain que `txHash` es una invocación EXITOSA del contrato configurado, firmada por
 * `wallet`, al método esperado y con exactamente los argumentos que el backend derivó de los
 * datos. Evita que un cliente registre en la base un hash ajeno o con otros datos.
 */
export async function verificarTxOnChain(opts: {
  txHash: string;
  wallet: string;
  metodo: MetodoContrato;
  args: ArgsContrato;
  contractId?: string;
  fuente?: FuenteTx;
  intentos?: number;
}): Promise<{ txHash: string; resultado: unknown }> {
  const contractId = opts.contractId ?? STELLAR_CONTRACT_ID;
  const fuente = opts.fuente ?? (new rpc.Server(STELLAR_RPC_URL) as unknown as FuenteTx);

  const res = await obtenerTxExitosa(fuente, opts.txHash, opts.intentos ?? 10);
  if (!res.envelopeXdr) throw new Error('La red no devolvió el envelope de la transacción');

  const tx = TransactionBuilder.fromXDR(res.envelopeXdr, STELLAR_NETWORK_PASSPHRASE) as Transaction;
  if (tx.source !== opts.wallet) {
    throw new Error('La transacción no fue firmada por la wallet esperada');
  }

  const op = tx.operations[0];
  if (!op || op.type !== 'invokeHostFunction') {
    throw new Error('La transacción no invoca un contrato');
  }

  const fn = op.func as unknown as HostFunctionLike;
  const invocacion = fn.invokeContract;
  if (!invocacion) {
    throw new Error('La operación no es de tipo invokeContract');
  }

  const contrato = Address.fromScAddress(invocacion.contractAddress).toString();
  if (contrato !== contractId) {
    throw new Error('La transacción invoca un contrato distinto al configurado');
  }

  const metodoOnChain = invocacion.functionName.toString();
  if (metodoOnChain !== opts.metodo) {
    throw new Error(`La transacción invoca ${metodoOnChain} y se esperaba ${opts.metodo}`);
  }

  const nativos = invocacion.args.map((a: xdr.ScVal) => scValToNative(a));
  const orden = ORDEN_ARGS[opts.metodo];
  orden.forEach((nombre, i) => {
    if (normalizar(nativos[i]) !== normalizar(opts.args[nombre])) {
      throw new Error(`El argumento "${nombre}" de la transacción no coincide con los datos`);
    }
  });

  const resultado = res.returnValue ? scValToNative(res.returnValue) : undefined;
  return { txHash: opts.txHash, resultado };
}

/**
 * Faucet/transferencia de USDC en Testnet desde la cuenta admin hacia una wallet de prueba.
 * Utiliza pathPaymentStrictReceive para garantizar la entrega de USDC usando la liquidez del DEX.
 */
export async function transferirUsdcDemo(
  destino: string,
  monto: number,
): Promise<{ txHash: string }> {
  const admin = adminKeypair();
  const server = new Horizon.Server(STELLAR_HORIZON_URL);
  const account = await server.loadAccount(admin.publicKey());
  const usdc = new Asset(USDC_ASSET_CODE, USDC_ASSET_ISSUER);

  const lineaUsdc = account.balances.find(
    (b) => b.asset_type === 'credit_alphanum4' && b.asset_code === USDC_ASSET_CODE,
  );
  const saldoActual = lineaUsdc ? parseFloat(lineaUsdc.balance) : 0;

  // Si el admin tiene saldo suficiente de USDC, usamos pago directo (más rápido y sin riesgo de slippage)
  if (saldoActual >= monto) {
    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: destino,
          asset: usdc,
          amount: monto.toFixed(7),
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(admin);
    const result = await server.submitTransaction(tx);
    return { txHash: result.hash };
  }

  // Si excede la liquidez accesible en testnet (1 USDC ~ 9.3 XLM)
  if (monto > 300) {
    throw new Error(
      `En Stellar Testnet la liquidez del DEX es limitada. Para probar el fondeo completo con Freighter, creá un lote con un monto de prueba accesible (ej: 10 a 50 USDC). Saldo disponible en faucet: ${Math.floor(saldoActual)} USDC.`,
    );
  }

  // Si es un monto menor o igual a 300, intercambiamos XLM por USDC mediante pathPayment
  const maxSendXlm = String(Math.ceil(monto * 12));

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: maxSendXlm,
        destination: destino,
        destAsset: usdc,
        destAmount: monto.toFixed(7),
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(admin);
  const result = await server.submitTransaction(tx);
  return { txHash: result.hash };
}
