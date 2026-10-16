import { LoteCard } from '@/components/lote-card';
import { Aviso } from '@/components/ui/aviso';
import { listarLotes, type LoteListItem } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let lotes: LoteListItem[] = [];
  let huboError = false;

  try {
    lotes = await listarLotes();
  } catch (error) {
    huboError = true;
    console.error('Error listando lotes', error);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Tus lotes</h1>
        <p className="max-w-3xl text-neutral-400">
          Seguí el estado de cada lote y cuál es la próxima acción del flujo EUDR: registrar y
          validar el origen, financiar el engorde, auditar la sanidad y cerrar la faena.
        </p>
      </header>

      {huboError && (
        <Aviso variante="error" titulo="No pudimos cargar los lotes">
          Volvé a intentar en unos segundos.
        </Aviso>
      )}

      <section aria-label="Listado de lotes">
        <h2 className="text-lg font-semibold">Lotes ({lotes.length})</h2>

        {lotes.length === 0 && !huboError ? (
          <div className="mt-4">
            <Aviso variante="info" titulo="Todavía no hay lotes">
              Registrá el primero desde “Registrar lote” en la barra superior.
            </Aviso>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lotes.map((lote) => (
              <LoteCard key={lote.id} lote={lote} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
