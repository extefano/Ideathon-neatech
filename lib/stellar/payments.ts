import {
  Asset,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
  type Transaction,
} from '@stellar/stellar-sdk';
import { signTransaction as signWithFreighter } from '@stellar/freighter-api';
import {
  STELLAR_ESCROW_WALLET,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
  USDC_ASSET_CODE,
  USDC_ASSET_ISSUER,
  explorerTxUrl,
} from '@/lib/stellar-config';
import { esWalletStellar } from '@/lib/stellar-args';

export type MetodoConexionWallet = 'extension' | 'walletconnect';

export type ResultadoPagoStellar = {
  txHash: string;
  explorerUrl: string;
  signedTxXdr: string;
  signerAddress: string;
};

export type ConstruirPagoUsdcInput = {
  sourceAddress: string;
  destinationAddress: string;
  amountUsdc: number;
  memoText?: string;
  usdcIssuer?: string;
  networkPassphrase?: string;
  feeStroops?: string;
  timeoutSeconds?: number;
};

export type FirmadorTransaccion = (
  xdr: string,
  opts: { network: 'TESTNET'; networkPassphrase: string; address: string },
) => Promise<{ signedTxXdr: string; signerAddress: string }>;

/**
 * Normaliza los errores de Freighter, WalletConnect y Horizon a mensajes claros para la UI.
 */
export function traducirErrorPagoStellar(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);

  if (
    /rejected|declined|rechazaste|cancel|user denied|-4|5000/i.test(texto) ||
    texto.includes('User rejected')
  ) {
    return 'Rechazaste la firma de la transacción en tu wallet Freighter.';
  }

  if (/not found|not installed|no se detectó|internal error/i.test(texto)) {
    return 'No se detectó la extensión Freighter instalada en el navegador.';
  }

  if (
    /switch to|wrong network|different network|red incorrecta|TESTNET/i.test(texto) &&
    /network|red/i.test(texto)
  ) {
    return 'Red incorrecta en Freighter: cambiá tu wallet a Stellar TESTNET antes de firmar.';
  }

  if (/op_no_trust|no_trust|trustline|op_line_full/i.test(texto)) {
    return 'Trustline insuficiente: la cuenta de origen o destino no tiene habilitada la trustline de USDC en Testnet.';
  }

  if (/op_underfunded|underfunded|insufficient|saldo insuficiente/i.test(texto)) {
    return 'Saldo insuficiente de USDC o XLM (para gas) en tu wallet de Stellar Testnet.';
  }

  if (/op_no_destination|no_destination|404|not found in horizon/i.test(texto)) {
    return 'La cuenta Stellar no está activada en Testnet (fondeala primero con Friendbot).';
  }

  return texto;
}

/**
 * Construye un XDR de transacción clásica de pago USDC (o liquidación simbólica cuando el monto es 0 o el destino es el emisor)
 * usando una cuenta ya cargada desde Horizon (o mockeada en tests).
 */
export function construirXdrPagoUsdcDesdeCuenta(
  account:
    | Horizon.AccountResponse
    | { accountId(): string; sequenceNumber(): string; incrementSequenceNumber(): void },
  input: ConstruirPagoUsdcInput,
): string {
  if (!esWalletStellar(input.sourceAddress)) {
    throw new Error(
      'La dirección de origen (sourceAddress) no es una clave pública Stellar válida (G...)',
    );
  }
  if (!esWalletStellar(input.destinationAddress)) {
    throw new Error(
      'La dirección de destino (destinationAddress) no es una clave pública Stellar válida (G...)',
    );
  }
  if (input.amountUsdc < 0 || Number.isNaN(input.amountUsdc)) {
    throw new Error('El monto de USDC debe ser mayor o igual a cero');
  }

  const issuer = input.usdcIssuer ?? process.env.USDC_ISSUER_TESTNET ?? USDC_ASSET_ISSUER;
  const networkPassphrase = input.networkPassphrase ?? STELLAR_NETWORK_PASSPHRASE;
  const usdc = new Asset(USDC_ASSET_CODE, issuer);

  // En Stellar los montos tienen hasta 7 decimales; si es 0 (ej. firma de hito sanitario por veterinario),
  // enviamos 0.0000001 USDC (1 stroop) para registrar la transacción clásica firmada on-chain.
  const montoEfectivo = input.amountUsdc > 0 ? input.amountUsdc : 0.0000001;
  const amountStr = montoEfectivo.toFixed(7);

  // En Stellar un pago de un asset no nativo hacia su propio issuer destruye (quema) el asset,
  // lo cual requiere que el emisor no tenga flags restrictivos. Si el origen es igual al destino
  // o si se envía al escrow por defecto, Operation.payment funciona directamente.
  const builder = new TransactionBuilder(account as Horizon.AccountResponse, {
    fee: input.feeStroops ?? '100000',
    networkPassphrase,
  }).addOperation(
    Operation.payment({
      destination: input.destinationAddress,
      asset: usdc,
      amount: amountStr,
    }),
  );

  if (input.memoText) {
    // Memo.text admite hasta 28 bytes UTF-8
    const memoLimpio = input.memoText.slice(0, 28);
    builder.addMemo(Memo.text(memoLimpio));
  }

  const tx = builder.setTimeout(input.timeoutSeconds ?? 60).build();
  return tx.toXDR();
}

