import { describe, expect, it } from 'vitest';
import {
  DURACION_AVISO_S,
  DURACION_CARGA_S,
  DURACION_DETALLE_S,
  DURACION_ETAPA_S,
  aparicionAviso,
  carga,
  presets,
  transicionEtapa,
} from '@/lib/motion';

describe('presets de Motion (#29)', () => {
  it('exporta los cuatro presets', () => {
    expect(Object.keys(presets)).toEqual([
      'transicionEtapa',
      'aperturaDetalle',
      'aparicionAviso',
      'carga',
    ]);
  });

  it('todas las duraciones quedan entre 150 y 250 ms', () => {
    const duraciones = [DURACION_ETAPA_S, DURACION_DETALLE_S, DURACION_AVISO_S, DURACION_CARGA_S];
    for (const duracion of duraciones) {
      expect(duracion).toBeGreaterThanOrEqual(0.15);
      expect(duracion).toBeLessThanOrEqual(0.25);
    }
  });

  it('transicionEtapa documenta duración y easing', () => {
    expect(transicionEtapa.transition.duration).toBe(DURACION_ETAPA_S);
    expect(transicionEtapa.transition.ease).toBe('easeOut');
    expect(transicionEtapa.animate).toEqual({ opacity: 1, x: 0 });
  });

  it('aparicionAviso entra desde arriba con fade', () => {
    expect(aparicionAviso.initial).toEqual({ opacity: 0, y: -6 });
    expect(aparicionAviso.transition.duration).toBe(DURACION_AVISO_S);
  });

  it('carga es un pulso en loop sin desplazamiento', () => {
    expect(carga.transition.repeat).toBe(Infinity);
    expect(carga.animate).toHaveProperty('opacity');
    expect(carga.animate).not.toHaveProperty('x');
    expect(carga.animate).not.toHaveProperty('y');
  });
});
