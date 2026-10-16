'use client';

import type UniversalProvider from '@walletconnect/universal-provider';
import { STELLAR_NETWORK_PASSPHRASE, WALLETCONNECT_PROJECT_ID } from '@/lib/stellar-config';
import { traducirErrorPagoStellar } from '@/lib/stellar/payments';

/**
 * Integración WalletConnect v2 para Freighter Mobile.
 *
 * Limitación documentada del ecosistema:
 * El módulo WalletConnect de Stellar Wallets Kit solo expone `stellar_signXDR` y `stellar_signAndSubmitXDR`
 * (sin `stellar_signMessage` ni `stellar_signAuthEntry`, ver stellar/freighter-mobile#815).
 * Por ello integramos `@walletconnect/universal-provider` directamente sobre la cadena `stellar:testnet`
 * y reutilizamos `lib/stellar/payments.ts` para construir y enviar los pagos clásicos USDC.
 */

export const STELLAR_WC_CHAIN_TESTNET = 'stellar:testnet';
export const STELLAR_WC_CHAIN_PUBNET = 'stellar:pubnet';

export const STELLAR_WC_METHODS = ['stellar_signXDR', 'stellar_signAndSubmitXDR'] as const;

let providerInstance: UniversalProvider | null = null;

export type SesionWalletConnect = {
  address: string;
  chainId: string;
  topic: string;
};

export function cadenaWalletConnectActiva(): string {
  return STELLAR_NETWORK_PASSPHRASE.includes('Public')
    ? STELLAR_WC_CHAIN_PUBNET
    : STELLAR_WC_CHAIN_TESTNET;
}

/**
 * Extrae la clave pública Stellar (G...) desde una cuenta CAIP-10 (`stellar:testnet:G...`).
 */
export function extraerAddressDeCaip10(cuentaCaip10: string): {
  chainId: string;
  address: string;
} {
  const partes = cuentaCaip10.trim().split(':');
  if (partes.length < 3 || partes[0] !== 'stellar') {
    throw new Error(`Formato de cuenta WalletConnect inválido: ${cuentaCaip10}`);
  }
  return {
    chainId: `${partes[0]}:${partes[1]}`,
    address: partes[2],
  };
}

/**
 * Inicializa o reutiliza la instancia de `UniversalProvider` de WalletConnect v2.
 */
export async function obtenerProviderWalletConnect(): Promise<UniversalProvider> {
  if (providerInstance) return providerInstance;

  const { UniversalProvider: WCUniversalProvider } =
    await import('@walletconnect/universal-provider');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://muunar.agro';

  providerInstance = await WCUniversalProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: 'Muunar — Trazabilidad Ganadera EUDR',
      description: 'Trazabilidad ganadera con sellos EUDR y pagos USDC en Stellar Testnet',
      url: origin,
      icons: [`${origin}/favicon.ico`],
    },
  });

  return providerInstance;
}

/**
 * Inicia el emparejamiento WalletConnect v2 con Freighter Mobile.
 * Emite la URI (`wc:...`) mediante `onUri` para mostrar el QR o abrir el deep-link en mobile.
 */
export async function conectarFreighterMobile(opts?: {
  onUri?: (uri: string) => void;
  provider?: UniversalProvider;
}): Promise<SesionWalletConnect> {
  const provider = opts?.provider ?? (await obtenerProviderWalletConnect());
  const chainDeseada = cadenaWalletConnectActiva();

  const handleDisplayUri = (uri: string) => {
    opts?.onUri?.(uri);
  };

  provider.on('display_uri', handleDisplayUri);

  try {
    const session = await provider.connect({
      namespaces: {
        stellar: {
          methods: [...STELLAR_WC_METHODS],
          chains: [chainDeseada],
          events: ['accountsChanged'],
        },
      },
    });

    if (!session) {
      throw new Error('No se pudo establecer la sesión WalletConnect con Freighter Mobile.');
    }

    const cuentas = session.namespaces?.stellar?.accounts ?? [];
    if (cuentas.length === 0) {
      throw new Error('Freighter Mobile no devolvió ninguna cuenta Stellar en la sesión.');
    }

    const { chainId, address } = extraerAddressDeCaip10(cuentas[0]);
    if (chainId !== STELLAR_WC_CHAIN_TESTNET) {
      throw new Error(
        `Freighter Mobile está en "${chainId}". Cambiá la red a Testnet antes de firmar.`,
      );
    }

    const metodosAprobados = session.namespaces?.stellar?.methods ?? [];
    if (!metodosAprobados.includes('stellar_signXDR')) {
      throw new Error('La sesión WalletConnect no habilitó el método requerido stellar_signXDR.');
    }

    return {
      address,
      chainId,
      topic: session.topic,
    };
  } finally {
    provider.removeListener?.('display_uri', handleDisplayUri);
  }
}

/**
 * Desconecta la sesión activa de WalletConnect v2 si existe.
 */
export async function desconectarFreighterMobile(
  providerOverride?: UniversalProvider,
): Promise<void> {
  const provider = providerOverride ?? providerInstance;
  if (!provider?.session) return;
  try {
    await provider.disconnect();
  } catch {
    // Ignorar errores al cerrar sesión ya expirada
  }
}

/**
 * Firma un XDR en Freighter Mobile vía `stellar_signXDR` sobre `stellar:testnet`.
 * Compatible con `FirmadorTransaccion` de `lib/stellar/payments.ts`.
 */
export async function firmarXdrConWalletConnect(
  xdr: string,
  opts: {
    address: string;
    chainId?: string;
    provider?: Pick<UniversalProvider, 'request'>;
  },
): Promise<{ signedTxXdr: string; signerAddress: string }> {
  const chainId = opts.chainId ?? STELLAR_WC_CHAIN_TESTNET;
  if (chainId !== STELLAR_WC_CHAIN_TESTNET) {
    throw new Error(
      'Red incorrecta en Freighter: cambiá tu wallet a Stellar TESTNET antes de firmar.',
    );
  }

  const provider = opts.provider ?? (await obtenerProviderWalletConnect());

  try {
    const res = await provider.request<{ signedXDR?: string; signedTxXdr?: string }>(
      {
        method: 'stellar_signXDR',
        params: { xdr },
      },
      chainId,
    );

    const signedTxXdr = res?.signedXDR ?? res?.signedTxXdr;
    if (!signedTxXdr) {
      throw new Error('Freighter Mobile no devolvió el XDR firmado.');
    }

    return {
      signedTxXdr,
      signerAddress: opts.address,
    };
  } catch (err) {
    throw new Error(traducirErrorPagoStellar(err), { cause: err });
  }
}
