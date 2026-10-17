import type { ReactNode } from 'react';

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
  className = '',
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hayEncabezado = Boolean(titulo || descripcion || acciones);

  return (
    <section className={`rounded-tarjeta border-borde bg-panel border p-5 ${className}`}>
      {hayEncabezado && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-lg font-semibold">{titulo}</h2>}
            {descripcion && <p className="text-texto-suave mt-1 text-sm">{descripcion}</p>}
          </div>
          {acciones && <div className="shrink-0">{acciones}</div>}
        </header>
      )}
      <div className={hayEncabezado ? 'mt-3' : ''}>{children}</div>
    </section>
  );
}
