import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Account,
  Keypair,
  TransactionBuilder,
  type Operation,
  type Transaction,
} from '@stellar/stellar-sdk';
import {
  construirXdrPagoUsdc,
  construirXdrPagoUsdcDesdeCuenta,
  ejecutarPagoUsdcTestnet,
  enviarXdrFirmadoAHorizon,
  esErrorRedirectNext,
  firmarXdrConFreighterDesktop,
  traducirErrorPagoStellar,
} from '@/lib/stellar/payments';
import {
  conectarFreighter,
  firmarConFreighter,
  obtenerDetallesConexionFreighter,
} from '@/lib/freighter';
import {
  conectarFreighterMobile,
  extraerAddressDeCaip10,
  firmarXdrConWalletConnect,
  STELLAR_WC_CHAIN_TESTNET,
} from '@/lib/stellar/walletconnect';
import { STELLAR_NETWORK_PASSPHRASE, USDC_ASSET_ISSUER } from '@/lib/stellar-config';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  signTransaction: vi.fn(),
}));

import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';

const BUYER_KP = Keypair.random();
const PRODUCER_KP = Keypair.random();
const VET_KP = Keypair.random();

const BUYER_ADDR = BUYER_KP.publicKey();
const PRODUCER_ADDR = PRODUCER_KP.publicKey();
const VET_ADDR = VET_KP.publicKey();

