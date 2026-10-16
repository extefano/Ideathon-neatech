'use client';

import { useState } from 'react';
import { BotonFreighter } from '@/components/boton-freighter';
import { despacharLoteAction, recepcionLoteAction } from '@/lib/actions';

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

export function FormDespacho({ codigo }: { codigo: string }) {
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
            className="text-brand hover:text-brand/80 mt-1 text-xs"
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
        className="bg-brand hover:bg-brand/90 rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950"
      >
        Despachar camión (EN_TRANSITO)
      </button>
    </form>
  );
}

export function FormRecepcion({ codigo }: { codigo: string }) {
  const [buyerWallet, setBuyerWallet] = useState('GDEMO-FRIGORIFICO');
  return (
    <form action={recepcionLoteAction} className="mt-4 space-y-4">
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
            className="text-brand hover:text-brand/80 mt-1 text-xs"
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
            className="text-brand hover:text-brand/80 mt-1 text-xs"
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
        <label className={claseLabel} htmlFor="buyer_wallet">
          Wallet Stellar del frigorífico (firma la recepción)
        </label>
        <input
          id="buyer_wallet"
          name="buyer_wallet"
          className={claseInput}
          value={buyerWallet}
          onChange={(e) => setBuyerWallet(e.target.value)}
        />
        <div className="mt-2">
          <BotonFreighter
            walletActual={
              buyerWallet.startsWith('G') && buyerWallet.length === 56 ? buyerWallet : ''
            }
            onConectado={(w) => setBuyerWallet(w)}
          />
        </div>
      </div>
      <button
        type="submit"
        className="bg-brand hover:bg-brand/90 rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950"
      >
        Confirmar recepción y liquidar 30% final
      </button>
    </form>
  );
}
