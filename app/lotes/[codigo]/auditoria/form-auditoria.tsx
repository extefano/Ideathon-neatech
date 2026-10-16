'use client';

import { registrarAuditoriaAction } from '@/lib/actions';

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

import type { PerfilUsuario } from '@/lib/auth';

export function FormAuditoria({ codigo, user }: { codigo: string; user?: PerfilUsuario }) {
  return (
    <form
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
          <label className={claseLabel} htmlFor="vet_wallet">
            Wallet Stellar del veterinario
          </label>
          <input
            id="vet_wallet"
            name="vet_wallet"
            className={claseInput}
            defaultValue={user?.wallet ?? 'GDEMO-VETERINARIO'}
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

      <button
        type="submit"
        className="bg-brand hover:bg-brand/90 rounded-md px-5 py-2.5 text-sm font-semibold text-neutral-950"
      >
        Firmar auditoría y liberar 30%
      </button>
    </form>
  );
}
