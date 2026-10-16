import type { ReactNode } from 'react';

type Variante = 'info' | 'exito' | 'alerta' | 'error';

const estilos: Record<Variante, { clase: string; rol: 'status' | 'alert'; icono: string }> = {
  info: {
    clase: 'border-neutral-700 bg-neutral-900 text-neutral-200',
    rol: 'status',
    icono: 'ℹ',
  },
  exito: {
    clase: 'border-brand/40 bg-brand/10 text-brand',
    rol: 'status',
    icono: '✓',
  },
  alerta: {
    clase: 'border-neutral-500/60 bg-neutral-500/10 text-neutral-100',
    rol: 'alert',
    icono: '⚠',
  },
  error: {
    clase: 'border-red-500/40 bg-red-500/10 text-red-300',
    rol: 'alert',
    icono: '✕',
  },
};

export function Aviso({
  variante = 'info',
  titulo,
  children,
  className = '',
}: {
  variante?: Variante;
  titulo?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { clase, rol, icono } = estilos[variante];

  return (
    <div
      role={rol}
      className={`rounded-tarjeta flex gap-3 border p-4 text-sm ${clase} ${className}`}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold">
        {icono}
      </span>
      <div className="space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}
