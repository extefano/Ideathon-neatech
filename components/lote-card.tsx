import { ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { EstadoBadge } from '@/components/estado-badge';
import type { RolUsuario } from '@/lib/auth';
import { normalizarCertificacionesComerciales, obtenerDefinicionCertificacion } from '@/lib/domain';
import { accionLoteParaRol, resumirLote } from '@/lib/estado-lote';
import { formatearPorcentajeHumedal } from '@/lib/humedales';
import type { LoteListItem } from '@/lib/queries';

function obtenerIndicePasoEnCurso(lote: LoteListItem): number {
  if (lote.estado_publicacion === 'PENDIENTE_VALIDACION' && !lote.seal_1_eudr) {
    return 0;
  }
  if (lote.estado_publicacion === 'FINANCIADO_EN_ENGORDE' && !lote.seal_2_sanitary) {
    return 1;
  }
  if (
    (lote.estado_publicacion === 'EN_TRANSITO_A_FRIGORIFICO' ||
      (lote.estado_publicacion === 'FINANCIADO_EN_ENGORDE' && lote.seal_2_sanitary)) &&
    !lote.seal_3_reception
  ) {
    return 2;
  }
  return -1;
}

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

  const tituloLimpio = (lote.titulo ?? 'Lote sin título')
    .replace(/^\[DEMO\]\s*/i, '')
    .replace(/\s*[-·]\s*\d+\s*kg\s*$/i, '');

  const sellos = [
    {
      numero: 1,
      activo: lote.seal_1_eudr,
      nombre: 'Origen',
      detalle: 'Sello 1 · Origen libre de deforestación',
    },
    {
      numero: 2,
      activo: lote.seal_2_sanitary,
      nombre: 'Sanidad',
      detalle: 'Sello 2 · Sanidad y engorde',
    },
    {
      numero: 3,
      activo: lote.seal_3_reception,
      nombre: 'Cierre',
      detalle: 'Sello 3 · Recepción y cierre en frigorífico',
    },
  ];

  const esRechazado = lote.estado_publicacion === 'RECHAZADO_EUDR';
  const indicePasoActual = obtenerIndicePasoEnCurso(lote);

  const certificaciones = normalizarCertificacionesComerciales(lote.certificaciones_comerciales);
  const esAccionSecundaria = accion?.texto === 'Ver ficha del lote';

  return (
    <article className="rounded-tarjeta border-borde bg-panel hover:border-borde-fuerte flex flex-col border p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none">
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
            {tituloLimpio}
          </h3>
        </Link>
        <p className="text-texto-tenue mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium">
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>
              {lote.localidad}, {lote.provincia}
            </span>
          </span>
          {lote.estado_humedal && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={
                  lote.estado_humedal === 'VERIFICADO'
                    ? 'text-brand-fuerte font-mono font-semibold'
                    : 'text-texto-tenue font-mono'
                }
              >
                Humedal{' '}
                {lote.estado_humedal === 'VERIFICADO' && lote.porcentaje_humedal != null
                  ? `${formatearPorcentajeHumedal(String(lote.porcentaje_humedal))} %`
                  : 'sin dato'}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="bg-superficie/60 border-borde/70 mt-3 rounded-md border p-2.5">
        <div className="divide-borde/70 grid grid-cols-3 divide-x">
          <div className="pr-2">
            <span className="text-texto-tenue block text-[10px] font-semibold tracking-wider uppercase">
              Financiación
            </span>
            <p className="text-texto mt-0.5 font-mono text-xs font-bold sm:text-sm">
              {lote.moneda} {lote.monto_total_financiacion?.toLocaleString('es-AR') ?? '—'}
            </p>
          </div>
          <div className="px-2.5">
            <span className="text-texto-tenue block text-[10px] font-semibold tracking-wider uppercase">
              Tropa
            </span>
            <p className="text-texto mt-0.5 text-xs font-semibold sm:text-sm">
              {lote.cantidad_cabezas ?? '—'} cabezas
            </p>
          </div>
          <div className="pl-2.5">
            <span className="text-texto-tenue block text-[10px] font-semibold tracking-wider uppercase">
              Peso
            </span>
            <p className="text-texto mt-0.5 font-mono text-xs font-semibold sm:text-sm">
              {lote.peso_promedio_kg ?? '—'}
              <ArrowRight
                aria-hidden="true"
                className="text-texto-tenue mx-0.5 inline h-3 w-3 align-[-1px]"
              />
              <span className="sr-only">a</span>
              {lote.peso_objetivo_kg ?? '—'} kg
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex-1 space-y-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-texto-suave text-[11px] font-semibold tracking-wide">Sellos EUDR</p>
            <div className="group/tooltip relative inline-flex items-center">
              <button
                type="button"
                aria-label="Estado actual de los sellos EUDR"
                aria-describedby={`tooltip-sellos-${lote.codigo_lote}`}
                className="border-borde-fuerte bg-superficie text-texto-suave hover:border-brand-fuerte hover:bg-brand/15 hover:text-brand-fuerte focus-visible:ring-foco inline-flex h-4 w-4 items-center justify-center rounded-full border font-mono text-[10px] leading-none font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                ?
              </button>
              <span
                id={`tooltip-sellos-${lote.codigo_lote}`}
                role="tooltip"
                className="border-borde-fuerte bg-texto text-panel pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 w-60 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed font-normal opacity-0 shadow-md transition-all duration-150 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:opacity-100"
              >
                {resumen.descripcion}
              </span>
            </div>
          </div>
          <ol
            aria-label="Progreso de sellos EUDR"
            className="bg-superficie/45 border-borde/70 mt-1.5 grid grid-cols-3 rounded-md border px-2 py-2.5"
          >
            {sellos.map((sello, indice) => {
              const esActual = indice === indicePasoActual;
              const esPasoRechazado = esRechazado && indice === 0;
              const conectorActivo = sello.activo && sellos[indice + 1]?.activo;
              const conectorEnCurso =
                sello.activo && !sellos[indice + 1]?.activo && indice + 1 === indicePasoActual;
              const estadoTexto = sello.activo
                ? 'Verificado'
                : esPasoRechazado
                  ? 'Rechazado'
                  : esActual
                    ? 'En curso'
                    : 'Pendiente';

              return (
                <li
                  key={sello.nombre}
                  title={`${sello.detalle} (${estadoTexto})`}
                  aria-current={esActual ? 'step' : undefined}
                  className="relative flex flex-col items-center text-center"
                >
                  {indice < sellos.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute top-3 left-1/2 h-0.5 w-full -translate-y-1/2 transition-colors ${
                        conectorActivo
                          ? 'bg-brand-fuerte/60'
                          : conectorEnCurso
                            ? 'bg-brand-fuerte/35'
                            : 'bg-borde-fuerte/80'
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[11px] font-bold transition-colors ${
                      sello.activo
                        ? 'border-brand-fuerte bg-brand text-neutral-950 shadow-2xs'
                        : esPasoRechazado
                          ? 'border-red-600/40 bg-red-500/10 text-red-700'
                          : esActual
                            ? 'border-brand-fuerte bg-panel text-brand-fuerte ring-brand/25 ring-3'
                            : 'border-borde-fuerte bg-panel text-texto-tenue'
                    }`}
                  >
                    {sello.numero}
                  </span>
                  <span
                    className={`mt-1.5 text-[11px] leading-tight ${
                      sello.activo
                        ? 'text-texto font-semibold'
                        : esPasoRechazado
                          ? 'font-semibold text-red-700'
                          : esActual
                            ? 'text-brand-fuerte font-semibold'
                            : 'text-texto-tenue font-medium'
                    }`}
                  >
                    {sello.nombre}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <p className="text-texto-suave text-[11px] font-semibold tracking-wide">Valor agregado</p>
          {certificaciones.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {certificaciones.map((cert) => {
                const def = obtenerDefinicionCertificacion(cert.codigo);
                return (
                  <span
                    key={cert.codigo}
                    title={`${def.nombre} (${def.norma})`}
                    className="border-borde bg-superficie/80 text-texto-suave inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                  >
                    {def.etiquetaTarjeta}
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

      {accion && (
        <Link
          href={accion.href}
          className={`rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie group mt-3.5 inline-flex min-h-11 items-center justify-center gap-1.5 border px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
            esAccionSecundaria
              ? 'border-borde-fuerte bg-panel text-texto hover:border-texto-tenue hover:bg-panel-elevado'
              : 'border-texto bg-texto text-panel hover:bg-texto/90 shadow-2xs'
          }`}
        >
          <span>{accion.texto}</span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </article>
  );
}