describe('lib/stellar/payments — construcción de XDR y firma en Freighter Testnet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('construye un XDR válido de pago clásico USDC en Testnet con memo y monto de 7 decimales', () => {
    const cuentaMock = new Account(BUYER_ADDR, '100000001');
    const xdr = construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
      sourceAddress: BUYER_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 250.5,
      memoText: 'FUND:LOTE-00107',
    });

    expect(typeof xdr).toBe('string');
    expect(xdr.length).toBeGreaterThan(40);

    const parsedTx = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK_PASSPHRASE) as Transaction;
    expect(parsedTx.source).toBe(BUYER_ADDR);
    expect(Buffer.from(parsedTx.memo.value as Uint8Array).toString('utf8')).toBe('FUND:LOTE-00107');
    expect(parsedTx.operations).toHaveLength(1);

    const op = parsedTx.operations[0] as Operation.Payment;
    expect(op.type).toBe('payment');
    expect(op.destination).toBe(PRODUCER_ADDR);
    expect(op.amount).toBe('250.5000000');
    expect(op.asset.getCode()).toBe('USDC');
    expect(op.asset.getIssuer()).toBe(USDC_ASSET_ISSUER);
  });

  it('cuando el monto es 0 (ej. firma de hito sanitario por veterinario) envía 0.0000001 USDC para dejar registro on-chain', () => {
    const cuentaMock = new Account(VET_ADDR, '200000001');
    const xdr = construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
      sourceAddress: VET_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 0,
      memoText: 'SEAL2:LOTE-00107',
    });

    const parsedTx = TransactionBuilder.fromXDR(xdr, STELLAR_NETWORK_PASSPHRASE);
    const op = parsedTx.operations[0] as Operation.Payment;
    expect(op.amount).toBe('0.0000001');
  });

  it('rechaza direcciones inválidas (ej. GDEMO-* o texto arbitrario) al construir el XDR', () => {
    const cuentaMock = new Account(BUYER_ADDR, '100000001');
    expect(() =>
      construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
        sourceAddress: 'GDEMO-COMPRADOR',
        destinationAddress: PRODUCER_ADDR,
        amountUsdc: 100,
      }),
    ).toThrow(/no es una clave pública Stellar válida/);

    expect(() =>
      construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
        sourceAddress: BUYER_ADDR,
        destinationAddress: 'GDEMO-PRODUCTOR',
        amountUsdc: 100,
      }),
    ).toThrow(/no es una clave pública Stellar válida/);
  });

  it('firma XDR con Freighter Desktop pasando network: TESTNET y address, y envía a Horizon', async () => {
    const cuentaMock = new Account(BUYER_ADDR, '300000001');
    const xdrSinFirmar = construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
      sourceAddress: BUYER_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 40,
      memoText: 'FUND:LOTE-00108',
    });

    const txFirmadaReal = TransactionBuilder.fromXDR(xdrSinFirmar, STELLAR_NETWORK_PASSPHRASE);
    txFirmadaReal.sign(BUYER_KP);
    const xdrFirmadoFixture = txFirmadaReal.toXDR();

    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: xdrFirmadoFixture,
      signerAddress: BUYER_ADDR,
    });

    const hashEsperado = 'a'.repeat(64);
    const horizonMock = {
      loadAccount: vi.fn().mockResolvedValue(new Account(BUYER_ADDR, '300000000')),
      submitTransaction: vi.fn().mockResolvedValue({ hash: hashEsperado }),
    };

    const resultado = await ejecutarPagoUsdcTestnet({
      sourceAddress: BUYER_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 40,
      memoText: 'FUND:LOTE-00108',
      horizonServer: horizonMock,
    });

    expect(signTransaction).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        network: 'TESTNET',
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
        address: BUYER_ADDR,
      }),
    );
    expect(horizonMock.submitTransaction).toHaveBeenCalledTimes(1);
    expect(resultado.txHash).toBe(hashEsperado);
    expect(resultado.explorerUrl).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hashEsperado}`,
    );
    expect(resultado.signedTxXdr).toBe(xdrFirmadoFixture);
  });

  it('maneja errores de usuario rechaza firma, cuenta sin fondear, trustline faltante y saldo insuficiente', async () => {
    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: '',
      signerAddress: '',
      error: { code: -4, message: 'The user rejected this request.' },
    });

    await expect(firmarXdrConFreighterDesktop('AAAA', BUYER_ADDR)).rejects.toThrow(
      /Rechazaste la firma/,
    );

    const horizonSinCuenta = {
      loadAccount: vi.fn().mockRejectedValue(new Error('404 Not Found')),
    };
    await expect(
      construirXdrPagoUsdc({
        sourceAddress: BUYER_ADDR,
        destinationAddress: PRODUCER_ADDR,
        amountUsdc: 10,
        horizonServer: horizonSinCuenta,
      }),
    ).rejects.toThrow(/Friendbot/);

    const cuentaMock = new Account(BUYER_ADDR, '400000001');
    const xdrFixture = construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
      sourceAddress: BUYER_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 10,
    });

    const horizonNoTrust = {
      submitTransaction: vi.fn().mockRejectedValue({
        response: { data: { extras: { result_codes: { operations: ['op_no_trust'] } } } },
      }),
    };
    await expect(
      enviarXdrFirmadoAHorizon(xdrFixture, { horizonServer: horizonNoTrust }),
    ).rejects.toThrow(/Trustline insuficiente/);

    expect(traducirErrorPagoStellar(new Error('op_underfunded'))).toMatch(/Saldo insuficiente/);
    expect(traducirErrorPagoStellar(new Error('Please switch to TESTNET network'))).toMatch(
      /Red incorrecta/,
    );
  });
});

describe('lib/freighter — conexión Desktop y gating de red TESTNET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloquea la conexión si Freighter no está instalado', async () => {
    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: false });

    await expect(conectarFreighter()).rejects.toThrow(/No se detectó la extensión Freighter/);
  });

  it('detecta cuando Freighter está en PUBLIC (Mainnet) y bloquea con mensaje de gating de red', async () => {
    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: true });
    vi.mocked(requestAccess).mockResolvedValueOnce({ address: BUYER_ADDR });
    vi.mocked(getAddress).mockResolvedValueOnce({ address: BUYER_ADDR });
    vi.mocked(getNetworkDetails).mockResolvedValueOnce({
      network: 'PUBLIC',
      networkUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });

    const detalles = await obtenerDetallesConexionFreighter();
    expect(detalles.address).toBe(BUYER_ADDR);
    expect(detalles.network).toBe('PUBLIC');
    expect(detalles.esTestnet).toBe(false);

    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: true });
    vi.mocked(requestAccess).mockResolvedValueOnce({ address: BUYER_ADDR });
    vi.mocked(getNetworkDetails).mockResolvedValueOnce({
      network: 'PUBLIC',
      networkUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });

    await expect(conectarFreighter()).rejects.toThrow(/Cambiá la red a TESTNET/);
  });

  it('conecta y firma exitosamente cuando Freighter está en TESTNET', async () => {
    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: true });
    vi.mocked(requestAccess).mockResolvedValueOnce({ address: PRODUCER_ADDR });
    vi.mocked(getNetworkDetails).mockResolvedValueOnce({
      network: 'TESTNET',
      networkUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    });

    const addr = await conectarFreighter();
    expect(addr).toBe(PRODUCER_ADDR);

    vi.mocked(signTransaction).mockResolvedValueOnce({
      signedTxXdr: 'SIGNED_XDR_MOCK',
      signerAddress: PRODUCER_ADDR,
    });

    const firma = await firmarConFreighter('UNSIGNED_XDR_MOCK', { address: PRODUCER_ADDR });
    expect(firma.signedTxXdr).toBe('SIGNED_XDR_MOCK');
    expect(signTransaction).toHaveBeenCalledWith(
      'UNSIGNED_XDR_MOCK',
      expect.objectContaining({
        network: 'TESTNET',
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
        address: PRODUCER_ADDR,
      }),
    );
  });
});

describe('lib/stellar/walletconnect — Fase B Mobile (WalletConnect v2)', () => {
  it('extrae correctamente la dirección G... y chainId desde CAIP-10', () => {
    const parsed = extraerAddressDeCaip10(`stellar:testnet:${BUYER_ADDR}`);
    expect(parsed.chainId).toBe(STELLAR_WC_CHAIN_TESTNET);
    expect(parsed.address).toBe(BUYER_ADDR);
  });

  it('establece sesión WalletConnect v2 en stellar:testnet y firma XDR reutilizando ejecutarPagoUsdcTestnet', async () => {
    const cuentaMock = new Account(BUYER_ADDR, '500000001');
    const xdrFirmado = construirXdrPagoUsdcDesdeCuenta(cuentaMock, {
      sourceAddress: BUYER_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 15,
    });

    const providerMock = {
      on: vi.fn(),
      removeListener: vi.fn(),
      connect: vi.fn().mockResolvedValue({
        topic: 'wc-topic-123',
        namespaces: {
          stellar: {
            accounts: [`stellar:testnet:${BUYER_ADDR}`],
            methods: ['stellar_signXDR', 'stellar_signAndSubmitXDR'],
          },
        },
      }),
      request: vi.fn().mockResolvedValue({ signedXDR: xdrFirmado }),
    };

    const sesion = await conectarFreighterMobile({
      provider: providerMock as never,
    });
    expect(sesion.address).toBe(BUYER_ADDR);
    expect(sesion.chainId).toBe('stellar:testnet');

    const resPago = await ejecutarPagoUsdcTestnet({
      sourceAddress: BUYER_ADDR,
      destinationAddress: PRODUCER_ADDR,
      amountUsdc: 15,
      signer: (xdr, opts) =>
        firmarXdrConWalletConnect(xdr, {
          address: opts.address,
          provider: providerMock as never,
        }),
      horizonServer: {
        loadAccount: vi.fn().mockResolvedValue(new Account(BUYER_ADDR, '500000000')),
        submitTransaction: vi.fn().mockResolvedValue({ hash: 'b'.repeat(64) }),
      },
    });

    expect(providerMock.request).toHaveBeenCalledWith(
      {
        method: 'stellar_signXDR',
        params: { xdr: expect.any(String) },
      },
      'stellar:testnet',
    );
    expect(resPago.txHash).toBe('b'.repeat(64));
  });
});

function listarArchivosUi(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      resultado.push(...listarArchivosUi(ruta));
    } else if (/\.(ts|tsx)$/.test(entrada)) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

describe('Criterio de aceptación — Cero GDEMO-* en la UI y manejo de NEXT_REDIRECT', () => {
  it('ningún componente o página en app/ ni components/ contiene defaults o strings GDEMO-*', () => {
    const archivos = [
      ...listarArchivosUi(join(process.cwd(), 'app')),
      ...listarArchivosUi(join(process.cwd(), 'components')),
    ];

    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, 'utf8');
      expect(contenido, `Se encontró GDEMO-* en ${archivo}`).not.toMatch(/GDEMO-/);
    }
  });

  it('detecta redirecciones de Next.js (NEXT_REDIRECT por message o digest) y las ignora en fondeo, auditoría y recepción', () => {
    expect(esErrorRedirectNext(new Error('NEXT_REDIRECT'))).toBe(true);
    expect(
      esErrorRedirectNext(
        Object.assign(new Error('Redirect'), {
          digest: 'NEXT_REDIRECT;push;/lotes/LOTE-DEMO-0039;303;',
        }),
      ),
    ).toBe(true);
    expect(esErrorRedirectNext(new Error('Rechazaste la firma'))).toBe(false);

    const formulariosConAction = [
      join(process.cwd(), 'app', 'lotes', '[codigo]', 'form-fondeo.tsx'),
      join(process.cwd(), 'app', 'lotes', '[codigo]', 'auditoria', 'form-auditoria.tsx'),
      join(process.cwd(), 'app', 'lotes', '[codigo]', 'recepcion', 'form-recepcion.tsx'),
    ];

    for (const ruta of formulariosConAction) {
      const contenido = readFileSync(ruta, 'utf8');
      expect(contenido, `Falta esErrorRedirectNext en ${ruta}`).toContain('esErrorRedirectNext');
    }
  });

  it('Sello 2 (auditoría) y Sello 3 (recepción) firman conformidad simbólica (0.0000001 USDC) sin volver a debitar el 30 % de la wallet', () => {
    const formAuditoria = readFileSync(
      join(process.cwd(), 'app', 'lotes', '[codigo]', 'auditoria', 'form-auditoria.tsx'),
      'utf8',
    );
    const formRecepcion = readFileSync(
      join(process.cwd(), 'app', 'lotes', '[codigo]', 'recepcion', 'form-recepcion.tsx'),
      'utf8',
    );

    expect(formAuditoria).toContain('amountUsdc: 0.0000001');
    expect(formRecepcion).toContain('amountUsdc: 0.0000001');
  });
});
