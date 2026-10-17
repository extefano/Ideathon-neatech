import Link from 'next/link';
import { LoteCard } from '@/components/lote-card';
import { Aviso } from '@/components/ui/aviso';
import {
  CERTIFICACIONES_COMERCIALES,
  esCodigoCertificacionComercial,
  filtrarLotesPorCertificacion,
  type CodigoCertificacionComercial,
} from '@/lib/domain';
import { listarLotes, type LoteListItem } from '@/lib/queries';

export const dynamic = 'force-dynamic';

type FiltrosMercado = {
  provincia?: string;
  categoria?: string;
  raza?: string;
  moneda?: string;
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
  let lotes: LoteListItem[] = [];
  let huboError = false;

  try {
    lotes = await listarLotes({ estado: 'DISPONIBLE' });
  } catch (error) {
    huboError = true;
    console.error('Error listando lotes del mercado', error);
  }

  const certFiltro: CodigoCertificacionComercial | '' =
    sp.certificacion && esCodigoCertificacionComercial(sp.certificacion) ? sp.certificacion : '';

  const filtros = {
    provincia: sp.provincia ?? '',
    categoria: sp.categoria ?? '',
    raza: sp.raza ?? '',
    moneda: sp.moneda ?? '',
    certificacion: certFiltro,
  };

  const lotesPorAtributo = lotes.filter(
    (lote) =>
      (!filtros.provincia || lote.provincia === filtros.provincia) &&
      (!filtros.categoria || lote.categoria === filtros.categoria) &&
      (!filtros.raza || lote.raza === filtros.raza) &&
      (!filtros.moneda || lote.moneda === filtros.moneda),
  );
  const filtrados = certFiltro
    ? filtrarLotesPorCertificacion(lotesPorAtributo, certFiltro)
    : lotesPorAtributo;

  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Mercado de lotes</h1>
        <p className="text-texto-suave max-w-3xl">
          Lotes con origen verificado y libre de deforestación (EUDR) y certificaciones comerciales
          voluntarias. Compará kilos, precio por kg y uniformidad antes de financiar.
        </p>
      </header>

      <form method="get" className="rounded-tarjeta border-borde bg-panel border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CampoSelect
            etiqueta="Provincia"
            name="provincia"
            valor={filtros.provincia}
            opciones={unicos(lotes, 'provincia')}
          />
          <CampoSelect
            etiqueta="Categoría"
            name="categoria"
            valor={filtros.categoria}
            opciones={unicos(lotes, 'categoria')}
          />
          <CampoSelect
            etiqueta="Raza"
            name="raza"
            valor={filtros.raza}
            opciones={unicos(lotes, 'raza')}
          />
          <div className="space-y-1">
            <label htmlFor="filtro-moneda" className="text-texto-suave block text-xs font-semibold">
              Moneda
            </label>
            <select
              id="filtro-moneda"
              name="moneda"
              defaultValue={filtros.moneda}
              className="rounded-control focus-visible:ring-foco border-borde-fuerte bg-panel text-texto min-h-11 w-full border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Todas</option>
              <option value="USDC">USDC</option>
              <option value="EURC">EURC</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="filtro-certificacion"
              className="text-texto-suave block text-xs font-semibold"
            >
              Valor agregado
            </label>
            <select
              id="filtro-certificacion"
              name="certificacion"
              defaultValue={filtros.certificacion}
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
      ) : filtrados.length === 0 ? (
        <Aviso variante="info" titulo="No hay lotes con estos filtros">
          {hayFiltros
            ? 'Probá quitar algún filtro para ver más lotes.'
            : 'No hay lotes disponibles en este momento.'}
        </Aviso>
      ) : (
        <section aria-label="Listado de lotes" className="space-y-4">
          <h2 className="text-lg font-semibold">
            Lotes ({filtrados.length}
            {hayFiltros ? ` de ${lotes.length}` : ''})
          </h2>
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