/**
 * Carga la cuenta en Horizon Testnet y construye el XDR de pago USDC.
 */
export async function construirXdrPagoUsdc(
  input: ConstruirPagoUsdcInput & { horizonServer?: Pick<Horizon.Server, 'loadAccount'> },
): Promise<string> {
  const server = input.horizonServer ?? new Horizon.Server(STELLAR_HORIZON_URL);
  let account;
  try {
    account = await server.loadAccount(input.sourceAddress);
  } catch (err) {
    throw new Error(
      'La cuenta Stellar no está activada en Testnet (fondeala primero con Friendbot).',
      { cause: err },
    );
  }
  return construirXdrPagoUsdcDesdeCuenta(account, input);
}

/**
 * Firma un XDR con Freighter Desktop (`@stellar/freighter-api`) exigiendo `network: 'TESTNET'`.
 */
export async function firmarXdrConFreighterDesktop(
  xdr: string,
  address: string,
): Promise<{ signedTxXdr: string; signerAddress: string }> {
  const res = await signWithFreighter(xdr, {
    network: 'TESTNET',
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    address,
  } as { networkPassphrase?: string; address?: string });

  if (res.error) {
    throw new Error(
      res.error.code === -4
        ? 'Rechazaste la firma de la transacción en tu wallet Freighter.'
        : traducirErrorPagoStellar(res.error.message),
    );
  }

  if (!res.signedTxXdr) {
    throw new Error('Freighter no devolvió la transacción firmada.');
  }

  return {
    signedTxXdr: res.signedTxXdr,
    signerAddress: res.signerAddress || address,
  };
}

/**
 * Envía un XDR firmado a Horizon Testnet y devuelve el hash de la transacción y su link al explorador.
 */
export async function enviarXdrFirmadoAHorizon(
  signedTxXdr: string,
  opts?: {
    networkPassphrase?: string;
    horizonServer?: Pick<Horizon.Server, 'submitTransaction'>;
  },
): Promise<{ txHash: string; explorerUrl: string }> {
  const networkPassphrase = opts?.networkPassphrase ?? STELLAR_NETWORK_PASSPHRASE;
  const server = opts?.horizonServer ?? new Horizon.Server(STELLAR_HORIZON_URL);
  const tx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as Transaction;

  try {
    const res = await server.submitTransaction(tx);
    return {
      txHash: res.hash,
      explorerUrl: explorerTxUrl(res.hash),
    };
  } catch (err: unknown) {
    const extras = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
      ?.response?.data?.extras?.result_codes;
    const detalle = extras
      ? JSON.stringify(extras)
      : err instanceof Error
        ? err.message
        : String(err);
    throw new Error(traducirErrorPagoStellar(detalle), { cause: err });
  }
}

/**
 * Flujo completo de pago clásico USDC en Stellar Testnet:
 * 1. Construye el XDR de pago con `@stellar/stellar-sdk`
 * 2. Solicita firma en Freighter (`signTransaction(xdr, { network: 'TESTNET', address })` o WalletConnect v2)
 * 3. Envía la transacción firmada a Horizon Testnet y devuelve `txHash` + `explorerUrl`
 */
export async function ejecutarPagoUsdcTestnet(opts: {
  sourceAddress: string;
  destinationAddress?: string;
  amountUsdc: number;
  memoText?: string;
  signer?: FirmadorTransaccion;
  horizonServer?: Pick<Horizon.Server, 'loadAccount' | 'submitTransaction'>;
}): Promise<ResultadoPagoStellar> {
  const destination =
    opts.destinationAddress && esWalletStellar(opts.destinationAddress)
      ? opts.destinationAddress
      : STELLAR_ESCROW_WALLET;

  try {
    const xdrSinFirmar = await construirXdrPagoUsdc({
      sourceAddress: opts.sourceAddress,
      destinationAddress: destination,
      amountUsdc: opts.amountUsdc,
      memoText: opts.memoText,
      horizonServer: opts.horizonServer,
    });

    const firmador: FirmadorTransaccion =
      opts.signer ?? ((xdr, signOpts) => firmarXdrConFreighterDesktop(xdr, signOpts.address));

    const { signedTxXdr, signerAddress } = await firmador(xdrSinFirmar, {
      network: 'TESTNET',
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      address: opts.sourceAddress,
    });

    const { txHash, explorerUrl } = await enviarXdrFirmadoAHorizon(signedTxXdr, {
      horizonServer: opts.horizonServer,
    });

    return {
      txHash,
      explorerUrl,
      signedTxXdr,
      signerAddress,
    };
  } catch (err) {
    throw new Error(traducirErrorPagoStellar(err), { cause: err });
  }
}
