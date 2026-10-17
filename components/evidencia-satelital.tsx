import { Check, X } from 'lucide-react';
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
        className="border-brand-fuerte/40 bg-brand/10 text-brand-fuerte inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      >
        <Check aria-hidden="true" strokeWidth={3} className="h-3.5 w-3.5" />
        Conforme EUDR · Libre de deforestación
      </span>
    ) : (
      <span
        role="alert"
        className="inline-flex items-center gap-1.5 rounded-full border border-red-600/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-700"
      >
        <X aria-hidden="true" strokeWidth={3} className="h-3.5 w-3.5" />
        No conforme EUDR · Pérdida arbórea detectada
      </span>
    )
  ) : (
    <span className="border-borde-fuerte bg-panel text-texto-suave inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
      <span className="bg-texto-tenue h-1.5 w-1.5 rounded-full" />
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
            <div className="rounded-tarjeta border-brand-fuerte/30 bg-brand/5 border p-3.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand-fuerte font-medium">Pérdida arbórea post-2020:</span>
                <span className="text-brand-fuerte font-semibold">0,00 ha</span>
              </div>
              <p className="text-texto-suave mt-1 text-xs">
                La parcela analizada no presenta pérdida de bosque nativo desde la fecha de corte
                reglamentaria.
              </p>
            </div>
          ) : (
            <div className="rounded-tarjeta border border-red-600/30 bg-red-50 p-3.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-red-700">Pérdida arbórea post-2020:</span>
                <span className="font-semibold text-red-600">
                  {totalLoss.toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ha
                </span>
              </div>
              <p className="text-texto-suave mt-1 text-xs">
                Se detectaron <strong className="text-red-700">{totalLoss} ha</strong> de pérdida de
                masa arbórea posterior a 2020, por lo que el lote no es apto para exportación EUDR.
              </p>

              {/* Desglose anual en tags/chips */}
              {gfw?.byYear && gfw.byYear.length > 0 && (
                <div className="mt-3 border-t border-red-600/20 pt-2.5">
                  <span className="text-texto-suave text-xs font-medium">
                    Desglose por año detectado:
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gfw.byYear.map((item) => (
                      <span
                        key={item.year}
                        className="rounded-control inline-flex items-center gap-1.5 border border-red-600/40 bg-red-100 px-2.5 py-1 text-xs text-red-700 transition hover:bg-red-100"
                      >
                        <span className="font-semibold text-red-700">{item.year}:</span>
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

        {/* Pie compacto con metadatos y detalle técnico */}
        <div className="border-borde text-texto-suave space-y-2 border-t pt-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span>
              <strong className="text-texto font-medium">
                Corte reglamentario EUDR (31/12/2020):
              </strong>{' '}
              Reglamento de la Unión Europea sobre deforestación.
            </span>
            {tieneGfw && (
              <span className="text-texto-tenue">
                Global Forest Watch (Universidad de Maryland / Hansen)
                {fechaAuditoria ? ` · Verificado satelitalmente el ${fechaAuditoria}` : ''}
              </span>
            )}
          </div>

          {tieneGfw && (
            <details className="group pt-0.5 text-xs">
              <summary className="text-texto-tenue hover:text-texto inline-flex cursor-pointer items-center gap-1 font-medium transition select-none">
                <svg
                  className="h-3 w-3 transition-transform duration-200 group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Ver detalle técnico de auditoría
              </summary>
              <div className="rounded-control border-borde bg-panel-elevado/50 text-texto-suave mt-2 space-y-1 border px-3 py-2 font-mono text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-texto-tenue">dataset:</span>
                  <span>umd_tree_cover_loss (Hansen / UMD)</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-texto-tenue">criterio_api:</span>
                  <span>{gfw?.criterio ?? 'umd_tree_cover_loss >= 2021'}</span>
                </div>
                {gfw?.checkedAt && (
                  <div className="flex justify-between gap-2">
                    <span className="text-texto-tenue">checked_at_iso:</span>
                    <span>{gfw.checkedAt}</span>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}
