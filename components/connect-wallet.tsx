'use client';

import { useEffect, useState } from 'react';
import { isConnected } from '@stellar/freighter-api';
import QRCode from 'qrcode';
import { obtenerDetallesConexionFreighter } from '@/lib/freighter';
import { esWalletStellar } from '@/lib/stellar-args';
import { conectarFreighterMobile, desconectarFreighterMobile } from '@/lib/stellar/walletconnect';
import type { MetodoConexionWallet } from '@/lib/stellar/payments';

export const CHROME_WEB_STORE_FREIGHTER_URL =
  'https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk';

export type EstadoWalletConectada = {
  address: string;
  network: string;
  esTestnet: boolean;
  metodo: MetodoConexionWallet;
};

export type ConnectWalletProps = {
  /** Nombre del campo hidden para enviar en FormData (ej. 'productor_wallet', 'buyer_wallet', 'vet_wallet') */
  name?: string;
  /** Etiqueta descriptiva del rol de la wallet */
  label?: string;
  /** Dirección inicial si ya estaba vinculada (solo se acepta si es G... válida de 56 caracteres) */
  initialAddress?: string | null;
  /** Callback cada vez que cambia el estado de la wallet conectada */
  onChange?: (wallet: EstadoWalletConectada | null) => void;
  /** Callback legacy compatible con BotonFreighter */
  onConectado?: (direccion: string) => void;
};

