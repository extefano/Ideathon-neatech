'use client';

import { useEffect, useState } from 'react';
import { signTransaction as signWithFreighter } from '@stellar/freighter-api';
import { BotonFreighter } from '@/components/boton-freighter';
import { invocarContrato } from '@/lib/stellar-invoke';
import { argsFondeo } from '@/lib/stellar-args';
import { STELLAR_CONTRACT_ID } from '@/lib/stellar-config';
import { fondearLoteAction, solicitarUsdcDemoAction } from '@/lib/actions';
import { crearTrustlineUsdcConFreighter, verificarEstadoCuentaUsdc } from '@/lib/freighter';

const claseInput =
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-brand focus:outline-none';
const claseLabel = 'mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400';

export function FormFondeo({
  codigoLote,
  monto,
  productorWallet,
}: {
  codigoLote: string;
  monto: number;
  productorWallet?: string;
}) {
  const [buyerWallet, setBuyerWallet] = useState('GDEMO-FRIGORIFICO');
  const [buyerNombre, setBuyerNombre] = useState('Frigorífico Demo SA');
  const [cargando, setCargando] = useState(false);
  const [estadoTx, setEstadoTx] = useState<string | null>(null);
  const [errorTx, setErrorTx] = useState<string | null>(null);

  // Estado de la cuenta en Stellar Testnet
  const [tieneTrustline, setTieneTrustline] = useState<boolean | null>(null);
  const [balanceUsdc, setBalanceUsdc] = useState<number>(0);
  const [verificandoUsdc, setVerificandoUsdc] = useState(false);
  const [creandoTrustline, setCreandoTrustline] = useState(false);
  const [pidiendoUsdc, setPidiendoUsdc] = useState(false);

  const esWalletReal = buyerWallet.startsWith('G') && buyerWallet.length === 56;
  const esMismaWallet = Boolean(
    productorWallet && esWalletReal && buyerWallet.toUpperCase() === productorWallet.toUpperCase(),
  );

  useEffect(() => {
    if (!esWalletReal) return;

    let cancelado = false;
    // Iniciamos la verificación asíncrona de la cuenta
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
  }, [buyerWallet, esWalletReal]);

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
      setEstadoTx(`Transfiriendo ${monto} USDC de prueba desde la cuenta del sistema...`);
      const res = await solicitarUsdcDemoAction(buyerWallet, monto);
      if (!res.ok) {
        throw new Error(res.error ?? 'No se pudo enviar USDC de prueba');
      }
      setEstadoTx(
        `¡${monto} USDC acreditados con éxito para la prueba! (tx: ${res.txHash?.slice(0, 10)}…)`,
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
    const tieneContrato = Boolean(STELLAR_CONTRACT_ID);

    if (!tieneContrato || !esWalletReal) {
      // Modo demo estándar o sin Freighter
      return;
    }

    if (esMismaWallet) {
      e.preventDefault();
      setErrorTx('Auto-compra bloqueada: tu wallet es la misma que la del productor de este lote.');
      return;
    }

    e.preventDefault();
    setCargando(true);
    setErrorTx(null);
    setEstadoTx('Preparando llamada y solicitando firma en Freighter...');

    try {
      setEstadoTx('Firmá la transacción en la ventana emergente de Freighter...');
      const { txHash } = await invocarContrato({
        metodo: 'fund_lot_escrow',
        args: argsFondeo({
          codigoLote,
          compradorWallet: buyerWallet,
          monto,
        }),
        publicKey: buyerWallet,
        signTransaction: signWithFreighter,
      });

      setEstadoTx(
        `¡Transacción confirmada en Soroban! (${txHash.slice(0, 10)}…). Registrando en la plataforma...`,
      );

      const formData = new FormData();
      formData.set('codigo', codigoLote);
      formData.set('buyer_wallet', buyerWallet);
      formData.set('buyer_nombre', buyerNombre);
      formData.set('tx_hash', txHash);

      await fondearLoteAction(formData);
    } catch (err) {
      setErrorTx(err instanceof Error ? err.message : String(err));
      setCargando(false);
      setEstadoTx(null);
    }
  };

  return (
    <div className="space-y-4">
      <BotonFreighter
        walletActual={esWalletReal ? buyerWallet : ''}
        onConectado={(w) => setBuyerWallet(w)}
      />

      {esWalletReal && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-neutral-300">
                Estado de tu wallet en Testnet:{' '}
              </span>
              {verificandoUsdc ? (
                <span className="text-neutral-400">Verificando USDC...</span>
              ) : tieneTrustline ? (
                <span className="text-brand">
                  Trustline USDC activa · Balance: {balanceUsdc.toLocaleString('es-AR')} USDC
                </span>
              ) : (
                <span className="text-neutral-400">Falta trustline de USDC</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!tieneTrustline && !verificandoUsdc && (
                <button
                  type="button"
                  onClick={handleActivarTrustline}
                  disabled={creandoTrustline}
                  className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-semibold text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
                >
                  {creandoTrustline ? 'Abriendo en Freighter...' : '➕ Habilitar Trustline USDC'}
                </button>
              )}

              {tieneTrustline && balanceUsdc < monto && (
                <button
                  type="button"
                  onClick={handleSolicitarUsdc}
                  disabled={pidiendoUsdc}
                  className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-semibold text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
                >
                  {pidiendoUsdc ? 'Enviando...' : `💧 Recibir ${monto} USDC de prueba`}
                </button>
              )}
            </div>
          </div>

          {esMismaWallet && (
            <div className="text-brand mt-3 rounded border border-neutral-700 bg-neutral-900/90 p-2">
              ⚠️ <strong>Auto-compra bloqueada:</strong> Esta cuenta es la misma que la del
              productor del lote. Por reglas del smart contract, debés usar una cuenta distinta en
              Freighter para actuar como comprador.
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        action={fondearLoteAction}
        className="mt-4 grid gap-3 sm:grid-cols-3"
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
          <label className={claseLabel} htmlFor="buyer_wallet">
            Wallet Stellar del comprador
          </label>
          <input
            id="buyer_wallet"
            name="buyer_wallet"
            className={claseInput}
            value={buyerWallet}
            onChange={(e) => setBuyerWallet(e.target.value)}
            required
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={cargando || esMismaWallet || tieneTrustline === false}
            className="bg-brand hover:bg-brand/90 w-full rounded-md px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
          >
            {cargando ? 'Firmando con Freighter...' : 'Fondear y liberar 40%'}
          </button>
        </div>
      </form>

      {estadoTx && (
        <div className="text-brand rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs">
          {estadoTx}
        </div>
      )}

      {errorTx && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          {errorTx}
        </div>
      )}
    </div>
  );
}
