import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import type { RolUsuario } from '@/lib/auth';
import { accionLoteParaRol, resumirLote } from '@/lib/estado-lote';
import type { LoteListItem } from '@/lib/queries';

export function LoteCard({ lote, perspectiva }: { lote: LoteListItem; perspectiva?: RolUsuario }) {
  const resumen = resumirLote({
    estado: lote.estado_publicacion,
    seal_2_sanitary: lote.seal_2_sanitary,
    codigo: lote.codigo_lote,
  });

  const accion = perspectiva
    ? accionLoteParaRol(
        {
          estado: lote.estado_publicacion,
          seal_2_sanitary: lote.seal_2_sanitary,
          codigo: lote.codigo_lote,
        },
        perspectiva,
      )
    : resumen.accion;

  const sellos = [
    { activo: lote.seal_1_eudr, nombre: '1 · Origen' },
    { activo: lote.seal_2_sanitary, nombre: '2 · Sanidad' },
    { activo: lote.seal_3_reception, nombre: '3 · Cierre' },
  ];

  return (
    <article className="rounded-tarjeta border-borde bg-panel flex flex-col border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-texto-suave font-mono text-xs">{lote.codigo_lote}</span>
        <EstadoBadge estado={lote.estado_publicacion} />
      </div>

      <Link
        href={`/lotes/${lote.codigo_lote}`}
        className="focus-visible:ring-foco focus-visible:ring-offset-superficie mt-2 w-fit font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {lote.titulo ?? 'Lote sin título'}
      </Link>

      <p className="text-texto-tenue mt-1 text-xs">
        {lote.localidad}, {lote.provincia} · {lote.cantidad_cabezas ?? '—'} cabezas
      </p>

      <p className="text-texto-suave mt-2 text-sm">
        {lote.moneda} {lote.monto_total_financiacion?.toLocaleString('es-AR') ?? '—'} ·{' '}
        {lote.peso_promedio_kg ?? '—'} kg → {lote.peso_objetivo_kg ?? '—'} kg
      </p>

      <div className="mt-3 flex gap-1.5">
        {sellos.map((sello) => (
          <span
            key={sello.nombre}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${
              sello.activo
                ? 'border-brand-fuerte/40 bg-brand/10 text-brand-fuerte'
                : 'border-borde-fuerte text-texto-tenue'
            }`}
          >
            {sello.nombre}
          </span>
        ))}
      </div>

      <div className="mt-4 flex-1">
        <p className="text-texto-suave text-xs">{resumen.descripcion}</p>
      </div>

      {accion && (
        <Link
          href={accion.href}
          className="rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie border-panel-elevado bg-panel-elevado text-texto mt-3 inline-flex min-h-11 items-center justify-center border px-4 py-2 text-sm font-semibold hover:brightness-125 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {accion.texto} →
        </Link>
      )}
    </article>
  );
}
