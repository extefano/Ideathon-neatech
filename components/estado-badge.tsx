import { etiquetaEstado, terminoCanonicoEstado } from '@/lib/estado-lote';
import type { EstadoLote } from '@/lib/domain';

const colores: Record<EstadoLote, string> = {
  PENDIENTE_VALIDACION: 'border-borde-fuerte bg-panel-elevado text-texto-suave',
  DISPONIBLE: 'border-brand/50 bg-brand/15 text-brand-fuerte',
  // Única excepción de la paleta (issue #18): el rechazo EUDR debe leerse como error.
  RECHAZADO_EUDR: 'border-red-600/30 bg-red-500/10 text-red-700',
  FINANCIADO_EN_ENGORDE: 'border-brand bg-brand text-neutral-950',
  EN_TRANSITO_A_FRIGORIFICO: 'border-borde-fuerte bg-panel-elevado text-texto',
  CERRADO_CICLO: 'border-texto bg-texto text-panel',
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
