import { describe, expect, it } from 'vitest';
import { puedeAvanzar, validarEtapa, type DatosEtapa } from '@/app/lotes/nuevo/etapas';

const datosBase: DatosEtapa = {
  renspa: '05.077.0.00412/00',
  provincia: 'Corrientes',
  localidad: 'Mercedes',
  poligonoOk: true,
  dibujoActivo: false,
  archivoCsv: true,
  csvOk: true,
  monto: '10000',
  pesoObjetivo: '460',
  plazo: '8',
  fechaVigencia: '2026-12-31',
  descripcion: 'Tropa de terneros para engorde a pastura.',
};

describe('validarEtapa (#33)', () => {
  it('etapa 1 exige RENSPA válido, ubicación y polígono', () => {
    expect(validarEtapa(0, datosBase)).toEqual({});

    const errores = validarEtapa(0, {
      ...datosBase,
      renspa: 'mal',
      provincia: '',
      localidad: '',
      poligonoOk: false,
    });
    expect(Object.keys(errores).sort()).toEqual(['localidad', 'poligono', 'provincia', 'renspa']);
  });

  it('bloquea el avance mientras hay un dibujo sin guardar', () => {
    const errores = validarEtapa(0, { ...datosBase, dibujoActivo: true });

    expect(errores.poligono).toContain('dibujo');
    expect(puedeAvanzar(0, { ...datosBase, dibujoActivo: true })).toBe(false);
  });

  it('etapa 2 exige el CSV y que no tenga errores', () => {
    expect(validarEtapa(1, datosBase)).toEqual({});
    expect(validarEtapa(1, { ...datosBase, archivoCsv: false })).toHaveProperty('archivo_rfid_csv');
    expect(validarEtapa(1, { ...datosBase, csvOk: false })).toHaveProperty('archivo_rfid_csv');
  });

  it('etapa 3 (documentos) no bloquea el avance', () => {
    expect(validarEtapa(2, datosBase)).toEqual({});
  });

  it('etapa 4 exige condiciones comerciales y descripción suficiente', () => {
    expect(validarEtapa(3, datosBase)).toEqual({});

    const errores = validarEtapa(3, {
      ...datosBase,
      monto: '',
      pesoObjetivo: '',
      plazo: '',
      fechaVigencia: '',
      descripcion: 'corta',
    });
    expect(Object.keys(errores).sort()).toEqual([
      'descripcionOperacion',
      'fechaVigencia',
      'montoTotalFinanciacion',
      'pesoObjetivoKg',
      'plazoMeses',
    ]);
  });
});

describe('puedeAvanzar (#33)', () => {
  it('solo permite avanzar cuando la etapa no tiene errores', () => {
    expect(puedeAvanzar(0, datosBase)).toBe(true);
    expect(puedeAvanzar(0, { ...datosBase, poligonoOk: false })).toBe(false);
  });
});
