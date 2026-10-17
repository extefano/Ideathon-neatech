import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro';
type Tamano = 'md' | 'lg';

const variantes: Record<Variante, string> = {
  primario: 'bg-brand text-neutral-950 hover:bg-brand/90',
  secundario:
    'border border-borde-fuerte bg-panel text-texto hover:border-texto-tenue hover:bg-panel-elevado',
  peligro: 'border border-red-600/40 bg-red-500/10 text-red-700 hover:bg-red-500/20',
};

const tamanos: Record<Tamano, string> = {
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-12 px-5 py-2.5 text-base',
};

export type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  children: ReactNode;
};

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: BotonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`rounded-control focus-visible:ring-foco focus-visible:ring-offset-superficie inline-flex min-h-11 items-center justify-center gap-2 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${tamanos[tamano]} ${className}`}
    >
      {cargando && (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
