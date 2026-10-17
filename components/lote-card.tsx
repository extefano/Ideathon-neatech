import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import type { RolUsuario } from '@/lib/auth';
import { normalizarCertificacionesComerciales, obtenerDefinicionCertificacion } from '@/lib/domain';
import { accionLoteParaRol, resumirLote } from '@/lib/estado-lote';
import { formatearPorcentajeHumedal } from '@/lib/humedales';
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

  const certificaciones = normalizarCertificacionesComerciales(lote.certificaciones_comerciales);

  return (
    <article className="rounded-tarjeta border-borde bg-panel hover:border-borde-fuerte flex flex-col border p-4 shadow-xs transition-all duration-150">
      <div className="flex items-center justify-between gap-2">
        <span className="text-texto-tenue font-mono text-xs font-semibold tracking-wider">
          {lote.codigo_lote}
        </span>
        <EstadoBadge estado={lote.estado_publicacion} />
      </div>

      <div className="mt-2.5">
        <Link
          href={`/lotes/${lote.codigo_lote}`}
          className="focus-visible:ring-foco focus-visible:ring-offset-superficie group block focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <h3 className="text-texto group-hover:text-brand-fuerte text-base font-bold tracking-tight transition-colors">
            {lote.titulo ?? 'Lote sin título'}
          </h3>
        </Link>
        <p className="text-texto-tenue mt-0.5 text-xs font-medium">
          {lote.localidad}, {lote.provincia}
        </p>
      </div>

      <div className="bg-superficie/60 border-borde/70 mt-3 space-y-2 rounded-md border p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-texto-tenue text-[10px] font-semibold tracking-wider uppercase">
              Financiación
            </span>
            <p className="text-texto font-mono text-sm font-bold">
              {lote.moneda} {lote.monto_total_financiacion?.toLocaleString('es-AR') ?? '—'}
            </p>
          </div>
          <div>
            <span className="text-texto-tenue text-[10px] font-semibold tracking-wider uppercase">
              Tropa
            </span>
            <p className="text-texto text-sm font-semibold">
              {lote.cantidad_cabezas ?? '—'} cabezas
            </p>
          </div>
        </div>
        <div className="border-borde/50 border-t pt-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-texto-tenue font-medium">Evolución peso</span>
            <span className="text-texto font-mono font-semibold">
              {lote.peso_promedio_kg ?? '—'} kg → {lote.peso_objetivo_kg ?? '—'} kg
            </span>
          </div>
        </div>
        {lote.estado_humedal && (
          <div className="border-borde/50 border-t pt-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-texto-tenue font-medium">Humedal (informativo)</span>
              <span className="text-texto font-mono font-semibold">
                {lote.estado_humedal === 'VERIFICADO' && lote.porcentaje_humedal !== null
                  ? `${formatearPorcentajeHumedal(String(lote.porcentaje_humedal))} % del campo`
                  : 'sin dato'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-borde mt-3 space-y-2.5 border-t pt-2.5">
        <div>
          <p className="text-texto-suave text-[11px] font-semibold tracking-wide">
            Sellos EUDR (Obligatorios · Eje 1):
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sellos.map((sello) => (
              <span
                key={sello.nombre}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  sello.activo
                    ? 'border-brand-fuerte/40 bg-brand/15 text-brand-fuerte font-semibold'
                    : 'border-borde-fuerte bg-superficie/50 text-texto-tenue'
                }`}
              >
                {sello.activo && <span aria-hidden="true">✓</span>}
                <span>{sello.nombre}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-texto-suave text-[11px] font-semibold tracking-wide">
            Valor agregado (Voluntarios · Eje 2):
          </p>
          {certificaciones.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {certificaciones.map((cert) => {
                const def = obtenerDefinicionCertificacion(cert.codigo);
                return (
                  <span
                    key={cert.codigo}
                    title={`${def.nombre} (${def.norma})`}
                    className="border-borde-fuerte bg-panel-elevado text-texto inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium"
                  >
                    <span aria-hidden="true" className="text-brand-fuerte">
                      ✓
                    </span>
                    <span>{def.etiquetaTarjeta}</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-texto-tenue mt-0.5 text-[11px] italic">
              Sin certificaciones voluntarias
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1">
        <p className="text-texto-suave text-xs leading-relaxed">{resumen.descripcion}</p>
      </div>

      {accion && (
        <Link
          href={accion.href}
          className="rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie border-borde-fuerte bg-panel-elevado text-texto hover:border-brand-fuerte hover:bg-brand/10 hover:text-brand-fuerte group mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 border px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span>{accion.texto}</span>
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
    </article>
  );
}
