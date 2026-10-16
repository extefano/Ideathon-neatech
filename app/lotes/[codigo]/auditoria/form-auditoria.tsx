'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { BotonFreighter } from '@/components/boton-freighter';
import { Boton } from '@/components/ui/boton';
import { registrarAuditoriaAction } from '@/lib/actions';

const claseInput =
  'w-full rounded-control min-h-11 border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus-visible:border-brand focus-visible:outline-none';
const claseLabel = 'mb-1 block text-xs font-semibold tracking-wide text-neutral-400 uppercase';

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

import type { PerfilUsuario } from '@/lib/auth';

function BotonFirmar() {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" cargando={pending}>
      {pending ? 'Firmando auditoría…' : 'Firmar auditoría y liberar 30 %'}
    </Boton>
  );
}

export function FormAuditoria({ codigo, user }: { codigo: string; user?: PerfilUsuario }) {
  const [vetWallet, setVetWallet] = useState(user?.wallet ?? 'GDEMO-VETERINARIO');

  return (
    <form action={registrarAuditoriaAction} encType="multipart/form-data" className="space-y-6">
      <input type="hidden" name="codigo" value={codigo} />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-200">1. Acta de vacunación SIGSA</h3>
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
            className="text-brand mt-1 text-xs hover:underline"
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
        <h3 className="text-sm font-semibold text-neutral-200">2. Pesada del Mes 4</h3>
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
              className="text-brand mt-1 text-xs hover:underline"
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
            <p className="mt-1 text-xs text-neutral-500">
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
            <p className="mt-1 text-xs text-neutral-500">
              120 días representan el Mes 4 del ciclo.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-200">3. Resultado y firma</h3>
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
            <label className={claseLabel} htmlFor="vet_wallet">
              Wallet Stellar del veterinario
            </label>
            <input
              id="vet_wallet"
              name="vet_wallet"
              className={claseInput}
              value={vetWallet}
              onChange={(e) => setVetWallet(e.target.value)}
            />
            <div className="mt-2">
              <BotonFreighter
                walletActual={vetWallet.startsWith('G') && vetWallet.length === 56 ? vetWallet : ''}
                onConectado={(w) => setVetWallet(w)}
              />
            </div>
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
      </section>

      <BotonFirmar />
    </form>
  );
}
