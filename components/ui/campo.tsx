import type { InputHTMLAttributes } from 'react';

export type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  etiqueta: string;
  name: string;
  id?: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
};

export function Campo({
  etiqueta,
  name,
  id,
  ayuda,
  error,
  requerido = false,
  className = '',
  ...props
}: CampoProps) {
  const campoId = id ?? `campo-${name}`;
  const ayudaId = ayuda ? `${campoId}-ayuda` : undefined;
  const errorId = error ? `${campoId}-error` : undefined;
  const describedBy = [ayudaId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={campoId}
        className="block text-xs font-semibold tracking-wide text-neutral-400 uppercase"
      >
        {etiqueta}
        {requerido && (
          <span className="text-brand" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <input
        {...props}
        id={campoId}
        name={name}
        required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-control focus-visible:border-brand focus-visible:ring-foco focus-visible:ring-offset-superficie min-h-11 w-full border bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${error ? 'border-red-500/60' : 'border-neutral-700'} ${className}`}
      />
      {ayuda && !error && (
        <p id={ayudaId} className="text-xs text-neutral-500">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
