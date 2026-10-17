import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIAS,
  CERTIFICACIONES_COMERCIALES,
  MONEDAS,
  PESO_MAX_KG,
  PESO_MIN_KG,
  RAZAS,
  RENSPA_REGEX,
  RFID_REGEX,
  TIPOS_OPERACION,
  TIPOS_RODEO,
  UNIFORMIDADES,
  type CertificacionComercialLote,
  type Uniformidad,
} from '../../lib/domain';
import { eudrGeoHash, rfidListHash, sha256Hex } from '../../lib/crypto';
import { calcularSuperficieHa } from '../../lib/geo';

export type Moneda = (typeof MONEDAS)[number];

export const ESTADOS_GENERABLES = ['DISPONIBLE'] as const;
export type EstadoGenerable = (typeof ESTADOS_GENERABLES)[number];

export const MAX_LOTES = 500;
export const CABEZAS_MIN = 1;
export const CABEZAS_MAX = 5000;
export const SEED_MIN = 0;
export const SEED_MAX = 2_147_483_647;

export const FECHA_BASE_DEMO = '2026-10-16T05:00:00.000Z';
export const PREFIJO_CODIGO_DEMO = 'LOTE-DEMO-';
export const PREFIJO_WALLET_DEMO = 'GDEMO-LOTE-';
export const PREFIJO_TITULO_DEMO = '[DEMO]';
export const RENSPA_DOC_URL_DEMO = '/demo/renspa-demo.pdf';

export type ProvinciaDemo = {
  nombre: string;
  localidades: readonly string[];
  /** Centro aproximado del establecimiento: [lng, lat]. */
  centro: readonly [number, number];
};

export const PROVINCIAS_ARGENTINA: readonly ProvinciaDemo[] = [
  { nombre: 'Buenos Aires', localidades: ['Azul', 'Tandil', 'Olavarría'], centro: [-60.0, -36.0] },
  {
    nombre: 'Catamarca',
    localidades: ['Andalgalá', 'Belén', 'Santa Rosa'],
    centro: [-66.5, -28.0],
  },
  {
    nombre: 'Chaco',
    localidades: ['Resistencia', 'Villa Ángela', 'Presidencia Roque Sáenz Peña'],
    centro: [-60.5, -27.0],
  },
  { nombre: 'Chubut', localidades: ['Trelew', 'Esquel', 'Sarmiento'], centro: [-68.5, -43.5] },
  {
    nombre: 'Córdoba',
    localidades: ['Río Cuarto', 'Villa María', 'Jesús María'],
    centro: [-63.6, -32.5],
  },
  {
    nombre: 'Corrientes',
    localidades: ['Mercedes', 'Goya', 'Curuzú Cuatiá'],
    centro: [-57.8, -29.0],
  },
  {
    nombre: 'Entre Ríos',
    localidades: ['Paraná', 'Concordia', 'Gualeguaychú'],
    centro: [-59.5, -32.5],
  },
  { nombre: 'Formosa', localidades: ['Formosa', 'Clorinda', 'Pirané'], centro: [-59.5, -24.9] },
  {
    nombre: 'Jujuy',
    localidades: ['Perico', 'Libertador Gral. San Martín', 'Humahuaca'],
    centro: [-65.5, -23.5],
  },
  {
    nombre: 'La Pampa',
    localidades: ['Santa Rosa', 'General Pico', 'Realicó'],
    centro: [-65.5, -37.0],
  },
  {
    nombre: 'La Rioja',
    localidades: ['Chilecito', 'Chamical', 'Aimogasta'],
    centro: [-67.0, -29.5],
  },
  {
    nombre: 'Mendoza',
    localidades: ['San Rafael', 'General Alvear', 'Tunuyán'],
    centro: [-68.5, -34.5],
  },
  { nombre: 'Misiones', localidades: ['Oberá', 'Eldorado', 'Apóstoles'], centro: [-55.5, -27.0] },
  { nombre: 'Neuquén', localidades: ['Cutral Có', 'Zapala', 'Chos Malal'], centro: [-70.0, -38.5] },
  {
    nombre: 'Río Negro',
    localidades: ['General Roca', 'Viedma', 'Valcheta'],
    centro: [-66.5, -40.0],
  },
  {
    nombre: 'Salta',
    localidades: ['Rosario de la Frontera', 'Metán', 'Joaquín V. González'],
    centro: [-64.5, -24.5],
  },
  { nombre: 'San Juan', localidades: ['Caucete', 'San Martín', 'Jáchal'], centro: [-68.8, -31.0] },
  {
    nombre: 'San Luis',
    localidades: ['Villa Mercedes', 'Merlo', 'Quines'],
    centro: [-66.0, -33.5],
  },
  {
    nombre: 'Santa Cruz',
    localidades: ['Caleta Olivia', 'El Calafate', 'Las Heras'],
    centro: [-69.5, -49.0],
  },
  {
    nombre: 'Santa Fe',
    localidades: ['Venado Tuerto', 'Rafaela', 'Reconquista'],
    centro: [-61.0, -31.5],
  },
  {
    nombre: 'Santiago del Estero',
    localidades: ['Termas de Río Hondo', 'Añatuya', 'Frías'],
    centro: [-63.5, -28.0],
  },
  {
    nombre: 'Tierra del Fuego',
    localidades: ['Río Grande', 'Tolhuin', 'Ushuaia'],
    centro: [-68.0, -54.0],
  },
  {
    nombre: 'Tucumán',
    localidades: ['Concepción', 'Tafí Viejo', 'Monteros'],
    centro: [-65.5, -27.0],
  },
] as const;

