/**
 * Presets de animación compartidos (issue #29).
 *
 * Duraciones entre 150 y 250 ms. El respeto a `prefers-reduced-motion` lo
 * garantiza `MotionConfig reducedMotion="user"` en `components/motion-provider.tsx`.
 */

export const DURACION_ETAPA_S = 0.2;
export const DURACION_DETALLE_S = 0.2;
export const DURACION_AVISO_S = 0.18;
export const DURACION_CARGA_S = 0.15;

/** Cambio de etapa en formularios por pasos (alta de lote, auditoría, recepción). */
export const transicionEtapa = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: DURACION_ETAPA_S, ease: 'easeOut' },
} as const;

/** Apertura/cierre de bloques "Detalles técnicos" plegables. */
export const aperturaDetalle = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: DURACION_DETALLE_S, ease: 'easeInOut' },
} as const;

/** Entrada de avisos y alertas. */
export const aparicionAviso = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: DURACION_AVISO_S, ease: 'easeOut' },
} as const;

/** Pulso de los indicadores de carga (esqueleto / spinner). */
export const carga = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { duration: DURACION_CARGA_S, repeat: Infinity, ease: 'easeInOut' },
} as const;

export const presets = { transicionEtapa, aperturaDetalle, aparicionAviso, carga } as const;
