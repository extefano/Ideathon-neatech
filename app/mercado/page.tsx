import Link from 'next/link';
import { LotesMarketplace } from '@/components/lotes-marketplace';
import { Aviso } from '@/components/ui/aviso';
import {
  CERTIFICACIONES_COMERCIALES,
  esCodigoCertificacionComercial,
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
}: {
  etiqueta: string;
  name: string;
  valor: string;
  opciones: string[];
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={`filtro-${name}`} className="text-texto-suave block text-xs font-semibold">
        {etiqueta}
      </label>
      <select
        id={`filtro-${name}`}
        name={name}
        defaultValue={valor}
        className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto min-h-11 w-full border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <option value="">Todas</option>
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

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <Link
        href="/"
        className="focus-visible:ring-foco hover:text-brand-fuerte text-texto-suave text-sm"
      >
        ← Inicio
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Mercado de lotes</h1>
        <p className="text-texto-suave max-w-3xl">
          Lotes con origen verificado y libre de deforestación (Eje 1 · EUDR) y diferenciales
          comerciales voluntarios (Eje 2 · Valor agregado). Compará kilos, precio por kg y
          uniformidad antes de financiar.
        </p>
      </header>

      <Aviso variante="info" titulo="Cómo funciona la financiación">
        El Comprador deposita el pago en garantía (escrow). El Productor cobra 40 % al inicio, 30 %
        a mitad del engorde y 30 % en la entrega.
      </Aviso>

      {humedal.errores.length > 0 && (
        <Aviso variante="error" titulo="Revisá los filtros de humedal">
          <ul className="list-disc space-y-1 pl-4">
            {humedal.errores.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <form method="get" className="rounded-tarjeta border-borde bg-panel border p-4">
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
          <CampoSelect
            etiqueta="Moneda"
            name="moneda"
            valor={filtros.moneda ?? ''}
            opciones={conValorActual(['USDC', 'EURC'], filtros.moneda)}
          />
          <div className="space-y-1">
            <label htmlFor="filtro-humMin" className="text-texto-suave block text-xs font-semibold">
              Humedal mínimo (%)
            </label>
            <input
              id="filtro-humMin"
              name="humMin"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={humedal.min ?? ''}
              className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto min-h-11 w-full border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="filtro-humMax" className="text-texto-suave block text-xs font-semibold">
              Humedal máximo (%)
            </label>
            <input
              id="filtro-humMax"
              name="humMax"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={humedal.max ?? ''}
              className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto min-h-11 w-full border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
          <div className="flex min-h-11 items-center gap-2 pb-2">
            <input
              id="filtro-humSinDato"
              name="humSinDato"
              type="checkbox"
              value="1"
              defaultChecked={humedal.sinDato}
              className="accent-brand h-4 w-4"
            />
            <label htmlFor="filtro-humSinDato" className="text-texto text-sm">
              Solo lotes sin dato de humedal
            </label>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="filtro-certificacion"
              className="text-texto-suave block text-xs font-semibold"
            >
              Valor agregado (Eje 2)
            </label>
            <select
              id="filtro-certificacion"
              name="certificacion"
              defaultValue={certFiltro}
              className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto min-h-11 w-full border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Todas las preferencias</option>
              {CERTIFICACIONES_COMERCIALES.map((cert) => (
                <option key={cert.codigo} value={cert.codigo}>
                  {cert.etiquetaFiltro}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-control focus-visible:ring-foco bg-brand hover:bg-brand/90 min-h-11 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
          >
            Aplicar filtros
          </button>
          {hayFiltros && (
            <Link
              href="/mercado"
              className="focus-visible:ring-foco hover:text-brand-fuerte text-texto-suave text-sm underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Limpiar filtros
            </Link>
          )}
        </div>
      </form>

      {huboError ? (
        <Aviso variante="error" titulo="No pudimos cargar el mercado">
          Volvé a intentar en unos segundos.
        </Aviso>
      ) : lotes.length === 0 ? (
        <Aviso variante="info" titulo="No hay lotes con estos filtros">
          {hayFiltros
            ? 'Probá quitar algún filtro para ver más lotes.'
            : 'No hay lotes disponibles en este momento.'}
        </Aviso>
      ) : (
        <LotesMarketplace lotes={lotes} filtroInicial={certFiltro || 'TODOS'} />
      )}
    </main>
  );
}
