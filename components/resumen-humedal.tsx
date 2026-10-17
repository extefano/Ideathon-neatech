import {
  descripcionHumedal,
  etiquetaFuenteHumedal,
  formatearHectareas,
  type EstadoHumedal,
  type FuenteHumedal,
} from '@/lib/humedales';

/**
 * Resumen ambiental persistido del lote (ficha y pasaporte): atributo
 * informativo, sin anclaje on-chain. Usa el amarillo de marca del sitio.
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
    <div className="rounded-tarjeta border-brand-fuerte/30 bg-brand/10 text-texto border p-3.5 text-sm">
      <p className="font-semibold">
        Humedales:{' '}
        <span className={verificado ? 'text-brand-fuerte' : undefined}>
          {descripcionHumedal({ estado, porcentajeHumedal })}
        </span>
      </p>
      {verificado && superficieHumedalHa && (
        <p className="text-texto-suave mt-0.5 text-xs">
          {formatearHectareas(superficieHumedalHa)} ha clasificadas como humedal.
        </p>
      )}
      <p className="text-texto-suave mt-1 flex flex-wrap items-center gap-2 text-xs">
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
      <p className="text-texto-tenue mt-1 text-[11px]">
        Atributo informativo del establecimiento; no forma parte del anclaje del Sello 1.
      </p>
    </div>
  );
}
