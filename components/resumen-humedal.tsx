import {
  descripcionHumedal,
  etiquetaFuenteHumedal,
  formatearHectareas,
  type EstadoHumedal,
  type FuenteHumedal,
} from '@/lib/humedales';

/**
 * Resumen ambiental persistido del lote (ficha y pasaporte). No consulta la
 * fuente en vivo: muestra el snapshot que acompañó al Sello 1.
 */
export function ResumenHumedal({
  estado,
  porcentajeHumedal,
  superficieHumedalHa,
  fuente,
}: {
  estado: EstadoHumedal;
  porcentajeHumedal: string | null;
  superficieHumedalHa?: string | null;
  fuente: FuenteHumedal | null;
}) {
  const verificado = estado === 'VERIFICADO';

  return (
    <div
      className={`rounded-tarjeta border p-3.5 text-sm ${
        verificado ? 'border-brand/30 bg-brand/5' : 'border-neutral-700 bg-neutral-900/60'
      }`}
    >
      <p className={`font-semibold ${verificado ? 'text-brand' : 'text-neutral-200'}`}>
        Humedales: {descripcionHumedal({ estado, porcentajeHumedal })}
      </p>
      {verificado && superficieHumedalHa && (
        <p className="mt-0.5 text-xs text-neutral-400">
          {formatearHectareas(superficieHumedalHa)} ha clasificadas como humedal.
        </p>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        {fuente ? (
          <span>
            Fuente: {etiquetaFuenteHumedal(fuente)}
            {fuente.fechaDatos ? ` · datos de ${fuente.fechaDatos}` : ''}
          </span>
        ) : (
          <span>Sin fuente de humedales aplicada.</span>
        )}
        {fuente?.esDemo && (
          <span className="bg-brand rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-950 uppercase">
            Datos de demostración
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">
        Dato estructural e informativo del establecimiento; no condiciona por sí solo el Sello 1.
      </p>
    </div>
  );
}
