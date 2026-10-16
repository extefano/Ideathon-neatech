'use client';

import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { STELLAR_NETWORK_PASSPHRASE } from '@/lib/stellar-config';

// SOLO NAVEGADOR: wrapper de Freighter (wallet SEP-43). Las claves nunca salen de la extensión.

export async function conectarFreighter(): Promise<string> {
  const conexion = await isConnected();
  if (!conexion.isConnected) {
    throw new Error('No se detectó la extensión Freighter. Instalala desde freighter.app');
  }

  const acceso = await requestAccess();
  if (acceso.error) throw new Error(`Freighter rechazó el acceso: ${acceso.error.message}`);

  const red = await getNetworkDetails();
  if (!red.error && red.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
    throw new Error(
      `Freighter está en "${red.network}". Cambiá la red a Testnet desde la configuración de la extensión.`,
    );
  }

  const direccion = acceso.address || (await getAddress()).address;
  if (!direccion) throw new Error('Freighter no devolvió una dirección');
  return direccion;
}

/** `signTransaction` compatible con `contract.Client` (firma SEP-43). */
export async function firmarConFreighter(
  xdrTx: string,
  opts?: { networkPassphrase?: string; address?: string },
): Promise<{ signedTxXdr: string; signerAddress?: string }> {
  const res = await signTransaction(xdrTx, {
    networkPassphrase: opts?.networkPassphrase ?? STELLAR_NETWORK_PASSPHRASE,
    address: opts?.address,
  });
  if (res.error) {
    throw new Error(
      res.error.code === -4
        ? 'Rechazaste la firma en Freighter'
        : `Freighter no pudo firmar: ${res.error.message}`,
    );
  }
  return { signedTxXdr: res.signedTxXdr, signerAddress: res.signerAddress };
}

/** Verifica si la cuenta en Testnet tiene la trustline a USDC y su balance. */
export async function verificarEstadoCuentaUsdc(
  address: string,
): Promise<{ tieneTrustline: boolean; balanceUsdc: number; existe: boolean }> {
  try {
    const { STELLAR_HORIZON_URL, USDC_ASSET_CODE, USDC_ASSET_ISSUER } = await import(
      '@/lib/stellar-config'
    );
    const res = await fetch(`${STELLAR_HORIZON_URL}/accounts/${address}`);
    if (!res.ok) return { tieneTrustline: false, balanceUsdc: 0, existe: false };
    const data = (await res.json()) as {
      balances?: Array<{
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
      }>;
    };
    const linea = data.balances?.find(
      (b) => b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ASSET_ISSUER,
    );
    return {
      existe: true,
      tieneTrustline: Boolean(linea),
      balanceUsdc: linea ? parseFloat(linea.balance) : 0,
    };
  } catch {
    return { tieneTrustline: false, balanceUsdc: 0, existe: false };
  }
}

/** Abre la trustline de USDC en Freighter enviando una operación changeTrust. */
export async function crearTrustlineUsdcConFreighter(address: string): Promise<string> {
  const { Asset, Horizon, Operation, TransactionBuilder } = await import('@stellar/stellar-sdk');
  const { STELLAR_HORIZON_URL, USDC_ASSET_CODE, USDC_ASSET_ISSUER } = await import(
    '@/lib/stellar-config'
  );

  const server = new Horizon.Server(STELLAR_HORIZON_URL);
  const account = await server.loadAccount(address);
  const usdc = new Asset(USDC_ASSET_CODE, USDC_ASSET_ISSUER);

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(30)
    .build();

  const { signedTxXdr } = await firmarConFreighter(tx.toXDR(), { address });
  const txFirmada = TransactionBuilder.fromXDR(signedTxXdr, STELLAR_NETWORK_PASSPHRASE);
  const result = await server.submitTransaction(txFirmada);
  return result.hash;
}

