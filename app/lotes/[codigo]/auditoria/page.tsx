import Link from 'next/link';
import { getLoteCompleto } from '@/lib/queries';
import { FormAuditoria } from './form-auditoria';

export const dynamic = 'force-dynamic';

export default async function AuditoriaPage({ params }: { params: Promise<{ codigo: string }> }) {
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

  if (lote.estado_publicacion !== 'FINANCIADO_EN_ENGORDE' || lote.seal_2_sanitary) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Link href={`/lotes/${codigo}`} className="hover:text-brand text-sm text-neutral-400">
          ← Volver a la ficha
        </Link>
        <div className="border-brand/40 bg-brand/10 mt-6 rounded-md border p-4 text-sm text-neutral-200">
          Este lote no está habilitado para la auditoría del Mes 4 (requiere estar financiado y sin
          Sello 2). Acceso exclusivo del veterinario acreditado.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href={`/lotes/${codigo}`} className="hover:text-brand text-sm text-neutral-400">
        ← Volver a la ficha
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Auditoría sanitaria — Mes 4</h1>
      <p className="mt-2 text-sm text-neutral-400">
        {lote.codigo_lote} · {lote.titulo} · peso inicial {lote.peso_promedio_kg} kg
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Pantalla exclusiva del veterinario acreditado (el productor tiene prohibido cargar este
        hito). Se concilian las mismas caravanas del Paso 1 y se valida el ADPV contra el rango
        biológico INTA (0,5 a 1,3 kg/día).
      </p>
      <FormAuditoria codigo={codigo} />
    </main>
  );
}
