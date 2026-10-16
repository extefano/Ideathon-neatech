import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import { listarLotes, type LoteListItem } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function SellosMini({ lote }: { lote: LoteListItem }) {
  const sellos = [
    { activo: lote.seal_1_eudr, nombre: '1 · EUDR' },
    { activo: lote.seal_2_sanitary, nombre: '2 · Sanidad' },
    { activo: lote.seal_3_reception, nombre: '3 · Recepción' },
  ];

  return (
    <div className="flex gap-1.5">
      {sellos.map((sello) => (
        <span
          key={sello.nombre}
          className={`rounded border px-1.5 py-0.5 text-[10px] ${
            sello.activo
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-neutral-700 text-neutral-500'
          }`}
        >
          {sello.nombre}
        </span>
      ))}
    </div>
  );
}

export default async function Home() {
  let lotes: LoteListItem[] = [];
  let dbError: string | null = null;

  try {
    lotes = await listarLotes();
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Error desconocido';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Ideathon Neatech</h1>
          <p className="mt-2 text-neutral-400">
            Trazabilidad ganadera EUDR con sellos en Stellar (Soroban) y escrow USDC.
          </p>
        </div>
        <Link
          href="/lotes/nuevo"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Registrar lote (Paso 1)
        </Link>
      </header>

      {dbError && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {dbError}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Lotes ({lotes.length})</h2>
        {lotes.length === 0 && !dbError && (
          <p className="mt-3 text-sm text-neutral-500">
            No hay lotes todavía. Registrá el primero con el botón de arriba.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lotes.map((lote) => (
            <Link
              key={lote.id}
              href={`/lotes/${lote.codigo_lote}`}
              className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 transition hover:border-emerald-500/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-neutral-400">{lote.codigo_lote}</span>
                <EstadoBadge estado={lote.estado_publicacion} />
              </div>
              <p className="mt-2 font-semibold">{lote.titulo ?? 'Lote sin título'}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {lote.localidad}, {lote.provincia} · {lote.cantidad_cabezas ?? '—'} cabezas
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {lote.moneda} {lote.monto_total_financiacion?.toLocaleString('es-AR') ?? '—'} ·{' '}
                {lote.peso_promedio_kg ?? '—'} kg → {lote.peso_objetivo_kg ?? '—'} kg
              </p>
              <div className="mt-3">
                <SellosMini lote={lote} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
