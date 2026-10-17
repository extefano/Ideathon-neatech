import {
  descripcionHumedal,
  etiquetaFuenteHumedal,
  formatearHectareas,
  formatearPorcentajeHumedal,
  type ReporteHumedalV1,
} from '@/lib/humedales';

/**
 * Resultado del análisis de humedales del polígono (vista previa al guardar y
 * resúmenes de ficha/pasaporte). Nunca convierte "sin dato" en 0 %.
 * Usa el amarillo de marca del sitio como acento del cuadro.
 */
export function PorcentajeHumedal({ reporte }: { reporte: ReporteHumedalV1 }) {
  const fuente = reporte.fuente;
  const verificado = reporte.estado === 'VERIFICADO';
  const porcentaje = formatearPorcentajeHumedal(reporte.porcentajeHumedal);
  const fueraDeCobertura = reporte.motivo === 'fuera_de_cobertura';

  return (
    <div
      role="status"
      className="rounded-tarjeta border-brand-fuerte/40 bg-brand/10 text-texto mt-3 border p-3 text-sm"
    >
      {verificado ? (
        <p className="font-semibold">
          Humedales: <span className="text-brand-fuerte">{porcentaje} % del campo</span>
          {porcentaje !== null && Number(reporte.porcentajeHumedal) > 0 && (
            <span className="text-texto-suave">
              {' '}
              ({formatearHectareas(reporte.superficieHumedalHa)} ha)
            </span>
          )}
        </p>
      ) : (
        <p className="font-semibold">Sin dato de humedal</p>
      )}

      {!verificado && (
        <p className="text-texto-suave mt-1 text-xs">{descripcionHumedal(reporte)}</p>
      )}

      {!verificado && reporte.coberturaPct && (
        <p className="text-texto-suave mt-1 text-xs">
          Cobertura de la fuente sobre el campo: {reporte.coberturaPct} %
        </p>
      )}

      {fuente && (
        <p className="text-texto-suave mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span>
            Fuente: {etiquetaFuenteHumedal(fuente)}
            {fuente.fechaDatos ? ` · datos de ${fuente.fechaDatos}` : ''}
          </span>
          {fuente.esDemo && (
            <span className="bg-brand rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-950 uppercase">
              Datos de demostración
            </span>
          )}
        </p>
      )}

      {!verificado && (
        <p className="text-texto-tenue mt-1 text-xs">
          {fueraDeCobertura
            ? 'El campo está fuera del área que cubre la fuente cargada; podés continuar y el lote queda con “sin dato”.'
            : 'Podés continuar con el registro; el reporte quedará anotado como “sin dato”.'}
        </p>
      )}

      <details className="text-texto-suave mt-2 text-xs">
        <summary className="cursor-pointer select-none">Detalles técnicos</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Estado del análisis: {reporte.estado}</li>
          {reporte.superficieLoteHa && (
            <li>Superficie del polígono: {formatearHectareas(reporte.superficieLoteHa)} ha</li>
          )}
          {reporte.coberturaPct && (
            <li>Cobertura de la fuente sobre el lote: {reporte.coberturaPct} %</li>
          )}
          <li>
            Método: {reporte.metodo.motor} v{reporte.metodo.version} (SRID{' '}
            {reporte.metodo.sridCalculo})
          </li>
          <li>Calculado: {new Date(reporte.calculadoEn).toLocaleString('es-AR')}</li>
          {fuente && fuente.clases.length > 0 && (
            <li>Clases incluidas: {fuente.clases.join(', ')}</li>
          )}
          {fuente?.atribucion && <li>Atribución: {fuente.atribucion}</li>}
        </ul>
      </details>
    </div>
  );
}