export function acortarWallet(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectWallet({
  name,
  label = 'Wallet Stellar (Freighter)',
  initialAddress,
  onChange,
  onConectado,
}: ConnectWalletProps) {
  const walletInicialValida =
    initialAddress && esWalletStellar(initialAddress) ? initialAddress : '';

  const [direccion, setDireccion] = useState<string>(walletInicialValida);
  const [red, setRed] = useState<string>('TESTNET');
  const [esTestnet, setEsTestnet] = useState<boolean>(true);
  const [metodo, setMetodo] = useState<MetodoConexionWallet>('extension');
  const [instalado, setInstalado] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para WalletConnect v2 (Mobile QR + deep-link)
  const [wcUri, setWcUri] = useState<string | null>(null);
  const [wcQrDataUrl, setWcQrDataUrl] = useState<string | null>(null);
  const [conectandoMobile, setConectandoMobile] = useState<boolean>(false);

  useEffect(() => {
    let cancelado = false;
    void isConnected()
      .then((res) => {
        if (!cancelado) setInstalado(Boolean(res?.isConnected));
      })
      .catch(() => {
        if (!cancelado) setInstalado(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const notificarCambio = (nuevoEstado: EstadoWalletConectada | null) => {
    onChange?.(nuevoEstado);
    if (nuevoEstado?.address && nuevoEstado.esTestnet) {
      onConectado?.(nuevoEstado.address);
    } else if (!nuevoEstado) {
      onConectado?.('');
    }
  };

  const handleConectarExtension = async () => {
    setCargando(true);
    setError(null);
    try {
      const detalles = await obtenerDetallesConexionFreighter();
      setDireccion(detalles.address);
      setRed(detalles.network);
      setEsTestnet(detalles.esTestnet);
      setMetodo('extension');
      notificarCambio({
        address: detalles.address,
        network: detalles.network,
        esTestnet: detalles.esTestnet,
        metodo: 'extension',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  };

  const handleConectarMobile = async () => {
    setConectandoMobile(true);
    setError(null);
    setWcUri(null);
    setWcQrDataUrl(null);

    try {
      const sesion = await conectarFreighterMobile({
        onUri: (uri) => {
          setWcUri(uri);
          void QRCode.toDataURL(uri, {
            margin: 1,
            width: 220,
            color: { dark: '#000000', light: '#ffffff' },
          }).then((url) => setWcQrDataUrl(url));
        },
      });

      setDireccion(sesion.address);
      setRed('TESTNET');
      setEsTestnet(true);
      setMetodo('walletconnect');
      setWcUri(null);
      setWcQrDataUrl(null);

      notificarCambio({
        address: sesion.address,
        network: 'TESTNET',
        esTestnet: true,
        metodo: 'walletconnect',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConectandoMobile(false);
    }
  };

  const handleDesconectar = async () => {
    if (metodo === 'walletconnect') {
      await desconectarFreighterMobile();
    }
    setDireccion('');
    setRed('TESTNET');
    setEsTestnet(true);
    setError(null);
    setWcUri(null);
    setWcQrDataUrl(null);
    notificarCambio(null);
  };

  return (
    <div className="space-y-2" data-testid="connect-wallet">
      {label && (
        <span className="mb-1 block text-xs font-medium tracking-wide text-neutral-400 uppercase">
          {label}
        </span>
      )}

      {name && (
        <input
          type="hidden"
          name={name}
          value={esTestnet ? direccion : ''}
          data-testid={`wallet-input-${name}`}
        />
      )}

      {direccion ? (
        <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${esTestnet ? 'bg-brand' : 'bg-red-500'}`}
              />
              <span className="font-mono font-semibold text-neutral-100" title={direccion}>
                {acortarWallet(direccion)}
              </span>
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300 uppercase">
                {metodo === 'walletconnect' ? 'Freighter Mobile (WC v2)' : `Freighter · ${red}`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleDesconectar()}
              className="cursor-pointer rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-red-500/50 hover:text-red-300"
            >
              Desconectar
            </button>
          </div>

          {!esTestnet && (
            <div
              role="alert"
              className="border-brand/40 bg-brand/10 text-brand rounded border p-2.5 text-xs"
            >
              ⚠️ <strong>Red incorrecta ({red}):</strong> Freighter no está en{' '}
              <strong>TESTNET</strong>. Cambiá la red a Testnet en tu wallet y volvé a conectar; la
              firma está bloqueada hasta estar en Testnet.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {instalado === false && (
            <div
              role="alert"
              className="border-brand/40 bg-brand/10 rounded-md border p-3 text-xs text-neutral-200"
            >
              <p className="text-brand font-semibold">
                Extensión Freighter no detectada en este navegador
              </p>
              <p className="mt-1 text-neutral-300">
                Para operar y firmar transacciones en Stellar Testnet debés instalar la extensión en
                desktop o conectar Freighter Mobile vía WalletConnect v2:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a
                  href={CHROME_WEB_STORE_FREIGHTER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-brand hover:bg-brand/90 inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-neutral-950"
                >
                  Instalar Freighter en Chrome Web Store ↗
                </a>
                <button
                  type="button"
                  onClick={() => void handleConectarMobile()}
                  disabled={conectandoMobile}
                  className="cursor-pointer rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
                >
                  {conectandoMobile
                    ? 'Generando QR WalletConnect...'
                    : '📱 Conectar Freighter Mobile (WalletConnect v2)'}
                </button>
              </div>
            </div>
          )}

          {instalado !== false && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleConectarExtension()}
                disabled={cargando}
                className="hover:border-brand hover:text-brand inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-100 disabled:opacity-50"
              >
                <span className="h-2 w-2 rounded-full bg-neutral-500" />
                {cargando ? 'Conectando con Freighter…' : 'Conectar Freighter'}
              </button>

              <button
                type="button"
                onClick={() => void handleConectarMobile()}
                disabled={conectandoMobile}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
              >
                {conectandoMobile ? 'Abriendo QR…' : '📱 Freighter Mobile (QR)'}
              </button>
            </div>
          )}

          {wcUri && (
            <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-semibold text-white">
                    Conectar Freighter Mobile (WalletConnect v2 · Testnet)
                  </p>
                  <p className="max-w-sm text-neutral-400">
                    Escaneá el código QR desde la app móvil de Freighter o abrí el enlace directo si
                    estás en tu teléfono.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`freighter://wc?uri=${encodeURIComponent(wcUri)}`}
                      className="bg-brand hover:bg-brand/90 rounded px-3 py-1.5 font-semibold text-neutral-950"
                    >
                      Abrir en Freighter Mobile ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setWcUri(null);
                        setWcQrDataUrl(null);
                        setConectandoMobile(false);
                      }}
                      className="rounded border border-neutral-700 px-2.5 py-1.5 text-neutral-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
                {wcQrDataUrl && (
                  <img
                    src={wcQrDataUrl}
                    alt="Código QR WalletConnect v2 para Freighter Mobile"
                    width={150}
                    height={150}
                    className="rounded bg-white p-2"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
