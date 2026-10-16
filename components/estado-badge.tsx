import { etiquetaEstado, terminoCanonicoEstado } from '@/lib/estado-lote';
import type { EstadoLote } from '@/lib/domain';

const colores: Record<EstadoLote, string> = {
  PENDIENTE_VALIDACION: 'border-neutral-600 bg-neutral-800/50 text-neutral-300',
  DISPONIBLE: 'border-brand/50 bg-brand/10 text-brand',
  // Única excepción de la paleta (issue #18): el rechazo EUDR debe leerse como error.
  RECHAZADO_EUDR: 'border-red-500/30 bg-red-500/10 text-red-300',
  FINANCIADO_EN_ENGORDE: 'border-brand bg-brand text-neutral-950',
  EN_TRANSITO_A_FRIGORIFICO: 'border-neutral-400/60 bg-neutral-400/10 text-neutral-200',
  CERRADO_CICLO: 'border-white/60 bg-white/10 text-white',
};

export function EstadoBadge({ estado }: { estado: EstadoLote }) {
  return (
    <span
      title={terminoCanonicoEstado(estado)}
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${colores[estado]}`}
    >
      {etiquetaEstado(estado)}
    </span>
  );
}
