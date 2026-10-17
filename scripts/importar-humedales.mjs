#!/usr/bin/env node
/**
 * Importación reproducible de capas de humedales (GeoJSON FeatureCollection).
 *
 * Uso:
 *   node scripts/importar-humedales.mjs \
 *     --archivo ruta/humedales.geojson \
 *     --proveedor INH --dataset inh-nivel4 --version 2024 \
 *     [--cobertura ruta/cobertura.geojson] [--fecha-datos 2024-06-30] \
 *     [--clases humedal,laguna] [--escala 1:250000] [--url ...] \
 *     [--licencia ...] [--atribucion ...] [--chunk 250] [--principal] [--demo] \
 *     [--publicar] [--permitir-vacio]
 *
 * Lee `.env.local` (o el entorno) para SUPABASE_URL / SUPABASE_SECRET_KEY y
 * llama a la RPC `importar_capas_humedales`. Una versión publicada es inmutable:
 * para reimportar hay que subir la versión.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const token = argv[i];
  if (token.startsWith('--')) {
    const nombre = token.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente && !siguiente.startsWith('--')) {
      args.set(nombre, siguiente);
      i++;
    } else {
      args.set(nombre, 'true');
    }
  }
}

function requerido(nombre) {
  const valor = args.get(nombre);
  if (!valor) throw new Error(`Falta --${nombre}`);
  return valor;
}

function leerEnvLocal() {
  const env = { ...process.env };
  try {
    const texto = readFileSync('.env.local', 'utf8');
    for (const linea of texto.split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) continue;
      const idx = limpia.indexOf('=');
      if (idx === -1) continue;
      const clave = limpia.slice(0, idx).trim();
      let valor = limpia.slice(idx + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }
      if (!(clave in env) || !env[clave]) env[clave] = valor;
    }
  } catch {
    // sin .env.local: se usa el entorno tal cual
  }
  return env;
}

function leerChunk() {
  const crudo = args.get('chunk') ?? '250';
  if (!/^[0-9]+$/.test(crudo)) {
    throw new Error('--chunk debe ser un entero entre 1 y 1000');
  }
  const chunk = Number(crudo);
  if (!Number.isInteger(chunk) || chunk < 1 || chunk > 1000) {
    throw new Error('--chunk debe ser un entero entre 1 y 1000');
  }
  return chunk;
}

async function main() {
  const CHUNK = leerChunk();
  const permitirVacio = args.get('permitir-vacio') === 'true';
  const env = leerEnvLocal();
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY (revisá .env.local)');
  }

  const archivo = requerido('archivo');
  const bytes = readFileSync(archivo);
  const coleccion = JSON.parse(bytes.toString('utf8'));
  if (coleccion?.type !== 'FeatureCollection' || !Array.isArray(coleccion.features)) {
    throw new Error('El archivo debe ser un GeoJSON FeatureCollection');
  }

  let coberturaGeojson = null;
  if (args.get('cobertura')) {
    const cob = JSON.parse(readFileSync(args.get('cobertura'), 'utf8'));
    coberturaGeojson = cob?.type === 'Feature' ? cob.geometry : cob;
    if (!coberturaGeojson?.type) throw new Error('La cobertura no es un GeoJSON válido');
  }

  const publicar = args.get('publicar') === 'true';
  if (publicar && !coberturaGeojson) {
    throw new Error('Para --publicar hace falta --cobertura (geometría observada de la fuente)');
  }

  const fuente = {
    proveedor: requerido('proveedor'),
    dataset: requerido('dataset'),
    version: requerido('version'),
    fechaDatos: args.get('fecha-datos') ?? null,
    clases: (args.get('clases') ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    escala: args.get('escala') ?? null,
    url: args.get('url') ?? null,
    licencia: args.get('licencia') ?? null,
    atribucion: args.get('atribucion') ?? null,
    checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    esPrincipal: args.get('principal') === 'true',
    esDemo: args.get('demo') === 'true',
    coberturaGeojson,
  };

  const features = coleccion.features.map((feature, indice) => ({
    featureRef: String(feature?.id ?? feature?.properties?.id ?? `f${indice + 1}`),
    clase: feature?.properties?.clase ?? feature?.properties?.class ?? null,
    geometry: feature?.geometry ?? null,
  }));

  if (features.some((f) => !f.geometry)) {
    throw new Error('Todas las features necesitan geometry');
  }

  if (features.length === 0 && !permitirVacio) {
    throw new Error(
      'El archivo no contiene features; usá --permitir-vacio si la capa vacía es intencional',
    );
  }

  let importadas = 0;
  for (let i = 0; i < features.length; i += CHUNK) {
    const lote = features.slice(i, i + CHUNK);
    const res = await fetch(`${url}/rest/v1/rpc/importar_capas_humedales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_fuente: fuente,
        p_capas: lote,
        p_publicar: false,
        p_reemplazar_capas: i === 0,
      }),
    });
    if (!res.ok) {
      throw new Error(`Error importando chunk ${i / CHUNK + 1}: ${res.status} ${await res.text()}`);
    }
    importadas += lote.length;
    console.info(`  chunk ${i / CHUNK + 1}: ${lote.length} features (acumulado ${importadas})`);
  }

  if (publicar) {
    const res = await fetch(`${url}/rest/v1/rpc/importar_capas_humedales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_fuente: fuente,
        p_capas: [],
        p_publicar: true,
        // Publicar un dataset legítimamente vacío debe limpiar capas residuales
        // de una importación pendiente previa; con features>0 ya se reemplazaron.
        p_reemplazar_capas: features.length === 0,
      }),
    });
    if (!res.ok) {
      throw new Error(`Error publicando la versión: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const totales = Number(data?.featuresTotales);
    if (totales !== features.length) {
      throw new Error(
        `Publicación inconsistente: la base informa ${totales} features y el archivo tiene ${features.length}`,
      );
    }
    console.info('Versión publicada:', data);
  }

  console.info(
    `Listo: ${importadas} features de ${fuente.proveedor}/${fuente.dataset} v${fuente.version}` +
      (publicar ? ' (publicada)' : ' (pendiente)'),
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
