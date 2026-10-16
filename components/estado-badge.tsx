import type { EstadoLote } from '@/lib/domain';

const colores: Record<EstadoLote, string> = {
  PENDIENTE_VALIDACION: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  DISPONIBLE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  RECHAZADO_EUDR: 'border-red-500/30 bg-red-500/10 text-red-300',
  FINANCIADO_EN_ENGORDE: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  EN_TRANSITO_A_FRIGORIFICO: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  CERRADO_CICLO: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
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
