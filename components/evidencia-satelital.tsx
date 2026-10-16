import { MapaLote } from '@/components/mapa-lote';
import { Aviso } from '@/components/ui/aviso';
import { Tarjeta } from '@/components/ui/tarjeta';

export type GfwAnio = {
  year: number;
  lossHa: number;
};

export type GfwConsulta = {
  totalLossHa?: number;
  checkedAt?: string;
  criterio?: string;
  byYear?: GfwAnio[];
};

export interface EvidenciaSatelitalProps {
  poligono: unknown;
  gfw: GfwConsulta | null;
}

function formatearFechaAuditoria(iso?: string): string | null {
  if (!iso) return null;
  try {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return null;
    const fStr = fecha.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    const hStr = fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    return `${fStr} a las ${hStr} hs`;
  } catch {
    return null;
  }
}

export function EvidenciaSatelital({ poligono, gfw }: EvidenciaSatelitalProps) {
  const tieneGfw = Boolean(gfw);
  const totalLoss = typeof gfw?.totalLossHa === 'number' ? gfw.totalLossHa : 0;
  const esConforme = tieneGfw && totalLoss === 0;
  const fechaAuditoria = formatearFechaAuditoria(gfw?.checkedAt);

  const badgeEstado = tieneGfw ? (
    esConforme ? (
      <span
        role="status"
        className="border-brand/40 bg-brand/10 text-brand inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      >
        <span className="bg-brand h-1.5 w-1.5 rounded-full text-neutral-950" />✓ Conforme EUDR ·
        Libre de deforestación
      </span>
    ) : (
      <span
        role="alert"
        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />✕ No conforme EUDR · Pérdida arbórea
        detectada
      </span>
    )
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-neutral-400">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
      Sin análisis satelital
    </span>
  );

  return (
    <Tarjeta titulo="Evidencia satelital (EUDR)" acciones={badgeEstado}>
      <div className="space-y-4">
        {/* Mapa del polígono del lote como protagonista visual */}
        <div className="rounded-tarjeta border-borde overflow-hidden border">
          <MapaLote poligono={poligono} />
        </div>

        {/* Resultado del análisis */}
        {tieneGfw ? (
          esConforme ? (
            <div className="rounded-tarjeta border-brand/30 bg-brand/5 border p-3.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand font-medium">Pérdida arbórea post-2020:</span>
                <span className="text-brand font-semibold">0,00 ha</span>
              </div>
              <p className="mt-1 text-xs text-neutral-300">
                La parcela analizada no presenta pérdida de bosque nativo desde la fecha de corte
                reglamentaria.
              </p>
            </div>
          ) : (
            <div className="rounded-tarjeta border border-red-500/30 bg-red-950/20 p-3.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-red-300">Pérdida arbórea post-2020:</span>
                <span className="font-semibold text-red-400">
                  {totalLoss.toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ha
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-300">
                Se detectaron <strong className="text-red-300">{totalLoss} ha</strong> de pérdida de
                masa arbórea posterior a 2020, por lo que el lote no es apto para exportación EUDR.
              </p>

              {/* Desglose anual en tags/chips */}
              {gfw?.byYear && gfw.byYear.length > 0 && (
                <div className="mt-3 border-t border-red-500/20 pt-2.5">
                  <span className="text-xs font-medium text-neutral-400">
                    Desglose por año detectado:
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gfw.byYear.map((item) => (
                      <span
                        key={item.year}
                        className="rounded-control inline-flex items-center gap-1.5 border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-900/40"
                      >
                        <span className="font-semibold text-red-300">{item.year}:</span>
                        <span>
                          {item.lossHa.toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          ha
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <Aviso variante="alerta" titulo="Sin consulta satelital registrada">
            Sin consulta satelital GFW registrada. Todavía no se verificó este polígono contra
            Global Forest Watch.
          </Aviso>
        )}

        {/* Bloque pedagógico sutil con icono explicativo */}
        <div className="rounded-tarjeta flex items-start gap-2.5 border border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-400">
          <svg
            className="text-brand mt-0.5 h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="leading-relaxed">
            <strong className="text-neutral-300">Corte reglamentario EUDR (31/12/2020):</strong> El
            Reglamento de la Unión Europea sobre deforestación (EUDR) prohíbe la comercialización y
            exportación de ganado proveniente de parcelas con deforestación posterior al 31 de
            diciembre de 2020.
          </p>
        </div>

        {/* Metadatos y fuente comprensibles */}
        {tieneGfw && (
          <dl className="space-y-1 text-xs text-neutral-400">
            <div>
              <dt className="inline text-neutral-500">Fuente satelital: </dt>
              <dd className="inline">Global Forest Watch (Universidad de Maryland / Hansen)</dd>
            </div>
            {fechaAuditoria && (
              <div>
                <dt className="inline text-neutral-500">Auditoría: </dt>
                <dd className="inline">Verificado satelitalmente el {fechaAuditoria}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Acordeón colapsable para inspectores / detalle técnico */}
        {tieneGfw && (
          <details className="group rounded-tarjeta border border-neutral-800 bg-neutral-900/40 text-xs">
            <summary className="flex cursor-pointer items-center justify-between p-2.5 text-neutral-400 transition select-none hover:text-neutral-200">
              <span className="flex items-center gap-1.5 font-medium">
                <svg
                  className="h-3.5 w-3.5 text-neutral-500 transition-transform duration-200 group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Ver detalle técnico de auditoría
              </span>
              <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                GFW API v2
              </span>
            </summary>
            <div className="space-y-1.5 border-t border-neutral-800/80 px-3 py-2.5 font-mono text-[11px] text-neutral-400">
              <div className="flex justify-between gap-2">
                <span className="text-neutral-500">dataset:</span>
                <span className="text-neutral-300">umd_tree_cover_loss (Hansen / UMD)</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-neutral-500">criterio_api:</span>
                <span className="text-neutral-300">
                  {gfw?.criterio ?? 'umd_tree_cover_loss >= 2021'}
                </span>
              </div>
              {gfw?.checkedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500">checked_at_iso:</span>
                  <span className="text-neutral-300">{gfw.checkedAt}</span>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </Tarjeta>
  );
}
