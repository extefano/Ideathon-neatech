'use client';

import { useEffect, useState } from 'react';
import { signTransaction as signWithFreighter } from '@stellar/freighter-api';
import { ConnectWallet, type EstadoWalletConectada } from '@/components/connect-wallet';
import { invocarContrato } from '@/lib/stellar-invoke';
import { argsFondeo, esWalletStellar } from '@/lib/stellar-args';
import { STELLAR_CONTRACT_ID } from '@/lib/stellar-config';
import { fondearLoteAction, solicitarUsdcDemoAction } from '@/lib/actions';
import { crearTrustlineUsdcConFreighter, verificarEstadoCuentaUsdc } from '@/lib/freighter';
import { ejecutarPagoUsdcTestnet, esErrorRedirectNext } from '@/lib/stellar/payments';
import { firmarXdrConWalletConnect } from '@/lib/stellar/walletconnect';

const claseInput =
  'w-full rounded-md border border-borde-fuerte bg-panel px-3 py-2 text-sm text-texto focus:border-brand-fuerte focus:outline-none';
const claseLabel = 'mb-1 block text-xs font-medium uppercase tracking-wide text-texto-suave';

export function FormFondeo({
  codigoLote,
  monto,
  productorWallet,
  buyerNombreInicial,
  buyerWalletInicial,
}: {
  codigoLote: string;
  monto: number;
  productorWallet?: string;
  buyerNombreInicial?: string;
  buyerWalletInicial?: string;
}) {
  const walletInicialValida =
    buyerWalletInicial && esWalletStellar(buyerWalletInicial) ? buyerWalletInicial : '';

  const [walletState, setWalletState] = useState<EstadoWalletConectada | null>(
    walletInicialValida
      ? { address: walletInicialValida, network: 'TESTNET', esTestnet: true, metodo: 'extension' }
      : null,
  );
  const [buyerNombre, setBuyerNombre] = useState(buyerNombreInicial ?? 'Frigorífico Exportador SA');
  const [cargando, setCargando] = useState(false);
  const [estadoTx, setEstadoTx] = useState<string | null>(null);
  const [errorTx, setErrorTx] = useState<string | null>(null);

  // Estado de la cuenta en Stellar Testnet
  const [tieneTrustline, setTieneTrustline] = useState<boolean | null>(null);
  const [balanceUsdc, setBalanceUsdc] = useState<number>(0);
  const [verificandoUsdc, setVerificandoUsdc] = useState(false);
  const [creandoTrustline, setCreandoTrustline] = useState(false);
  const [pidiendoUsdc, setPidiendoUsdc] = useState(false);

  const buyerWallet = walletState?.address ?? '';
  const esWalletReal = esWalletStellar(buyerWallet);
  const esTestnet = walletState?.esTestnet ?? true;
  const esMismaWallet = Boolean(
    productorWallet && esWalletReal && buyerWallet.toUpperCase() === productorWallet.toUpperCase(),
  );

  useEffect(() => {
    if (!esWalletReal || !esTestnet) return;

    let cancelado = false;
    verificarEstadoCuentaUsdc(buyerWallet)
      .then((res) => {
        if (!cancelado) {
          setTieneTrustline(res.tieneTrustline);
          setBalanceUsdc(res.balanceUsdc);
        }
      })
      .finally(() => {
        if (!cancelado) setVerificandoUsdc(false);
      });

    return () => {
      cancelado = true;
    };
  }, [buyerWallet, esWalletReal, esTestnet]);

  const handleActivarTrustline = async () => {
    try {
      setCreandoTrustline(true);
      setErrorTx(null);
      setEstadoTx('Firmá la activación de la trustline de USDC en Freighter...');
      const txHash = await crearTrustlineUsdcConFreighter(buyerWallet);
      setEstadoTx(`¡Trustline de USDC activada con éxito! (tx: ${txHash.slice(0, 10)}…)`);
      setTieneTrustline(true);
    } catch (err) {
      setErrorTx(err instanceof Error ? err.message : String(err));
    } finally {
      setCreandoTrustline(false);
    }
  };

  const handleSolicitarUsdc = async () => {
    try {
      setPidiendoUsdc(true);
      setErrorTx(null);
      // En Stellar Testnet la liquidez en el DEX es limitada, solicitamos hasta 50 USDC
      const montoAFondear = Math.min(monto, 50);
      setEstadoTx(`Transfiriendo ${montoAFondear} USDC de prueba desde la cuenta del sistema...`);
      const res = await solicitarUsdcDemoAction(buyerWallet, montoAFondear);
      if (!res.ok) {
        throw new Error(res.error ?? 'No se pudo enviar USDC de prueba');
      }
      setEstadoTx(
        `¡${montoAFondear} USDC acreditados con éxito para la prueba! (tx: ${res.txHash?.slice(0, 10)}…)`,
      );
      const status = await verificarEstadoCuentaUsdc(buyerWallet);
      setBalanceUsdc(status.balanceUsdc);
    } catch (err) {
      setErrorTx(err instanceof Error ? err.message : String(err));
    } finally {
      setPidiendoUsdc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!esWalletReal || !esTestnet) {
      setErrorTx('Conectá tu wallet Freighter en Stellar TESTNET antes de fondear el lote.');
      return;
    }

    if (esMismaWallet) {
      setErrorTx('Auto-compra bloqueada: tu wallet es la misma que la del productor de este lote.');
      return;
    }

    setCargando(true);
    setErrorTx(null);
    setEstadoTx('Construyendo pago clásico USDC en Stellar Testnet y solicitando firma...');

    try {
      const tieneContrato = Boolean(STELLAR_CONTRACT_ID);
      let txHash: string;

      if (tieneContrato && walletState?.metodo === 'extension') {
        setEstadoTx('Firmá la transacción en la ventana emergente de Freighter...');
        const res = await invocarContrato({
          metodo: 'fund_lot_escrow',
          args: argsFondeo({
            codigoLote,
            compradorWallet: buyerWallet,
            monto,
          }),
          publicKey: buyerWallet,
          signTransaction: signWithFreighter,
        });
        txHash = res.txHash;
      } else {
        setEstadoTx('Firmá el pago USDC en Freighter (Testnet)...');
        const signer =
          walletState?.metodo === 'walletconnect'
            ? (xdr: string, opts: { address: string }) =>
                firmarXdrConWalletConnect(xdr, { address: opts.address })
            : undefined;

        // En testnet usamos el monto disponible o el monto del lote para la prueba de firma
        const montoPrueba = Math.min(monto, balanceUsdc > 0 ? balanceUsdc : 10);
        const pago = await ejecutarPagoUsdcTestnet({
          sourceAddress: buyerWallet,
          destinationAddress: productorWallet,
          amountUsdc: montoPrueba,
          memoText: `FUND:${codigoLote}`,
          signer,
        });
        txHash = pago.txHash;
      }

      setEstadoTx(
        `¡Pago firmado y confirmado en Stellar Testnet! (${txHash.slice(0, 10)}…). Registrando movimiento...`,
      );

      const formData = new FormData();
      formData.set('codigo', codigoLote);
      formData.set('buyer_wallet', buyerWallet);
      formData.set('buyer_nombre', buyerNombre);
      formData.set('tx_hash', txHash);

      await fondearLoteAction(formData);
    } catch (err) {
      if (esErrorRedirectNext(err)) {
        // Redirección exitosa de Next.js, no es un error
        return;
      }
      setErrorTx(err instanceof Error ? err.message : String(err));
      setCargando(false);
      setEstadoTx(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-borde bg-panel-elevado text-texto-suave rounded-md border p-3 text-xs">
        ℹ️ <strong>Nota de transparencia:</strong> El esquema de escrow 40/30/30 opera en modo demo
        hasta el despliegue del contrato Soroban definitivo; cada hito ejecuta un{' '}
        <strong>pago clásico USDC real en Stellar Testnet</strong> firmado con tu wallet Freighter y
        registrado con su <code>tx_hash</code> verificable en Stellar Expert.
      </div>

      {esWalletReal && esTestnet && (
        <div className="border-borde bg-panel rounded-lg border p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-texto-suave font-semibold">
                Estado de tu wallet en Testnet:{' '}
              </span>
              {verificandoUsdc ? (
                <span className="text-texto-suave">Verificando USDC...</span>
              ) : tieneTrustline ? (
                <span className="text-brand-fuerte">
                  Trustline USDC activa · Balance: {balanceUsdc.toLocaleString('es-AR')} USDC
                </span>
              ) : (
                <span className="text-texto-suave">Falta trustline de USDC</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!tieneTrustline && !verificandoUsdc && (
                <button
                  type="button"
                  onClick={() => void handleActivarTrustline()}
                  disabled={creandoTrustline}
                  className="border-borde-fuerte bg-panel-elevado text-texto hover:bg-panel-elevado rounded border px-3 py-1 font-semibold disabled:opacity-50"
                >
                  {creandoTrustline ? 'Abriendo en Freighter...' : '➕ Habilitar Trustline USDC'}
                </button>
              )}

              {tieneTrustline && balanceUsdc === 0 && (
                <button
                  type="button"
                  onClick={() => void handleSolicitarUsdc()}
                  disabled={pidiendoUsdc}
                  className="border-borde-fuerte bg-panel-elevado text-texto hover:bg-panel-elevado rounded border px-3 py-1 font-semibold disabled:opacity-50"
                >
                  {pidiendoUsdc ? 'Enviando...' : `💧 Recibir 50 USDC de prueba`}
                </button>
              )}
            </div>
          </div>

          {esMismaWallet && (
            <div
              role="alert"
              className="text-brand-fuerte border-borde-fuerte bg-panel mt-3 rounded border p-2"
            >
              ⚠️ <strong>Auto-compra bloqueada:</strong> Esta cuenta es la misma que la del
              productor del lote. Debés usar una cuenta distinta en Freighter para actuar como
              comprador.
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        action={fondearLoteAction}
        className="mt-4 grid gap-4 sm:grid-cols-3"
      >
        <input type="hidden" name="codigo" value={codigoLote} />
        <div>
          <label className={claseLabel} htmlFor="buyer_nombre">
            Comprador (razón social)
          </label>
          <input
            id="buyer_nombre"
            name="buyer_nombre"
            className={claseInput}
            value={buyerNombre}
            onChange={(e) => setBuyerNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <ConnectWallet
            name="buyer_wallet"
            label="Wallet Stellar del comprador *"
            initialAddress={walletInicialValida}
            onChange={(w) => setWalletState(w)}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={
              cargando || !esWalletReal || !esTestnet || esMismaWallet || tieneTrustline === false
            }
            className="bg-brand hover:bg-brand/90 w-full rounded-md px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
          >
            {cargando ? 'Firmando con Freighter...' : 'Fondear y liberar 40%'}
          </button>
        </div>
      </form>

      {estadoTx && (
        <div className="text-brand-fuerte border-borde-fuerte bg-panel rounded-md border p-3 text-xs">
          {estadoTx}
        </div>
      )}

      {errorTx && (
        <div
          role="alert"
          className="rounded-md border border-red-600/40 bg-red-500/10 p-3 text-xs text-red-700"
        >
          {errorTx}
        </div>
      )}
    </div>
  );
}
