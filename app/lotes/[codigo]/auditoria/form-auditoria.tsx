'use client';

import { useState } from 'react';
import { ConnectWallet, type EstadoWalletConectada } from '@/components/connect-wallet';
import { Aviso } from '@/components/ui/aviso';
import { Boton } from '@/components/ui/boton';
import { registrarAuditoriaAction } from '@/lib/actions';
import type { PerfilUsuario } from '@/lib/auth';
import { esWalletStellar } from '@/lib/stellar-args';
import { ejecutarPagoUsdcTestnet, esErrorRedirectNext } from '@/lib/stellar/payments';
import { firmarXdrConWalletConnect } from '@/lib/stellar/walletconnect';

const claseInput =
  'w-full rounded-control min-h-11 border border-borde-fuerte bg-panel px-3 py-2 text-sm text-texto focus-visible:border-brand-fuerte focus-visible:outline-none';
const claseLabel = 'mb-1 block text-xs font-semibold tracking-wide text-texto-suave uppercase';

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
        amountUsdc: 0.0000001,
        memoText: `SEAL2:${codigo}`,
        signer,
      });

      formData.set('tx_hash', pago.txHash);
      setEstadoTx(
        `¡Auditoría firmada en Stellar Testnet! (${pago.txHash.slice(0, 10)}…). Guardando Sello 2...`,
      );

      await registrarAuditoriaAction(formData);
    } catch (err) {
      if (esErrorRedirectNext(err)) {
        return;
      }
      setErrorTx(err instanceof Error ? err.message : String(err));
      setCargando(false);
      setEstadoTx(null);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      action={registrarAuditoriaAction}
      className="space-y-6"
    >
      <input type="hidden" name="codigo" value={codigo} />

      <section className="space-y-3">
        <h3 className="text-texto text-sm font-semibold">1. Acta de vacunación SIGSA</h3>
        <div>
          <label className={claseLabel} htmlFor="acta_pdf">
            Acta SIGSA (PDF/imagen) *
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
            className="text-brand-fuerte mt-1 text-xs hover:underline"
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
      </section>

      <section className="space-y-3">
        <h3 className="text-texto text-sm font-semibold">2. Pesada del Mes 4</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={claseLabel} htmlFor="csv_mes4">
              CSV de balanza (caravana_rfid,peso_kg) *
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
              className="text-brand-fuerte mt-1 text-xs hover:underline"
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
            <p className="text-texto-tenue mt-1 text-xs">
              Si alguna caravana no coincide con el padrón del lote, verás el detalle al firmar.
            </p>
          </div>
          <div>
            <label className={claseLabel} htmlFor="dias_ciclo">
              Días desde el inicio
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
            <p className="text-texto-tenue mt-1 text-xs">
              120 días representan el Mes 4 del ciclo.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-texto text-sm font-semibold">3. Resultado y firma</h3>
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

        <div className="border-borde bg-panel-elevado text-texto-suave rounded-md border p-3 text-xs">
          <p className="text-texto font-semibold">Detalle de firma y liberación del Sello 2</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {typeof montoHito2Usdc === 'number' && montoHito2Usdc > 0 && (
              <li>
                <strong>Fondo a destrabar del escrow (30 % Mes 4):</strong>{' '}
                {montoHito2Usdc.toLocaleString('es-AR')} USDC (se transfiere del escrow al Productor
                si el ADPV cumple el rango INTA).
              </li>
            )}
            <li>
              <strong>Costo de firmar en tu wallet Freighter:</strong> solo la firma de autorización
              sanitaria (<code>0,0000001 USDC</code> simbólico + <code>~0,01 XLM</code> de gas de
              red en Testnet). El veterinario no abona el 30 % del lote.
            </li>
          </ul>
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
      </section>

      {estadoTx && (
        <Aviso variante="info" titulo="Transacción Stellar Testnet">
          {estadoTx}
        </Aviso>
      )}

      {errorTx && (
        <Aviso variante="error" titulo="Error de transacción">
          {errorTx}
        </Aviso>
      )}

      <Boton type="submit" cargando={cargando} disabled={cargando || !esWalletReal || !esTestnet}>
        {cargando ? 'Firmando en Freighter...' : 'Firmar auditoría y liberar 30 %'}
      </Boton>
    </form>
  );
}
