import { MapaLote } from '@/components/mapa-lote';
import { Aviso } from '@/components/ui/aviso';
import { Tabla } from '@/components/ui/tabla';
import { Tarjeta } from '@/components/ui/tarjeta';

export type GfwConsulta = {
  totalLossHa?: number;
  checkedAt?: string;
  criterio?: string;
  byYear?: { year: number; lossHa: number }[];
};

function fechaHumana(iso?: string): { fecha: string; hora: string } | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return {
    fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
    hora: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function EvidenciaSatelital({
  gfw,
  poligono,
}: {
  gfw: GfwConsulta | null;
  poligono: unknown;
}) {
  const totalLossHa = gfw?.totalLossHa ?? 0;
  const conforme = totalLossHa === 0;
  const byYear = gfw?.byYear ?? [];
  const consultado = fechaHumana(gfw?.checkedAt);

  return (
    <Tarjeta titulo="Evidencia satelital (EUDR)">
      <div className="space-y-3">
        {!gfw ? (
          <Aviso variante="alerta" titulo="Sin consulta satelital registrada">
            Todavía no se verificó este polígono contra Global Forest Watch.
          </Aviso>
        ) : conforme ? (
          <Aviso variante="exito" titulo="Conforme EUDR · Libre de deforestación">
            La parcela analizada no presenta pérdida de bosque posterior al 31/12/2020.
          </Aviso>
        ) : (
          <Aviso variante="error" titulo="No conforme EUDR · Pérdida arbórea detectada">
            Se detectaron <strong>{totalLossHa} ha</strong> de pérdida de masa arbórea posterior a
            2020, por lo que el lote no es apto para exportación EUDR.
          </Aviso>
        )}

        <p className="text-sm text-neutral-300">
          El Reglamento de la Unión Europea (EUDR) prohíbe la comercialización de ganado proveniente
          de parcelas con deforestación posterior al 31 de diciembre de 2020.
        </p>

        <div className="rounded-tarjeta border-borde overflow-hidden border">
          <MapaLote poligono={poligono} />
        </div>

        {!conforme && byYear.length > 0 && (
          <Tabla
            columnas={[
              { clave: 'year', titulo: 'Año' },
              { clave: 'lossHa', titulo: 'Pérdida (ha)', numerica: true },
            ]}
            filas={byYear.map((anio) => ({ year: String(anio.year), lossHa: anio.lossHa }))}
          />
        )}

        <dl className="text-xs text-neutral-500">
          <div>
            <dt className="inline">Fuente satelital: </dt>
            <dd className="inline text-neutral-400">
              Global Forest Watch (Universidad de Maryland / Hansen)
            </dd>
          </div>
          {consultado && (
            <div className="mt-1">
              <dt className="inline">Auditoría: </dt>
              <dd className="inline text-neutral-400">
                Verificado satelitalmente el {consultado.fecha} a las {consultado.hora} hs
              </dd>
            </div>
          )}
        </dl>

        {gfw?.criterio && (
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer text-neutral-400">
              Detalle técnico de la consulta
            </summary>
            <p className="mt-1 font-mono text-neutral-500">{gfw.criterio}</p>
          </details>
        )}
      </div>
    </Tarjeta>
  );
}
