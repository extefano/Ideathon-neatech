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
 */
export function PorcentajeHumedal({ reporte }: { reporte: ReporteHumedalV1 }) {
  const fuente = reporte.fuente;
  const verificado = reporte.estado === 'VERIFICADO';
  const porcentaje = formatearPorcentajeHumedal(reporte.porcentajeHumedal);

  return (
    <div
      role="status"
      className={`rounded-tarjeta mt-3 border p-3 text-sm ${
        verificado
          ? 'border-brand/40 bg-brand/5 text-neutral-100'
          : 'border-neutral-700 bg-neutral-900 text-neutral-200'
      }`}
    >
      {verificado ? (
        <p className="font-semibold">
          Humedales: <span className="text-brand">{porcentaje} % del campo</span>
          {porcentaje !== null && Number(reporte.porcentajeHumedal) > 0 && (
            <span className="text-neutral-400">
              {' '}
              ({formatearHectareas(reporte.superficieHumedalHa)} ha)
            </span>
          )}
        </p>
      ) : (
        <p className="font-semibold">Sin dato de humedal</p>
      )}

      {!verificado && (
        <p className="mt-1 text-xs text-neutral-400">{descripcionHumedal(reporte)}</p>
      )}

      {fuente && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
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
        <p className="mt-1 text-xs text-neutral-500">
          Podés continuar con el registro; el reporte quedará anotado como “sin dato”.
        </p>
      )}

      <details className="mt-2 text-xs text-neutral-400">
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
