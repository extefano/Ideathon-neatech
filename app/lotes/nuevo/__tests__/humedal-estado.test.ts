import { describe, expect, it } from 'vitest';
import {
  crearControladorHumedal,
  type EstadoAnalisisHumedal,
  type ResultadoGuardarPoligono,
} from '@/app/lotes/nuevo/humedal-estado';

const REPORTE = {
  esquema: 'muunar.humedal.v1' as const,
  estado: 'VERIFICADO' as const,
  motivo: null,
  poligono: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-58.1, -29.5],
        [-58.07, -29.5],
        [-58.1, -29.5],
      ],
    ],
  },
  superficieLoteHa: '10.0000',
  superficieHumedalHa: '5.0000',
  porcentajeHumedal: '50.0000',
  coberturaPct: '100',
  fuente: null,
  metodo: { version: '1', motor: 'postgis', sridEntrada: 4326, sridCalculo: 6933, modelo: 'x' },
  calculadoEn: '2026-10-17T05:00:00.000Z',
};

const exito = (id: string): ResultadoGuardarPoligono => ({
  ok: true,
  verificacionId: id,
  reporteHash: 'a'.repeat(64),
  reporte: REPORTE,
});

const fallo: ResultadoGuardarPoligono = { ok: false, errores: ['Sin conexión'] };

function crear(estados: EstadoAnalisisHumedal[] = []) {
  const control = crearControladorHumedal((estado) => estados.push(estado));
  return { control, estados };
}

describe('controlador de análisis de humedales', () => {
  it('una respuesta de una solicitud anterior nunca pisa a la vigente', () => {
    const { control, estados } = crear();

    const tokenA = control.iniciar('A');
    const tokenB = control.iniciar('B');

    expect(control.resolver(tokenB, 'B', exito('ver-B'))).toBe(true);
    expect(control.resolver(tokenA, 'A', exito('ver-A'))).toBe(false);

    expect(estados.at(-1)).toMatchObject({ fase: 'resultado', verificacionId: 'ver-B' });
  });

  it('limpiar durante un análisis descarta la respuesta en vuelo', () => {
    const { control, estados } = crear();

    const token = control.iniciar('A');
    control.invalidar();

    expect(control.resolver(token, 'A', exito('ver-A'))).toBe(false);
    expect(estados.at(-1)).toEqual({ fase: 'vacio' });
    expect(control.geometriaVigente()).toBeNull();
  });

  it('una respuesta solo aplica si la geometría sigue siendo la misma', () => {
    const { control } = crear();

    const token = control.iniciar('A');
    control.iniciar('B');

    expect(control.resolver(token, 'A', exito('ver-A'))).toBe(false);
  });

  it('una respuesta vieja de la misma geometría tampoco aplica', () => {
    const { control, estados } = crear();

    const tokenA = control.iniciar('A');
    control.iniciar('A');

    expect(control.resolver(tokenA, 'A', exito('ver-A'))).toBe(false);
    expect(estados.at(-1)).toEqual({ fase: 'analizando', geometria: 'A' });
    expect(control.geometriaVigente()).toBeNull();
  });

  it('publica el error solo cuando la solicitud sigue vigente', () => {
    const { control, estados } = crear();

    const token = control.iniciar('A');

    expect(control.resolver(token, 'A', fallo)).toBe(true);
    expect(estados.at(-1)).toEqual({ fase: 'error', errores: ['Sin conexión'] });
  });

  it('iniciar un análisis no deja vigencia utilizable', () => {
    const { control } = crear();

    control.iniciar('A');

    expect(control.geometriaVigente()).toBeNull();
  });

  it('un error no deja vigencia', () => {
    const { control } = crear();

    const token = control.iniciar('A');
    control.resolver(token, 'A', fallo);

    expect(control.geometriaVigente()).toBeNull();
  });

  it('el resultado exitoso deja la geometría vigente para reutilizarla al enviar', () => {
    const { control, estados } = crear();

    const token = control.iniciar('A');
    control.resolver(token, 'A', exito('ver-A'));

    expect(estados.at(-1)).toMatchObject({
      fase: 'resultado',
      geometria: 'A',
      verificacionId: 'ver-A',
    });
    expect(control.geometriaVigente()).toBe('A');
  });

  it('una respuesta vieja no revive la vigencia ya consumida', () => {
    const { control } = crear();

    const tokenA = control.iniciar('A');
    control.resolver(tokenA, 'A', exito('ver-A'));
    expect(control.geometriaVigente()).toBe('A');

    control.iniciar('B');

    expect(control.resolver(tokenA, 'A', exito('ver-A'))).toBe(false);
    expect(control.geometriaVigente()).toBeNull();
  });

  it('limpiar después de un resultado exitoso quita la vigencia', () => {
    const { control, estados } = crear();

    const token = control.iniciar('A');
    control.resolver(token, 'A', exito('ver-A'));
    control.invalidar();

    expect(control.geometriaVigente()).toBeNull();
    expect(estados.at(-1)).toEqual({ fase: 'vacio' });
  });
});