export const PROVINCIAS_NOMBRES: readonly string[] = PROVINCIAS_ARGENTINA.map((p) => p.nombre);

const RANGO_PESO_POR_CATEGORIA: Record<string, readonly [number, number]> = {
  Terneros: [170, 240],
  Terneras: [160, 230],
  'Terneros y terneras': [165, 235],
  Novillitos: [210, 300],
  Novillos: [330, 450],
  Vaquillonas: [240, 320],
  Vacas: [350, 440],
  Toros: [600, 850],
};

const CRITERIO_GFW = 'umd_tree_cover_loss >= 2021 (corte reglamentario EUDR: 31/12/2020)';

export type GeoPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type GfwConsultaDemo = {
  totalLossHa: number;
  byYear: unknown[];
  checkedAt: string;
  criterio: string;
};

export type CaravanaDemo = {
  rfid: string;
  pesoInicialKg: number;
};

export type LoteDemo = {
  codigoLote: string;
  titulo: string;
  productorWallet: string;
  renspa: string;
  provincia: string;
  localidad: string;
  poligonoGeojson: GeoPolygon;
  superficieHa: number;
  cantidadCabezas: number;
  pesoPromedioKg: number;
  pesoMinKg: number;
  pesoMaxKg: number;
  uniformidad: Uniformidad;
  rfidListHash: string;
  tipoOperacion: string;
  categoria: string;
  raza: string;
  tipoRodeo: string;
  moneda: Moneda;
  montoTotalFinanciacion: number;
  pesoObjetivoKg: number;
  plazoMeses: number;
  fechaVigencia: string;
  precioPorCabeza: number;
  precioPorKg: number;
  descripcionOperacion: string;
  certificaciones: CertificacionComercialLote[];
  caravanas: CaravanaDemo[];
  gfwConsulta: GfwConsultaDemo;
  eudrGeoHash: string;
  renspaDocUrl: string;
  renspaDocHash: string;
  createdAt: string;
};

export type OpcionesGenerador = {
  count: number;
  seed: number;
  estado: EstadoGenerable;
  provincias: readonly string[];
  monedas: readonly Moneda[];
  minCabezas: number;
  maxCabezas: number;
  certificaciones: boolean;
};

export type Rng = () => number;

