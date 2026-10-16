import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import { resumirLote } from '@/lib/estado-lote';
import type { LoteListItem } from '@/lib/queries';

export function LoteCard({ lote }: { lote: LoteListItem }) {
  const resumen = resumirLote({
    estado: lote.estado_publicacion,
    seal_2_sanitary: lote.seal_2_sanitary,
    codigo: lote.codigo_lote,
  });

  const sellos = [
    { activo: lote.seal_1_eudr, nombre: '1 · Origen' },
    { activo: lote.seal_2_sanitary, nombre: '2 · Sanidad' },
    { activo: lote.seal_3_reception, nombre: '3 · Cierre' },
  ];

  return (
    <article className="rounded-tarjeta border-borde bg-panel flex flex-col border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-neutral-400">{lote.codigo_lote}</span>
        <EstadoBadge estado={lote.estado_publicacion} />
      </div>

      <Link
        href={`/lotes/${lote.codigo_lote}`}
        className="focus-visible:ring-foco focus-visible:ring-offset-superficie mt-2 w-fit font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {lote.titulo ?? 'Lote sin título'}
      </Link>

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
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-neutral-700 text-neutral-500'
            }`}
          >
            {sello.nombre}
          </span>
        ))}
      </div>

      <div className="mt-4 flex-1">
        <p className="text-xs text-neutral-400">{resumen.descripcion}</p>
      </div>

      {resumen.accion && (
        <Link
          href={resumen.accion.href}
          className="rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie border-panel-elevado bg-panel-elevado mt-3 inline-flex min-h-11 items-center justify-center border px-4 py-2 text-sm font-semibold text-neutral-100 hover:brightness-125 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {resumen.accion.texto} →
        </Link>
      )}
    </article>
  );
}
