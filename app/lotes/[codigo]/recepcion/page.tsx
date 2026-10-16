import Link from 'next/link';
import { getLoteCompleto } from '@/lib/queries';
import { FormDespacho, FormRecepcion } from './form-recepcion';

export const dynamic = 'force-dynamic';

const tarjeta = 'rounded-lg border border-neutral-800 bg-neutral-950/60 p-6';

export default async function RecepcionPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const data = await getLoteCompleto(codigo);
  const lote = data?.lote;

  if (!lote) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p>Lote no encontrado.</p>
      </main>
    );
  }

  const volver = (
    <Link href={`/lotes/${codigo}`} className="hover:text-brand text-sm text-neutral-400">
      ← Volver a la ficha
    </Link>
  );

  const puedeDespachar =
    lote.estado_publicacion === 'FINANCIADO_EN_ENGORDE' && Boolean(lote.seal_2_sanitary);
  const puedeRecepcionar = lote.estado_publicacion === 'EN_TRANSITO_A_FRIGORIFICO';

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      {volver}
      <div>
        <h1 className="text-3xl font-bold">Cierre de ciclo — Paso 4</h1>
        <p className="mt-2 text-sm text-neutral-400">
          {lote.codigo_lote} · {lote.titulo} · objetivo {lote.peso_objetivo_kg} kg
        </p>
      </div>

      {puedeDespachar && (
        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">4A — Despacho en origen (productor)</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Emití el DT-e en SENASA/SIGSA y adjuntá el PDF antes de que salga el camión jaula.
          </p>
          <FormDespacho codigo={codigo} />
        </section>
      )}

      {puedeRecepcionar && (
        <section className={tarjeta}>
          <h2 className="text-lg font-semibold">4B — Recepción en balanza fiscal (frigorífico)</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Solo la wallet del comprador/frigorífico puede confirmar. Se concilian las 30 caravanas,
            se calcula el neto por kilos y el contrato libera el 30% final (con retención automática
            si faltaron kilos).
          </p>
          <FormRecepcion codigo={codigo} />
        </section>
      )}

      {!puedeDespachar && !puedeRecepcionar && (
        <div className="border-brand/40 bg-brand/10 rounded-md border p-4 text-sm text-neutral-200">
          Este lote no tiene acciones de cierre disponibles en su estado actual (
          {String(lote.estado_publicacion).replaceAll('_', ' ')}).
        </div>
      )}
    </main>
  );
}