/** PRNG propio (mulberry32) sembrado: reproducible y sin dependencias. */
export function crearRng(seed: number): Rng {
  let estado = seed >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function enteroEntre(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function elegir<T>(rng: Rng, opciones: readonly T[]): T {
  return opciones[Math.floor(rng() * opciones.length)];
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pad(valor: number, largo: number): string {
  return String(valor).padStart(largo, '0');
}

export function opcionesPorDefecto(): OpcionesGenerador {
  return {
    count: 40,
    seed: 12345,
    estado: 'DISPONIBLE',
    provincias: PROVINCIAS_NOMBRES,
    monedas: [...MONEDAS],
    minCabezas: 20,
    maxCabezas: 80,
    certificaciones: false,
  };
}

export function validarOpciones(opts: OpcionesGenerador): OpcionesGenerador {
  if (!Number.isInteger(opts.count) || opts.count <= 0) {
    throw new Error(`--count debe ser un entero mayor a 0 (recibido: ${opts.count}).`);
  }
  if (opts.count > MAX_LOTES) {
    throw new Error(`--count no puede superar ${MAX_LOTES} (recibido: ${opts.count}).`);
  }
  if (!Number.isInteger(opts.seed) || opts.seed < SEED_MIN || opts.seed > SEED_MAX) {
    throw new Error(
      `--seed debe ser un entero entre ${SEED_MIN} y ${SEED_MAX} (recibido: ${opts.seed}).`,
    );
  }
  if (!(ESTADOS_GENERABLES as readonly string[]).includes(opts.estado)) {
    throw new Error(
      `--estado inválido: "${opts.estado}". Este generador solo produce lotes DISPONIBLE.`,
    );
  }

  const provincias = [...new Set(opts.provincias)];
  if (provincias.length === 0) {
    throw new Error('--provincias no puede quedar vacío.');
  }
  for (const provincia of provincias) {
    if (!PROVINCIAS_NOMBRES.includes(provincia)) {
      throw new Error(`Provincia inválida: "${provincia}".`);
    }
  }

  const monedas = [...new Set(opts.monedas)];
  if (monedas.length === 0) {
    throw new Error('--monedas no puede quedar vacío.');
  }
  for (const moneda of monedas) {
    if (!(MONEDAS as readonly string[]).includes(moneda)) {
      throw new Error(`Moneda inválida: "${moneda}". Valores válidos: ${MONEDAS.join(', ')}.`);
    }
  }

  if (!Number.isInteger(opts.minCabezas) || !Number.isInteger(opts.maxCabezas)) {
    throw new Error('--min-cabezas y --max-cabezas deben ser enteros.');
  }
  if (opts.minCabezas < CABEZAS_MIN || opts.maxCabezas > CABEZAS_MAX) {
    throw new Error(
      `Las cabezas deben estar entre ${CABEZAS_MIN} y ${CABEZAS_MAX} (recibido: ${opts.minCabezas}-${opts.maxCabezas}).`,
    );
  }
  if (opts.minCabezas > opts.maxCabezas) {
    throw new Error(
      `--min-cabezas (${opts.minCabezas}) no puede ser mayor que --max-cabezas (${opts.maxCabezas}).`,
    );
  }

  return { ...opts, provincias, monedas };
}

let hashRenspaDemoCache: string | null = null;

function hashRenspaDemo(): string {
  if (hashRenspaDemoCache) return hashRenspaDemoCache;
  const ruta = fileURLToPath(new URL('../../public/demo/renspa-demo.pdf', import.meta.url));
  hashRenspaDemoCache = sha256Hex(readFileSync(ruta));
  return hashRenspaDemoCache;
}

function poligonoRect(centro: readonly [number, number], delta: number): GeoPolygon {
  const [lng, lat] = centro;
  const mitad = delta / 2;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [redondear2(lng - mitad), redondear2(lat - mitad)],
        [redondear2(lng + mitad), redondear2(lat - mitad)],
        [redondear2(lng + mitad), redondear2(lat + mitad)],
        [redondear2(lng - mitad), redondear2(lat + mitad)],
        [redondear2(lng - mitad), redondear2(lat - mitad)],
      ],
    ],
  };
}

function construirRenspa(indiceLote: number, indiceProvincia: number): string {
  const codigoProvincia = pad(indiceProvincia + 1, 2);
  const renspa = `${codigoProvincia}.${pad((indiceLote * 37 + 101) % 1000, 3)}.${
    (indiceLote + 3) % 10
  }.${pad(((indiceLote + 1) * 137) % 100000, 5)}/${pad((indiceLote + 7) % 100, 2)}`;
  if (!RENSPA_REGEX.test(renspa)) {
    throw new Error(`RENSPA generado inválido: ${renspa}`);
  }
  return renspa;
}

function construirRfid(secuencia: number): string {
  const rfid = `032${pad(secuencia, 12)}`;
  if (!RFID_REGEX.test(rfid)) {
    throw new Error(`RFID generado inválido: ${rfid}`);
  }
  return rfid;
}

function certificacionesDemo(createdAt: string): CertificacionComercialLote[] {
  const fecha = createdAt.slice(0, 10);
  return CERTIFICACIONES_COMERCIALES.map((def) => ({
    codigo: def.codigo,
    nombre: def.nombre,
    norma: def.norma,
    emisor: def.emisorDefault,
    fecha_emision: fecha,
    observaciones: `${PREFIJO_TITULO_DEMO} ${def.observacionesDefault}`,
    doc_url: def.demoPdfUrl,
    doc_hash: def.demoPdfHash,
  }));
}

