import Link from 'next/link';
import { LoteCard } from '@/components/lote-card';
import { listarLotes, type LoteListItem } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function MercadoPage() {
  let lotes: LoteListItem[] = [];
  let error: string | null = null;

  try {
    lotes = await listarLotes({ estado: 'DISPONIBLE' });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/" className="hover:text-brand text-sm text-neutral-400">
        ← Inicio
      </Link>
      <header className="mt-4">
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="mt-2 text-neutral-400">
          Lotes con Sello 1 (Origen Libre de Deforestación) verificados contra Global Forest Watch.
          El comprador fondea el escrow y el contrato libera el 40% inicial al productor.
        </p>
      </header>

      {error && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {lotes.length === 0 && !error && (
        <p className="mt-8 text-sm text-neutral-500">No hay lotes disponibles en este momento.</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lotes.map((lote) => (
          <LoteCard key={lote.id} lote={lote} />
        ))}
      </div>
    </main>
  );
}
