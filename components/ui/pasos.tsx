export type Paso = {
  titulo: string;
  descripcion?: string;
};

export function Pasos({
  pasos,
  actual,
  className = '',
}: {
  pasos: Paso[];
  actual: number;
  className?: string;
}) {
  return (
    <ol className={`flex flex-wrap gap-2 ${className}`}>
      {pasos.map((paso, indice) => {
        const estado = indice < actual ? 'completada' : indice === actual ? 'actual' : 'pendiente';
        const estilos =
          estado === 'actual'
            ? 'border-brand bg-brand text-neutral-950'
            : estado === 'completada'
              ? 'border-brand-fuerte/40 bg-brand/15 text-brand-fuerte'
              : 'border-borde bg-panel-elevado text-texto-tenue';

        return (
          <li
            key={paso.titulo}
            aria-current={estado === 'actual' ? 'step' : undefined}
            className={`rounded-control flex min-h-11 items-center gap-2 border px-3 py-1.5 text-sm ${estilos}`}
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold"
            >
              {estado === 'completada' ? '✓' : indice + 1}
            </span>
            <span className="font-semibold">{paso.titulo}</span>
            {paso.descripcion && (
              <span className="hidden text-xs opacity-80 sm:inline">{paso.descripcion}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
