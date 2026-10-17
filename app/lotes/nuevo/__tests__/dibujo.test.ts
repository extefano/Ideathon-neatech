import { describe, expect, it } from 'vitest';
import {
  ESTADO_DIBUJO_INICIAL,
  activarDibujo,
  agregarPunto,
  cancelarDibujo,
  deshacerPunto,
  guardarDibujo,
  poligonoDesdePuntos,
  poligonoTieneAgujeros,
  puntosDesdePoligono,
  puntosVisibles,
  puedeGuardar,
  type Punto,
} from '@/app/lotes/nuevo/dibujo';

const a: Punto = [-29.1, -58.1];
const b: Punto = [-29.2, -58.2];
const c: Punto = [-29.3, -58.3];

describe('modo dibujo', () => {
  it('arranca inactivo y sin borrador', () => {
    expect(ESTADO_DIBUJO_INICIAL).toEqual({ activo: false, borrador: [] });
  });

  it('activar arranca el borrador vacío si no hay polígono guardado', () => {
    const estado = activarDibujo([]);

    expect(estado.activo).toBe(true);
    expect(estado.borrador).toEqual([]);
  });

  it('activar continúa desde el polígono guardado sin mutarlo', () => {
    const guardados: Punto[] = [a, b];

    const estado = activarDibujo(guardados);

    expect(estado.borrador).toEqual([a, b]);
    expect(estado.borrador).not.toBe(guardados);
  });

  it('agregar suma vértices solo en modo dibujo', () => {
    const activo = agregarPunto(activarDibujo([]), a);

    expect(activo.borrador).toEqual([a]);

    const inactivo = agregarPunto(ESTADO_DIBUJO_INICIAL, a);

    expect(inactivo).toBe(ESTADO_DIBUJO_INICIAL);
    expect(inactivo.borrador).toEqual([]);
  });

  it('deshacer quita el último vértice y no hace nada si no hay nada que deshacer', () => {
    let estado = agregarPunto(agregarPunto(activarDibujo([]), a), b);

    estado = deshacerPunto(estado);

    expect(estado.borrador).toEqual([a]);

    const vacio = deshacerPunto(estado);

    expect(vacio.borrador).toEqual([]);
    expect(deshacerPunto(vacio)).toBe(vacio);

    const inactivo = deshacerPunto(ESTADO_DIBUJO_INICIAL);
    expect(inactivo).toBe(ESTADO_DIBUJO_INICIAL);
  });

  it('guardar con menos de 3 vértices no cierra el polígono ni sale del modo', () => {
    const estado = agregarPunto(agregarPunto(activarDibujo([]), a), b);

    expect(puedeGuardar(estado)).toBe(false);
    expect(guardarDibujo(estado)).toEqual({ estado, poligono: null });
    expect(guardarDibujo(ESTADO_DIBUJO_INICIAL)).toEqual({
      estado: ESTADO_DIBUJO_INICIAL,
      poligono: null,
    });
  });

  it('guardar con 3 o más vértices fija el anillo cerrado y sale del modo', () => {
    const estado = agregarPunto(agregarPunto(agregarPunto(activarDibujo([]), a), b), c);

    expect(puedeGuardar(estado)).toBe(true);

    const resultado = guardarDibujo(estado);

    expect(resultado.estado).toEqual(ESTADO_DIBUJO_INICIAL);
    expect(resultado.poligono).not.toBeNull();

    const geojson = JSON.parse(resultado.poligono as string) as {
      type: string;
      coordinates: number[][][];
    };
    const anillo = geojson.coordinates[0];

    expect(geojson.type).toBe('Polygon');
    expect(anillo[0]).toEqual([a[1], a[0]]);
    expect(anillo).toEqual([
      [a[1], a[0]],
      [b[1], b[0]],
      [c[1], c[0]],
      [a[1], a[0]],
    ]);
  });

  it('cancelar descarta el borrador y sale del modo', () => {
    const estado = agregarPunto(activarDibujo([a]), b);

    expect(cancelarDibujo()).toEqual(ESTADO_DIBUJO_INICIAL);
    expect(estado.borrador).toEqual([a, b]);
  });

  it('puntosVisibles muestra el borrador en modo dibujo y el guardado fuera', () => {
    const guardados: Punto[] = [a, b, c];
    const enModo = agregarPunto(activarDibujo([a]), b);

    expect(puntosVisibles(enModo, guardados)).toEqual([a, b]);
    expect(puntosVisibles(ESTADO_DIBUJO_INICIAL, guardados)).toEqual(guardados);
  });

  it('poligonoDesdePuntos y puntosDesdePoligono hacen round-trip lat/lng', () => {
    const puntos: Punto[] = [a, b, c];

    expect(puntosDesdePoligono(poligonoDesdePuntos(puntos))).toEqual(puntos);
    expect(puntosDesdePoligono('')).toEqual([]);
    expect(puntosDesdePoligono('no-json')).toEqual([]);
  });
});

const anilloExterior = [
  [-58.1, -29.5],
  [-58.0, -29.5],
  [-58.0, -29.4],
  [-58.1, -29.4],
  [-58.1, -29.5],
];

const anilloInterior = [
  [-58.08, -29.47],
  [-58.04, -29.47],
  [-58.04, -29.45],
  [-58.08, -29.45],
  [-58.08, -29.47],
];

describe('poligonoTieneAgujeros', () => {
  it('detecta un Polygon con anillo interior', () => {
    const conAgujero = { type: 'Polygon', coordinates: [anilloExterior, anilloInterior] };

    expect(poligonoTieneAgujeros(JSON.stringify(conAgujero))).toBe(true);
  });

  it('un Polygon simple (solo anillo exterior) no tiene agujeros', () => {
    const simple = { type: 'Polygon', coordinates: [anilloExterior] };

    expect(poligonoTieneAgujeros(JSON.stringify(simple))).toBe(false);
  });

  it('detecta agujeros también dentro de un Feature', () => {
    const conAgujero = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [anilloExterior, anilloInterior] },
    };
    const simple = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [anilloExterior] },
    };

    expect(poligonoTieneAgujeros(JSON.stringify(conAgujero))).toBe(true);
    expect(poligonoTieneAgujeros(JSON.stringify(simple))).toBe(false);
  });

  it('es conservador con textos vacíos, inválidos o que no son polígonos', () => {
    expect(poligonoTieneAgujeros('')).toBe(false);
    expect(poligonoTieneAgujeros('no-json')).toBe(false);
    expect(poligonoTieneAgujeros('{"type":"Point","coordinates":[0,0]}')).toBe(false);
  });
});
