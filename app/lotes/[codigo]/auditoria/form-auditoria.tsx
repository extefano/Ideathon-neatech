'use client';

import { useState } from 'react';
import { ConnectWallet, type EstadoWalletConectada } from '@/components/connect-wallet';
import { registrarAuditoriaAction } from '@/lib/actions';
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

export function FormAuditoria({
  codigo,
  user,
  productorWallet,
  montoHito2Usdc,
}: {
  codigo: string;
  user?: PerfilUsuario;
  productorWallet?: string;
  montoHito2Usdc?: number;
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

  const vetWallet = walletState?.address ?? '';
  const esWalletReal = esWalletStellar(vetWallet);
  const esTestnet = walletState?.esTestnet ?? true;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    if (!esWalletReal || !esTestnet) {
      setErrorTx(
        'Conectá tu wallet Freighter en Stellar TESTNET para firmar la auditoría veterinaria.',
      );
      return;
    }

    setCargando(true);
    setErrorTx(null);
    setEstadoTx('Solicitando firma de auditoría sanitaria (Sello 2) en Freighter...');

    try {
      const formData = new FormData(form);
      formData.set('vet_wallet', vetWallet);

      const signer =
        walletState?.metodo === 'walletconnect'
          ? (xdr: string, opts: { address: string }) =>
              firmarXdrConWalletConnect(xdr, { address: opts.address })
          : undefined;

      const pago = await ejecutarPagoUsdcTestnet({
        sourceAddress: vetWallet,
        destinationAddress: productorWallet,
        amountUsdc: montoHito2Usdc ?? 0.0000001,
        memoText: `SEAL2:${codigo}`,
        signer,
      });

      formData.set('tx_hash', pago.txHash);
      setEstadoTx(
        `¡Auditoría firmada en Stellar Testnet! (${pago.txHash.slice(0, 10)}…). Guardando Sello 2...`,
      );

      await registrarAuditoriaAction(formData);
    } catch (err) {
      setErrorTx(err instanceof Error ? err.message : String(err));
      setCargando(false);
      setEstadoTx(null);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      action={registrarAuditoriaAction}
      encType="multipart/form-data"
      className="mt-6 space-y-4"
    >
      <input type="hidden" name="codigo" value={codigo} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={claseLabel} htmlFor="vet_nombre">
            Veterinario (nombre) *
          </label>
          <input
            id="vet_nombre"
            name="vet_nombre"
            required
            className={claseInput}
            defaultValue={user?.nombre_completo ?? 'MV Laura Benítez'}
          />
        </div>
        <div>
          <label className={claseLabel} htmlFor="matricula">
            Matrícula profesional *
          </label>
          <input
            id="matricula"
            name="matricula"
            required
            className={claseInput}
            defaultValue={user?.matricula ?? 'MV 1234 Corrientes'}
          />
        </div>
        <div>
          <ConnectWallet
            name="vet_wallet"
            label="Wallet Stellar del veterinario *"
            initialAddress={walletInicial}
            onChange={(w) => setWalletState(w)}
          />
        </div>
      </div>

      <div>
        <label className={claseLabel} htmlFor="dias_ciclo">
          Días transcurridos desde el inicio
        </label>
        <input
          id="dias_ciclo"
          name="dias_ciclo"
          type="number"
          min={1}
          max={400}
          className={claseInput}
          defaultValue={120}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Modo demo: 120 días representa el Mes 4 del ciclo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={claseLabel} htmlFor="acta_pdf">
            Acta de vacunación SIGSA (PDF/imagen) *
          </label>
          <input
            id="acta_pdf"
            name="acta_pdf"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className={claseInput}
          />
          <button
            type="button"
            className="text-brand hover:text-brand/80 mt-1 text-xs"
            onClick={() =>
              void cargarEnInput(
                'acta_pdf',
                '/demo/acta-vacunacion-demo.pdf',
                'acta-vacunacion-demo.pdf',
                'application/pdf',
              )
            }
          >
            Usar acta de demo
          </button>
        </div>
        <div>
          <label className={claseLabel} htmlFor="csv_mes4">
            CSV de balanza Mes 4 (caravana_rfid,peso_kg) *
          </label>
          <input
            id="csv_mes4"
            name="csv_mes4"
            type="file"
            accept=".csv,text/csv"
            className={claseInput}
          />
          <button
            type="button"
            className="text-brand hover:text-brand/80 mt-1 text-xs"
            onClick={() =>
              void cargarEnInput(
                'csv_mes4',
                '/demo/pesadas-mes4.csv',
                'pesadas-mes4.csv',
                'text/csv',
              )
            }
          >
            Usar CSV de demo (30 cabezas ~320 kg)
          </button>
        </div>
      </div>

      <div>
        <label className={claseLabel} htmlFor="observaciones">
          Observaciones sanitarias
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          className={`${claseInput} h-20`}
          defaultValue="Vacunación antiaftosa aplicada; tropa en buen estado corporal."
        />
      </div>

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
        disabled={cargando || !esWalletReal || !esTestnet}
        className="bg-brand hover:bg-brand/90 rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
      >
        {cargando ? 'Firmando en Freighter...' : 'Firmar auditoría y liberar 30%'}
      </button>
    </form>
  );
}
