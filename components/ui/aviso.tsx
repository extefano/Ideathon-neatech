import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Variante = 'info' | 'exito' | 'alerta' | 'error';

const estilos: Record<Variante, { clase: string; rol: 'status' | 'alert'; Icono: LucideIcon }> = {
  info: {
    clase: 'border-borde-fuerte bg-panel-elevado text-texto',
    rol: 'status',
    Icono: Info,
  },
  exito: {
    clase: 'border-brand/60 bg-brand/15 text-brand-fuerte',
    rol: 'status',
    Icono: CircleCheck,
  },
  alerta: {
    clase: 'border-brand-fuerte/40 bg-brand/10 text-texto',
    rol: 'alert',
    Icono: TriangleAlert,
  },
  error: {
    clase: 'border-red-600/40 bg-red-500/10 text-red-700',
    rol: 'alert',
    Icono: CircleX,
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
  const { clase, rol, Icono } = estilos[variante];

  return (
    <div
      role={rol}
      className={`rounded-tarjeta flex gap-3 border p-4 text-sm ${clase} ${className}`}
    >
      <Icono aria-hidden="true" strokeWidth={2.5} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}
