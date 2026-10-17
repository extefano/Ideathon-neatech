import type { RolUsuario } from '@/lib/auth';
import type { EstadoLote } from '@/lib/domain';

export type AccionLote = { texto: string; href: string };

export type ResumenLote = {
  /** Lenguaje claro para el usuario (nivel principal). */
  etiqueta: string;
  /** Término canónico del flujo, como apoyo. */
  canonico: string;
  descripcion: string;
  accion: AccionLote | null;
};

const ETIQUETAS: Record<EstadoLote, string> = {
  PENDIENTE_VALIDACION: 'Validación pendiente',
  DISPONIBLE: 'Disponible para financiar',
  RECHAZADO_EUDR: 'No conforme EUDR',
  FINANCIADO_EN_ENGORDE: 'En engorde',
  EN_TRANSITO_A_FRIGORIFICO: 'En tránsito al frigorífico',
  CERRADO_CICLO: 'Ciclo cerrado',
};

const CANONICOS: Record<EstadoLote, string> = {
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  DISPONIBLE: 'Disponible',
  RECHAZADO_EUDR: 'Rechazado EUDR',
  FINANCIADO_EN_ENGORDE: 'Financiado en engorde',
  EN_TRANSITO_A_FRIGORIFICO: 'En tránsito a frigorífico',
  CERRADO_CICLO: 'Ciclo cerrado',
};

export function etiquetaEstado(estado: EstadoLote): string {
  return ETIQUETAS[estado];
}

export function terminoCanonicoEstado(estado: EstadoLote): string {
  return CANONICOS[estado];
}

export function resumirLote(input: {
  estado: EstadoLote;
  seal_2_sanitary: boolean;
  codigo: string;
}): ResumenLote {
  const { estado, seal_2_sanitary, codigo } = input;
  const canonico = CANONICOS[estado];

  switch (estado) {
    case 'PENDIENTE_VALIDACION':
      return {
        etiqueta: ETIQUETAS.PENDIENTE_VALIDACION,
        canonico,
        descripcion: 'Falta reintentar la validación satelital EUDR (Global Forest Watch).',
        accion: { texto: 'Reintentar validación', href: `/lotes/${codigo}` },
      };
    case 'DISPONIBLE':
      return {
        etiqueta: ETIQUETAS.DISPONIBLE,
        canonico,
        descripcion:
          'Origen verificado (Sello 1). Esperando que un Comprador deposite el pago en garantía.',
        accion: { texto: 'Fondear y financiar', href: `/lotes/${codigo}` },
      };
    case 'RECHAZADO_EUDR':
      return {
        etiqueta: ETIQUETAS.RECHAZADO_EUDR,
        canonico,
        descripcion:
          'Se detectó pérdida de bosque posterior al 31/12/2020; no apto para exportación.',
        accion: null,
      };
    case 'FINANCIADO_EN_ENGORDE':
      return seal_2_sanitary
        ? {
            etiqueta: 'Engorde finalizado — listo para despacho',
            canonico,
            descripcion:
              'Auditoría del Mes 4 aprobada. Falta el despacho DT-e y la recepción en el frigorífico.',
            accion: { texto: 'Ir a despacho y recepción', href: `/lotes/${codigo}/recepcion` },
          }
        : {
            etiqueta: 'En engorde — auditoría Mes 4 pendiente',
            canonico,
            descripcion: 'La auditoría del Mes 4 la ejecuta el Veterinario acreditado.',
            accion: { texto: 'Ir a auditoría veterinaria', href: `/lotes/${codigo}/auditoria` },
          };
    case 'EN_TRANSITO_A_FRIGORIFICO':
      return {
        etiqueta: ETIQUETAS.EN_TRANSITO_A_FRIGORIFICO,
        canonico,
        descripcion: 'El frigorífico debe registrar el pesaje de recepción en balanza fiscal.',
        accion: { texto: 'Registrar recepción', href: `/lotes/${codigo}/recepcion` },
      };
    case 'CERRADO_CICLO':
      return {
        etiqueta: 'Ciclo cerrado — pasaporte listo',
        canonico,
        descripcion: 'Los 3 sellos están verificados. El pasaporte EUDR público está disponible.',
        accion: { texto: 'Ver pasaporte EUDR', href: `/pasaporte/${codigo}` },
      };
  }
}

/**
 * Acción principal de una tarjeta de lote según el rol que mira.
 * Evita ofrecer pasos que ese rol no puede ejecutar (ej. al productor, "Fondear").
 */
export function accionLoteParaRol(
  input: { estado: EstadoLote; seal_2_sanitary: boolean; codigo: string },
  rol: RolUsuario,
): AccionLote | null {
  const { estado, seal_2_sanitary, codigo } = input;
  const ficha: AccionLote = { texto: 'Ver ficha del lote', href: `/lotes/${codigo}` };
  const pasaporte: AccionLote = { texto: 'Ver pasaporte EUDR', href: `/pasaporte/${codigo}` };

  if (rol === 'FRIGORIFICO') {
    switch (estado) {
      case 'FINANCIADO_EN_ENGORDE':
        return seal_2_sanitary
          ? { texto: 'Registrar recepción', href: `/lotes/${codigo}/recepcion` }
          : ficha;
      case 'EN_TRANSITO_A_FRIGORIFICO':
        return { texto: 'Registrar recepción', href: `/lotes/${codigo}/recepcion` };
      case 'CERRADO_CICLO':
        return pasaporte;
      default:
        return ficha;
    }
  }

  if (rol === 'VETERINARIO') {
    return estado === 'FINANCIADO_EN_ENGORDE' && !seal_2_sanitary
      ? { texto: 'Revisar auditoría (Mes 4)', href: `/lotes/${codigo}/auditoria` }
      : ficha;
  }

  if (rol === 'COMPRADOR') {
    switch (estado) {
      case 'DISPONIBLE':
        return { texto: 'Fondear y financiar', href: `/lotes/${codigo}` };
      case 'FINANCIADO_EN_ENGORDE':
        return seal_2_sanitary
          ? { texto: 'Registrar recepción', href: `/lotes/${codigo}/recepcion` }
          : ficha;
      case 'EN_TRANSITO_A_FRIGORIFICO':
        return { texto: 'Registrar recepción', href: `/lotes/${codigo}/recepcion` };
      case 'CERRADO_CICLO':
        return pasaporte;
      default:
        return ficha;
    }
  }

  // PRODUCTOR
  switch (estado) {
    case 'PENDIENTE_VALIDACION':
      return { texto: 'Reintentar validación', href: `/lotes/${codigo}` };
    case 'RECHAZADO_EUDR':
      return null;
    case 'FINANCIADO_EN_ENGORDE':
      return seal_2_sanitary
        ? { texto: 'Despachar (DT-e)', href: `/lotes/${codigo}/recepcion` }
        : ficha;
    case 'CERRADO_CICLO':
      return pasaporte;
    default:
      return ficha;
  }
}
