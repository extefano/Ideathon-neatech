import { LoteCard } from '@/components/lote-card';
import { Aviso } from '@/components/ui/aviso';
import type { RolUsuario } from '@/lib/auth';
import type { LoteListItem } from '@/lib/queries';

export function SeccionLotes({
  titulo,
  descripcion,
  etiquetaAccesible,
  lotes,
  perspectiva,
  vacioTitulo,
  vacioTexto,
}: {
  titulo?: string;
  descripcion?: string;
  etiquetaAccesible?: string;
  lotes: LoteListItem[];
  perspectiva?: RolUsuario;
  vacioTitulo: string;
  vacioTexto: string;
}) {
  return (
    <section aria-label={etiquetaAccesible ?? titulo} className="space-y-3">
      {titulo && (
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {descripcion && <p className="text-texto-suave text-sm">{descripcion}</p>}
        </div>
      )}

      {lotes.length === 0 ? (
        <Aviso variante="info" titulo={vacioTitulo}>
          {vacioTexto}
        </Aviso>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lotes.map((lote) => (
            <LoteCard key={lote.id} lote={lote} perspectiva={perspectiva} />
          ))}
        </div>
      )}
    </section>
  );
}
