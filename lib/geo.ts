import { z } from 'zod';

const positionSchema = z.tuple([z.number(), z.number()]);
const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(positionSchema)),
});
const featureSchema = z.object({
  type: z.literal('Feature'),
  geometry: polygonSchema,
});

type Position = [number, number];

export type GeoValidation = { ok: boolean; errors: string[]; superficieHa: number };

const ARGENTINA_BOUNDS = { lngMin: -73.6, lngMax: -53.6, latMin: -55.1, latMax: -21.7 };

export function parseAndValidatePolygon(input: string): GeoValidation {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    return { ok: false, errors: ['El GeoJSON no es JSON válido'], superficieHa: 0 };
  }

  const feature = featureSchema.safeParse(parsed);
  const polygon = feature.success ? feature.data.geometry : polygonSchema.safeParse(parsed);

  if (!polygon || (typeof polygon === 'object' && 'success' in polygon && !polygon.success)) {
    return {
      ok: false,
      errors: ['Se espera un GeoJSON Polygon (o Feature con geometry Polygon)'],
      superficieHa: 0,
    };
  }

  const geometry = 'success' in polygon ? polygon.data : polygon;
  const ring = geometry.coordinates[0];

  if (!ring || ring.length < 4) {
    return {
      ok: false,
      errors: ['El anillo exterior necesita al menos 3 vértices (más el cierre)'],
      superficieHa: 0,
    };
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    errors.push('El polígono debe estar cerrado (primer y último punto iguales)');
  }

  const fuera = ring.some(
    ([lng, lat]) =>
      lng < ARGENTINA_BOUNDS.lngMin ||
      lng > ARGENTINA_BOUNDS.lngMax ||
      lat < ARGENTINA_BOUNDS.latMin ||
      lat > ARGENTINA_BOUNDS.latMax,
  );
  if (fuera) {
    errors.push('El polígono debe estar ubicado dentro del territorio argentino');
  }

  const superficieHa = round2(calcularSuperficieHa(ring));

  return { ok: errors.length === 0, errors, superficieHa };
}

export function calcularSuperficieHa(ring: Position[]): number {
  if (ring.length < 4) return 0;

  const latProm = ring.reduce((a, [, lat]) => a + lat, 0) / ring.length;
  const mPorGradoLat = 111_320;
  const mPorGradoLng = 111_320 * Math.cos((latProm * Math.PI) / 180);

  let dobleArea = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    dobleArea += x1 * mPorGradoLng * (y2 * mPorGradoLat) - x2 * mPorGradoLng * (y1 * mPorGradoLat);
  }

  return Math.abs(dobleArea / 2) / 10_000;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
