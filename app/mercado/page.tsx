import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { LoteCard } from '@/components/lote-card';
import { Aviso } from '@/components/ui/aviso';
import {
  CERTIFICACIONES_COMERCIALES,
  esCodigoCertificacionComercial,
  filtrarLotesPorCertificacion,
  obtenerDefinicionCertificacion,
  type CodigoCertificacionComercial,
} from '@/lib/domain';
import { listarLotes, type LoteListItem } from '@/lib/queries';
import {
  hayFiltrosHumedal,
  hayFiltrosMercado,
  parsearFiltrosHumedal,
  parsearFiltrosMercado,
} from './filtros';

export const dynamic = 'force-dynamic';

type FiltrosMercado = {
  provincia?: string;
  categoria?: string;
  raza?: string;
  moneda?: string;
  humMin?: string;
  humMax?: string;
  humSinDato?: string;
  certificacion?: string;
};

function unicos(lotes: LoteListItem[], clave: 'provincia' | 'categoria' | 'raza'): string[] {
  const valores = new Set<string>();
  for (const lote of lotes) {
    const valor = lote[clave];
    if (valor) valores.add(valor);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Mantiene visible la opción elegida aunque no esté entre las facetas. */
function conValorActual(opciones: string[], actual?: string): string[] {
  if (!actual || opciones.includes(actual)) return opciones;
  return [...opciones, actual].sort((a, b) => a.localeCompare(b, 'es'));
}

function CampoSelect({
  etiqueta,
  name,
  valor,
  opciones,
  placeholder = 'Todas',
}: {
  etiqueta: string;
  name: string;
  valor: string;
  opciones: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={`filtro-${name}`}
        className="text-texto-tenue block text-[10px] font-semibold tracking-wider uppercase"
      >
        {etiqueta}
      </label>
      <select
        id={`filtro-${name}`}
        name={name}
        defaultValue={valor}
        className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-superficie/40 text-texto hover:border-texto-tenue focus:bg-panel h-9 w-full border py-1.5 pr-9 pl-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm"
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );
}

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosMercado>;
}) {
  const sp = await searchParams;
  const humedal = parsearFiltrosHumedal(sp);
  const filtros = parsearFiltrosMercado(sp);
  const filtroHumedalValido = humedal.errores.length === 0 && hayFiltrosHumedal(humedal);
  const hayFiltros =
    hayFiltrosMercado(filtros) || hayFiltrosHumedal(humedal) || Boolean(sp.certificacion);

  let lotes: LoteListItem[] = [];
  let disponibles: LoteListItem[] = [];
  let huboError = false;

  try {
    // Las opciones de los selects (facetas) salen de una consulta sin filtros
    // sobre la misma ventana de 60 lotes disponibles: elegir un filtro no debe
    // ocultar las demás opciones.
    disponibles = await listarLotes({ estado: 'DISPONIBLE' });

    // Los cinco filtros (incluido humedal) se aplican en la consulta, antes
    // del límite de 60. Ya no se filtran resultados en memoria.
    lotes =
      hayFiltrosMercado(filtros) || filtroHumedalValido
        ? await listarLotes({
            estado: 'DISPONIBLE',
            ...filtros,
            humedal: filtroHumedalValido
              ? { min: humedal.min, max: humedal.max, soloSinDato: humedal.sinDato }
              : undefined,
          })
        : disponibles;
  } catch (error) {
    huboError = true;
    console.error('Error listando lotes del mercado', error);
  }

  const certFiltro: CodigoCertificacionComercial | '' =
    sp.certificacion && esCodigoCertificacionComercial(sp.certificacion) ? sp.certificacion : '';

  const filtrados = certFiltro ? filtrarLotesPorCertificacion(lotes, certFiltro) : lotes;

  const etiquetasFiltrosActivos: string[] = [];
  if (filtros.provincia) etiquetasFiltrosActivos.push(filtros.provincia);
  if (filtros.categoria) etiquetasFiltrosActivos.push(filtros.categoria);
  if (filtros.raza) etiquetasFiltrosActivos.push(filtros.raza);
  if (filtros.moneda) etiquetasFiltrosActivos.push(filtros.moneda);
  if (filtroHumedalValido) {
    if (humedal.sinDato) {
      etiquetasFiltrosActivos.push('Sin dato de humedal');
    } else if (humedal.min != null && humedal.max != null) {
      etiquetasFiltrosActivos.push(`Humedal ${humedal.min}–${humedal.max} %`);
    } else if (humedal.min != null) {
      etiquetasFiltrosActivos.push(`Humedal ≥ ${humedal.min} %`);
    } else if (humedal.max != null) {
      etiquetasFiltrosActivos.push(`Humedal ≤ ${humedal.max} %`);
    }
  }
  if (certFiltro) {
    etiquetasFiltrosActivos.push(obtenerDefinicionCertificacion(certFiltro).etiquetaTarjeta);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header className="space-y-1.5">
        <h1 className="text-texto text-2xl font-bold tracking-tight sm:text-3xl">
          Mercado de lotes
        </h1>
        <p className="text-texto-suave text-sm sm:text-base">
          Ganado con origen verificado libre de deforestación, listo para financiar y seguir etapa
          por etapa.
        </p>
      </header>

      {humedal.errores.length > 0 && (
        <Aviso variante="error" titulo="Revisá los filtros de humedal">
          <ul className="list-disc space-y-1 pl-4">
            {humedal.errores.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <form method="get" className="rounded-tarjeta border-borde bg-panel border p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CampoSelect
            etiqueta="Provincia"
            name="provincia"
            valor={filtros.provincia ?? ''}
            opciones={conValorActual(unicos(disponibles, 'provincia'), filtros.provincia)}
          />
          <CampoSelect
            etiqueta="Categoría"
            name="categoria"
            valor={filtros.categoria ?? ''}
            opciones={conValorActual(unicos(disponibles, 'categoria'), filtros.categoria)}
          />
          <CampoSelect
            etiqueta="Raza"
            name="raza"
            valor={filtros.raza ?? ''}
            opciones={conValorActual(unicos(disponibles, 'raza'), filtros.raza)}
          />
          <div className="space-y-1">
            <label
              htmlFor="filtro-certificacion"
              className="text-texto-tenue block text-[10px] font-semibold tracking-wider uppercase"
            >
              Valor agregado
            </label>
            <select
              id="filtro-certificacion"
              name="certificacion"
              defaultValue={certFiltro}
              className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-superficie/40 text-texto hover:border-texto-tenue focus:bg-panel h-9 w-full border py-1.5 pr-9 pl-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm"
            >
              <option value="">Todas las preferencias</option>
              {CERTIFICACIONES_COMERCIALES.map((cert) => (
                <option key={cert.codigo} value={cert.codigo}>
                  {cert.etiquetaFiltro}
                </option>
              ))}
            </select>
          </div>
          <CampoSelect
            etiqueta="Moneda"
            name="moneda"
            valor={filtros.moneda ?? ''}
            opciones={conValorActual(['USDC', 'EURC'], filtros.moneda)}
            placeholder="Todas"
          />
        </div>

        <div className="border-borde/80 mt-3.5 flex flex-col gap-3 border-t pt-3.5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="w-full space-y-1 sm:w-auto">
              <label
                htmlFor="filtro-humMin"
                className="text-texto-tenue block text-[10px] font-semibold tracking-wider uppercase"
              >
                Rango de humedal (%)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="filtro-humMin"
                  name="humMin"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="Mín (0)"
                  defaultValue={humedal.min ?? ''}
                  className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-superficie/40 text-texto placeholder:text-texto-tenue hover:border-texto-tenue focus:bg-panel h-9 w-full border px-2.5 py-1.5 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none sm:w-24"
                />
                <span aria-hidden="true" className="text-texto-tenue text-xs font-semibold">
                  –
                </span>
                <label htmlFor="filtro-humMax" className="sr-only">
                  Humedal máximo (%)
                </label>
                <input
                  id="filtro-humMax"
                  name="humMax"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="Máx (100)"
                  defaultValue={humedal.max ?? ''}
                  className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-superficie/40 text-texto placeholder:text-texto-tenue hover:border-texto-tenue focus:bg-panel h-9 w-full border px-2.5 py-1.5 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none sm:w-24"
                />
              </div>
            </div>
            <label
              htmlFor="filtro-humSinDato"
              className="rounded-control border-borde-fuerte bg-superficie/40 hover:border-texto-tenue has-[:checked]:border-brand-fuerte/60 has-[:checked]:bg-brand/15 focus-within:ring-foco flex h-9 cursor-pointer items-center gap-2 border px-3 py-1.5 text-xs font-medium transition-colors select-none focus-within:ring-2"
            >
              <input
                id="filtro-humSinDato"
                name="humSinDato"
                type="checkbox"
                value="1"
                defaultChecked={humedal.sinDato}
                className="accent-brand h-3.5 w-3.5 rounded focus:outline-none"
              />
              <span className="text-texto text-xs font-medium">Solo lotes sin dato de humedal</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {hayFiltros && (
              <Link
                href="/mercado"
                className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto-suave hover:border-texto-tenue hover:bg-panel-elevado hover:text-texto inline-flex h-8.5 items-center justify-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <RotateCcw aria-hidden="true" className="h-3 w-3" />
                <span>Limpiar</span>
              </Link>
            )}
            <button
              type="submit"
              className="rounded-control focus-visible:ring-foco bg-brand hover:bg-brand/90 border-brand-fuerte/30 inline-flex h-8.5 cursor-pointer items-center justify-center gap-1.5 border px-3.5 py-1.5 text-xs font-semibold text-neutral-950 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Aplicar filtros</span>
            </button>
          </div>
        </div>
      </form>

      {huboError ? (
        <Aviso variante="error" titulo="No pudimos cargar el mercado">
          Volvé a intentar en unos segundos.
        </Aviso>
      ) : filtrados.length === 0 ? (
        <Aviso variante="info" titulo="No hay lotes con estos filtros">
          {hayFiltros
            ? 'Probá quitar algún filtro para ver más lotes.'
            : 'No hay lotes disponibles en este momento.'}
        </Aviso>
      ) : (
        <section aria-label="Listado de lotes" className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-texto text-lg font-bold tracking-tight">Lotes disponibles</h2>
              <span className="border-borde-fuerte bg-panel-elevado text-texto-suave inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-center font-mono text-xs leading-none font-semibold">
                {filtrados.length}
                {hayFiltros ? ` de ${disponibles.length}` : ''}
              </span>
            </div>
            {etiquetasFiltrosActivos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {etiquetasFiltrosActivos.map((etiqueta) => (
                  <span
                    key={etiqueta}
                    className="border-brand-fuerte/30 bg-brand/15 text-brand-fuerte inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  >
                    {etiqueta}
                  </span>
                ))}
                <Link
                  href="/mercado"
                  className="focus-visible:ring-foco text-texto-suave hover:text-brand-fuerte ml-1 text-xs font-semibold underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Limpiar
                </Link>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((lote) => (
              <LoteCard key={lote.id} lote={lote} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
