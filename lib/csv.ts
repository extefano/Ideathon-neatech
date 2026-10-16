import { PESO_MAX_KG, PESO_MIN_KG, RFID_REGEX, type Uniformidad } from '@/lib/domain';

export type PesadaRow = { rfid: string; pesoKg: number };

export type PesadasResumen = {
  cantidad: number;
  promedioKg: number;
  minKg: number;
  maxKg: number;
  cv: number;
  uniformidad: Uniformidad;
};

export type PesadasParseResult = { rows: PesadaRow[]; errors: string[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parsePesadasCsv(input: string): PesadasParseResult {
  const errors: string[] = [];
  const rows: PesadaRow[] = [];
  const seen = new Set<string>();
  const lines = input.split(/\r?\n/);

  let start = 0;
  const firstLine = lines[0] ?? '';
  if (/caravana|rfid/i.test(firstLine)) start = 1;

  for (let i = start; i < lines.length; i++) {
    const raw = (lines[i] ?? '').trim();
    if (raw === '') continue;
    const lineNo = i + 1;

    const delimiter = raw.includes(';') ? ';' : ',';
    const parts = raw.split(delimiter).map((p) => p.trim());
    if (parts.length !== 2) {
      errors.push(`Línea ${lineNo}: formato inválido (se espera caravana_rfid,peso_kg)`);
      continue;
    }

    const rfid = parts[0];
    const pesoRaw = parts[1];
    if (!RFID_REGEX.test(rfid)) {
      errors.push(
        `Línea ${lineNo}: caravana inválida "${rfid}" (15 dígitos numéricos, prefijo 032)`,
      );
      continue;
    }

    const pesoKg = Number(pesoRaw.replace(',', '.'));
    if (!Number.isFinite(pesoKg) || pesoKg < PESO_MIN_KG || pesoKg > PESO_MAX_KG) {
      errors.push(
        `Línea ${lineNo}: peso inválido "${pesoRaw}" (rango ${PESO_MIN_KG}-${PESO_MAX_KG} kg)`,
      );
      continue;
    }

    if (seen.has(rfid)) {
      errors.push(`Línea ${lineNo}: caravana repetida "${rfid}"`);
      continue;
    }

    seen.add(rfid);
    rows.push({ rfid, pesoKg });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('El archivo no contiene filas de pesadas');
  }

  return { rows, errors };
}

export function resumenPesadas(rows: PesadaRow[]): PesadasResumen {
  if (rows.length === 0) {
    throw new Error('No hay pesadas para resumir');
  }

  const pesos = rows.map((r) => r.pesoKg);
  const cantidad = pesos.length;
  const promedioKg = pesos.reduce((a, b) => a + b, 0) / cantidad;
  const varianza = pesos.reduce((a, p) => a + (p - promedioKg) ** 2, 0) / cantidad;
  const cv = Math.sqrt(varianza) / promedioKg;

  const uniformidad: Uniformidad =
    cv < 0.1 ? 'Parejo' : cv <= 0.2 ? 'Bastante parejo' : 'Desparejo';

  return {
    cantidad,
    promedioKg: round2(promedioKg),
    minKg: Math.min(...pesos),
    maxKg: Math.max(...pesos),
    cv: Math.round(cv * 10000) / 10000,
    uniformidad,
  };
}

export function conciliarCaravanas(
  padronInicial: string[],
  rfidsNuevos: string[],
): { ok: boolean; faltantes: string[]; ajenas: string[] } {
  const inicial = new Set(padronInicial);
  const nuevos = new Set(rfidsNuevos);
  const faltantes = padronInicial.filter((rfid) => !nuevos.has(rfid));
  const ajenas = rfidsNuevos.filter((rfid) => !inicial.has(rfid));

  return { ok: faltantes.length === 0 && ajenas.length === 0, faltantes, ajenas };
}
