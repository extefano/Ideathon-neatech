import { describe, expect, it } from 'vitest';
import { ZOOM_UBICACION, mensajeErrorUbicacion, zoomUbicacion } from '@/components/ubicacion';

describe('mensajeErrorUbicacion', () => {
  it('explica cómo recuperarse del rechazo de permiso', () => {
    expect(mensajeErrorUbicacion(1)).toMatch(/rechazado/i);
    expect(mensajeErrorUbicacion(1)).toMatch(/navegador/i);
  });

  it('distingue ubicación no disponible de timeout', () => {
    expect(mensajeErrorUbicacion(2)).not.toBe(mensajeErrorUbicacion(3));
    expect(mensajeErrorUbicacion(3)).toMatch(/tard/i);
  });

  it('devuelve un mensaje genérico para códigos desconocidos', () => {
    expect(mensajeErrorUbicacion(99)).toBe(mensajeErrorUbicacion(2));
  });
});

describe('zoomUbicacion', () => {
  it('acerca el mapa hasta el zoom de ubicación', () => {
    expect(zoomUbicacion(10)).toBe(ZOOM_UBICACION);
  });

  it('respeta un zoom más cercano que el de ubicación', () => {
    expect(zoomUbicacion(17)).toBe(17);
  });
});
