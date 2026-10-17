'use client';

import { useMemo, useState } from 'react';
import { LoteCard } from '@/components/lote-card';
import { Aviso } from '@/components/ui/aviso';
import { Boton } from '@/components/ui/boton';
import {
  CERTIFICACIONES_COMERCIALES,
  contarLotesPorCertificacion,
  filtrarLotesPorCertificacion,
  obtenerDefinicionCertificacion,
  type CodigoCertificacionComercial,
} from '@/lib/domain';
import type { LoteListItem } from '@/lib/queries';

const claseFiltroActivo =
  'rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie border-brand bg-brand min-h-11 border px-3.5 py-2 text-xs font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';
const claseFiltroInactivo =
  'rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie border-borde-fuerte bg-panel text-texto hover:border-texto-tenue hover:bg-panel-elevado min-h-11 border px-3.5 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';

export function LotesMarketplace({
  lotes,
  filtroInicial = 'TODOS',
}: {
  lotes: LoteListItem[];
  filtroInicial?: CodigoCertificacionComercial | 'TODOS';
}) {
  const [filtro, setFiltro] = useState<CodigoCertificacionComercial | 'TODOS'>(filtroInicial);

  const conteo = useMemo(() => contarLotesPorCertificacion(lotes), [lotes]);
  const lotesFiltrados = useMemo(
    () => filtrarLotesPorCertificacion(lotes, filtro),
    [lotes, filtro],
  );
  const definicionActiva = filtro !== 'TODOS' ? obtenerDefinicionCertificacion(filtro) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-tarjeta border-borde bg-panel border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-texto text-sm font-semibold">
              Filtrar por preferencia comercial (Eje 2 · Valor agregado)
            </p>
            <p className="text-texto-suave mt-0.5 text-xs">
              Diferenciales voluntarios para compradores e importadores (UE / Mercosur). No
              reemplazan los 3 sellos obligatorios de acceso aduanero EUDR + SENASA (Eje 1).
            </p>
          </div>
          <span className="border-borde-fuerte bg-panel-elevado text-texto-suave rounded border px-2 py-0.5 font-mono text-[11px]">
            Eje 2 · Voluntario
          </span>
        </div>

        <div
          role="group"
          aria-label="Filtrar lotes por certificación comercial voluntaria"
          className="mt-3 flex flex-wrap gap-2"
        >
          <button
            type="button"
            aria-pressed={filtro === 'TODOS'}
            onClick={() => setFiltro('TODOS')}
            className={filtro === 'TODOS' ? claseFiltroActivo : claseFiltroInactivo}
          >
            Todos ({lotes.length})
          </button>

          {CERTIFICACIONES_COMERCIALES.map((cert) => {
            const activo = filtro === cert.codigo;
            const cantidad = conteo[cert.codigo] ?? 0;
            return (
              <button
                key={cert.codigo}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(cert.codigo)}
                className={activo ? claseFiltroActivo : claseFiltroInactivo}
              >
                {cert.etiquetaFiltro} ({cantidad})
              </button>
            );
          })}
        </div>

        {definicionActiva && (
          <div
            role="status"
            className="border-borde bg-panel-elevado text-texto-suave mt-3 rounded border p-3 text-xs"
          >
            <p className="text-texto font-semibold">
              {definicionActiva.nombre} ·{' '}
              <span className="text-texto-suave font-normal">{definicionActiva.norma}</span>
            </p>
            <p className="text-texto-suave mt-1">{definicionActiva.rolTecnico}</p>
          </div>
        )}
      </div>

      <section aria-label="Listado de lotes">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Lotes ({lotesFiltrados.length}
            {filtro !== 'TODOS' ? ` de ${lotes.length}` : ''})
          </h2>
          {filtro !== 'TODOS' && (
            <button
              type="button"
              onClick={() => setFiltro('TODOS')}
              className="focus-visible:ring-foco text-brand-fuerte text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Mostrar todos los lotes
            </button>
          )}
        </div>

        {lotesFiltrados.length === 0 ? (
          <div className="mt-4">
            <Aviso variante="info" titulo="No hay lotes que coincidan con este filtro comercial">
              <p>
                Ningún lote registrado cuenta todavía con la certificación{' '}
                <strong>{definicionActiva?.nombre ?? ''}</strong>.
              </p>
              <div className="mt-3">
                <Boton variante="secundario" onClick={() => setFiltro('TODOS')}>
                  Ver todos los lotes ({lotes.length})
                </Boton>
              </div>
            </Aviso>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lotesFiltrados.map((lote) => (
              <LoteCard key={lote.id} lote={lote} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
