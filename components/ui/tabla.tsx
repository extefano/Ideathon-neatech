import type { ReactNode } from 'react';

export type ColumnaTabla = {
  clave: string;
  titulo: string;
  numerica?: boolean;
};

export function Tabla({
  columnas,
  filas,
  vacio = 'Sin datos todavía.',
  className = '',
}: {
  columnas: ColumnaTabla[];
  filas: Record<string, ReactNode>[];
  vacio?: string;
  className?: string;
}) {
  if (filas.length === 0) {
    return <p className={`text-texto-tenue text-sm ${className}`}>{vacio}</p>;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left text-sm">
        <thead className="text-texto-suave">
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                scope="col"
                className={`py-2 pr-4 font-semibold ${columna.numerica ? 'text-right' : ''}`}
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr key={indice} className="border-borde border-t">
              {columnas.map((columna) => (
                <td
                  key={columna.clave}
                  className={`py-2 pr-4 ${columna.numerica ? 'text-right font-mono tabular-nums' : ''}`}
                >
                  {fila[columna.clave] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
