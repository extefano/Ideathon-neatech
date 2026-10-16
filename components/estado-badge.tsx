import type { EstadoLote } from '@/lib/domain';

const colores: Record<EstadoLote, string> = {
  PENDIENTE_VALIDACION: 'border-neutral-700 bg-neutral-900 text-neutral-300',
  DISPONIBLE: 'border-brand/40 bg-brand/10 text-brand',
  RECHAZADO_EUDR: 'border-red-500/30 bg-red-500/10 text-red-300',
  FINANCIADO_EN_ENGORDE: 'border-neutral-600 bg-neutral-800 text-white',
  EN_TRANSITO_A_FRIGORIFICO: 'border-brand/40 bg-neutral-900 text-brand',
  CERRADO_CICLO: 'border-brand bg-brand font-semibold text-neutral-950',
};

export function EstadoBadge({ estado }: { estado: EstadoLote }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${colores[estado]}`}
    >
      {estado.replaceAll('_', ' ')}
    </span>
  );
}
