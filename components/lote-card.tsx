import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import type { LoteListItem } from '@/lib/queries';

export function LoteCard({ lote }: { lote: LoteListItem }) {
  const sellos = [
    { activo: lote.seal_1_eudr, nombre: '1 · EUDR' },
    { activo: lote.seal_2_sanitary, nombre: '2 · Sanidad' },
    { activo: lote.seal_3_reception, nombre: '3 · Recepción' },
  ];

  return (
    <Link
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
      <div className="mt-3 flex gap-1.5">
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
    </Link>
  );
}
