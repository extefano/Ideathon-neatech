'use client';

import { useState } from 'react';
import { ConnectWallet, type EstadoWalletConectada } from '@/components/connect-wallet';
import { despacharLoteAction, recepcionLoteAction } from '@/lib/actions';
import type { PerfilUsuario } from '@/lib/auth';
import { esWalletStellar } from '@/lib/stellar-args';
import { ejecutarPagoUsdcTestnet } from '@/lib/stellar/payments';
import { firmarXdrConWalletConnect } from '@/lib/stellar/walletconnect';

const claseInput =
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-brand focus:outline-none';
const claseLabel = 'mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400';

async function cargarEnInput(inputId: string, url: string, nombre: string, tipo: string) {
  const input = document.getElementById(inputId);
  if (!(input instanceof HTMLInputElement)) return;
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], nombre, { type: tipo });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
}

export function FormDespacho({ codigo, user: _user }: { codigo: string; user?: PerfilUsuario }) {
  return (
    <form action={despacharLoteAction} className="mt-4 space-y-4">
      <input type="hidden" name="codigo" value={codigo} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={claseLabel} htmlFor="dte_nro">
            Número de DT-e
          </label>
          <input
            id="dte_nro"
            name="dte_nro"
            className={claseInput}
            defaultValue="DTE-2026-000123"
          />
        </div>
        <div>
          <label className={claseLabel} htmlFor="dte_pdf">
            PDF del DT-e (SENASA) *
          </label>
          <input
            id="dte_pdf"
            name="dte_pdf"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className={claseInput}
          />
          <button
            type="button"
            className="text-brand hover:text-brand/80 mt-1 cursor-pointer text-xs"
            onClick={() =>
              void cargarEnInput('dte_pdf', '/demo/dte-demo.pdf', 'dte-demo.pdf', 'application/pdf')
            }
          >
            Usar DT-e de demo
          </button>
        </div>
      </div>
      <button
        type="submit"
        className="bg-brand hover:bg-brand/90 cursor-pointer rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950"
      >
        Despachar camión (EN_TRANSITO)
      </button>
    </form>
  );
}

export function FormRecepcion({
  codigo,
  user,
  productorWallet,
  montoHito3Usdc,
}: {
  codigo: string;
  user?: PerfilUsuario;
  productorWallet?: string;
  montoHito3Usdc?: number;
}) {
  const walletInicial = user?.wallet && esWalletStellar(user.wallet) ? user.wallet : '';
  const [walletState, setWalletState] = useState<EstadoWalletConectada | null>(
    walletInicial
      ? { address: walletInicial, network: 'TESTNET', esTestnet: true, metodo: 'extension' }
      : null,
  );
  const [cargando, setCargando] = useState(false);
  const [estadoTx, setEstadoTx] = useState<string | null>(null);
  const [errorTx, setErrorTx] = useState<string | null>(null);

  const buyerWallet = walletState?.address ?? '';
  const esWalletReal = esWalletStellar(buyerWallet);
  const esTestnet = walletState?.esTestnet ?? true;
  const esMismaWallet = Boolean(
    productorWallet && esWalletReal && buyerWallet.toUpperCase() === productorWallet.toUpperCase(),
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    if (!esWalletReal || !esTestnet) {
      setErrorTx(
        'Conectá tu wallet Freighter en Stellar TESTNET para confirmar la recepción y liquidar el lote.',
      );
      return;
    }

    if (esMismaWallet) {
      setErrorTx(
        'Auto-compra bloqueada: la wallet del frigorífico/comprador no puede ser la misma que la del productor.',
      );
      return;
    }

    setCargando(true);
    setErrorTx(null);
    setEstadoTx('Firmando liquidación final USDC en Freighter (Sello 3)...');

    try {
      const formData = new FormData(form);
      formData.set('buyer_wallet', buyerWallet);

      const signer =
        walletState?.metodo === 'walletconnect'
          ? (xdr: string, opts: { address: string }) =>
              firmarXdrConWalletConnect(xdr, { address: opts.address })
          : undefined;

      const pago = await ejecutarPagoUsdcTestnet({
        sourceAddress: buyerWallet,
        destinationAddress: productorWallet,
        amountUsdc: montoHito3Usdc ?? 1,
        memoText: `SEAL3:${codigo}`,
        signer,
      });

      formData.set('tx_hash', pago.txHash);
      setEstadoTx(
        `¡Liquidación firmada en Stellar Testnet! (${pago.txHash.slice(0, 10)}…). Registrando cierre de ciclo...`,
      );

      await recepcionLoteAction(formData);
    } catch (err) {
      setErrorTx(err instanceof Error ? err.message : String(err));
      setCargando(false);
      setEstadoTx(null);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      action={recepcionLoteAction}
      className="mt-4 space-y-4"
    >
      <input type="hidden" name="codigo" value={codigo} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={claseLabel} htmlFor="csv_recepcion">
            CSV balanza fiscal (caravana_rfid,peso_kg) *
          </label>
          <input
            id="csv_recepcion"
            name="csv_recepcion"
            type="file"
            accept=".csv,text/csv"
            className={claseInput}
          />
          <button
            type="button"
            className="text-brand hover:text-brand/80 mt-1 cursor-pointer text-xs"
            onClick={() =>
              void cargarEnInput(
                'csv_recepcion',
                '/demo/pesadas-final.csv',
                'pesadas-final.csv',
                'text/csv',
              )
            }
          >
            Usar CSV de demo (30 cabezas ~460 kg)
          </button>
        </div>
        <div>
          <label className={claseLabel} htmlFor="ticket_pdf">
            Ticket de balanza fiscal (opcional)
          </label>
          <input
            id="ticket_pdf"
            name="ticket_pdf"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className={claseInput}
          />
          <button
            type="button"
            className="text-brand hover:text-brand/80 mt-1 cursor-pointer text-xs"
            onClick={() =>
              void cargarEnInput(
                'ticket_pdf',
                '/demo/ticket-balanza-demo.pdf',
                'ticket-balanza-demo.pdf',
                'application/pdf',
              )
            }
          >
            Usar ticket de demo
          </button>
        </div>
      </div>

      <div>
        <ConnectWallet
          name="buyer_wallet"
          label="Wallet Stellar del frigorífico (firma la recepción) *"
          initialAddress={walletInicial}
          onChange={(w) => setWalletState(w)}
        />
      </div>

      {esMismaWallet && (
        <div
          role="alert"
          className="text-brand rounded border border-neutral-700 bg-neutral-900/90 p-2 text-xs"
        >
          ⚠️ <strong>Auto-compra bloqueada:</strong> La wallet del comprador no puede ser igual a la
          del productor del lote.
        </div>
      )}

      {estadoTx && (
        <div className="text-brand rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs">
          {estadoTx}
        </div>
      )}

      {errorTx && (
        <div
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300"
        >
          {errorTx}
        </div>
      )}

      <button
        type="submit"
        disabled={cargando || !esWalletReal || !esTestnet || esMismaWallet}
        className="bg-brand hover:bg-brand/90 cursor-pointer rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
      >
        {cargando ? 'Firmando en Freighter...' : 'Confirmar recepción y liquidar 30% final'}
      </button>
    </form>
  );
}