function construirLote(
  opts: OpcionesGenerador,
  rng: Rng,
  indice: number,
  secuenciaRfidGlobal: { valor: number },
): LoteDemo {
  const provincia = elegir(rng, opts.provincias);
  const indiceProvincia = PROVINCIAS_NOMBRES.indexOf(provincia);
  const definicionProvincia = PROVINCIAS_ARGENTINA[indiceProvincia];
  const localidad = elegir(rng, definicionProvincia.localidades);

  const categoria = elegir(rng, CATEGORIAS);
  const raza = elegir(rng, RAZAS);
  const tipoOperacion = elegir(rng, TIPOS_OPERACION);
  const tipoRodeo = elegir(rng, TIPOS_RODEO);
  const uniformidad = elegir(rng, UNIFORMIDADES);
  const moneda = elegir(rng, opts.monedas);

  const cantidadCabezas = enteroEntre(rng, opts.minCabezas, opts.maxCabezas);
  const [pesoBaseMin, pesoBaseMax] = RANGO_PESO_POR_CATEGORIA[categoria] ?? [PESO_MIN_KG, 400];
  const pesoPromedioKg = enteroEntre(rng, pesoBaseMin, pesoBaseMax);
  const dispersion = enteroEntre(rng, 3, 14);
  const pesoMinKg = Math.max(PESO_MIN_KG, pesoPromedioKg - dispersion);
  const pesoMaxKg = Math.min(PESO_MAX_KG, pesoPromedioKg + dispersion);

  const pesoObjetivoKg = Math.min(900, pesoPromedioKg + enteroEntre(rng, 120, 220));
  const precioPorKg = redondear2(1 + rng() * 0.9);
  const precioPorCabeza = redondear2(precioPorKg * pesoObjetivoKg);
  const montoTotalFinanciacion = Math.round(precioPorCabeza * cantidadCabezas);
  const plazoMeses = enteroEntre(rng, 3, 12);

  const createdAt = new Date(Date.parse(FECHA_BASE_DEMO) + indice * 60_000).toISOString();
  const fechaVigencia = new Date(
    Date.parse(FECHA_BASE_DEMO) + plazoMeses * 30 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const codigoLote = `${PREFIJO_CODIGO_DEMO}${pad(indice + 1, 4)}`;
  const productorWallet = `${PREFIJO_WALLET_DEMO}${pad(indice + 1, 2)}`;
  const titulo = `${PREFIJO_TITULO_DEMO} ${cantidadCabezas} ${categoria} ${raza} - ${pesoPromedioKg} kg`;

  const poligonoGeojson = poligonoRect(definicionProvincia.centro, 0.05);
  const superficieHa = redondear2(
    calcularSuperficieHa(poligonoGeojson.coordinates[0] as [number, number][]),
  );

  const caravanas: CaravanaDemo[] = [];
  for (let c = 0; c < cantidadCabezas; c += 1) {
    secuenciaRfidGlobal.valor += 1;
    const rangoPeso = pesoMaxKg - pesoMinKg + 1;
    const pesoInicialKg = pesoMinKg + (c % rangoPeso);
    caravanas.push({
      rfid: construirRfid(secuenciaRfidGlobal.valor),
      pesoInicialKg,
    });
  }

  const gfwConsulta: GfwConsultaDemo = {
    totalLossHa: 0,
    byYear: [],
    checkedAt: createdAt,
    criterio: CRITERIO_GFW,
  };

  return {
    codigoLote,
    titulo,
    productorWallet,
    renspa: construirRenspa(indice, indiceProvincia),
    provincia,
    localidad,
    poligonoGeojson,
    superficieHa,
    cantidadCabezas,
    pesoPromedioKg,
    pesoMinKg,
    pesoMaxKg,
    uniformidad,
    rfidListHash: rfidListHash(caravanas.map((c) => ({ rfid: c.rfid, pesoKg: c.pesoInicialKg }))),
    tipoOperacion,
    categoria,
    raza,
    tipoRodeo,
    moneda,
    montoTotalFinanciacion,
    pesoObjetivoKg,
    plazoMeses,
    fechaVigencia,
    precioPorCabeza,
    precioPorKg,
    descripcionOperacion: `Lote demo de ${cantidadCabezas} ${categoria} ${raza} a ${tipoOperacion.toLowerCase()} en ${localidad}, ${provincia}.`,
    certificaciones: opts.certificaciones ? certificacionesDemo(createdAt) : [],
    caravanas,
    gfwConsulta,
    eudrGeoHash: eudrGeoHash({ poligono: poligonoGeojson, gfw: gfwConsulta, checkedAt: createdAt }),
    renspaDocUrl: RENSPA_DOC_URL_DEMO,
    renspaDocHash: hashRenspaDemo(),
    createdAt,
  };
}

export function generarLotes(opts: OpcionesGenerador): LoteDemo[] {
  const opciones = validarOpciones(opts);
  const rng = crearRng(opciones.seed);
  const secuenciaRfidGlobal = { valor: (opciones.seed % 900_000) * 1000 };
  const lotes: LoteDemo[] = [];
  for (let i = 0; i < opciones.count; i += 1) {
    lotes.push(construirLote(opciones, rng, i, secuenciaRfidGlobal));
  }
  return lotes;
}
