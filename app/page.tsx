import Link from 'next/link';
import { LoteCard } from '@/components/lote-card';
import { listarLotes, type LoteListItem } from '@/lib/queries';

export const dynamic = 'force-dynamic';

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
        <nav className="flex gap-3">
          <Link
            href="/mercado"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 hover:border-emerald-500/60"
          >
            Marketplace
          </Link>
          <Link
            href="/lotes/nuevo"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Registrar lote (Paso 1)
          </Link>
        </nav>
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
            <LoteCard key={lote.id} lote={lote} />
          ))}
        </div>
      </section>
    </main>
  );
}
