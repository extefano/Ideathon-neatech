import { createHash } from 'node:crypto';

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function rfidListHash(rows: { rfid: string; pesoKg: number }[]): string {
  const canonical = [...rows]
    .sort((a, b) => a.rfid.localeCompare(b.rfid))
    .map((r) => `${r.rfid}:${r.pesoKg}`)
    .join('\n');

  return sha256Hex(canonical);
}

export function eudrGeoHash(input: { poligono: unknown; gfw: unknown; checkedAt: string }): string {
  return sha256Hex(JSON.stringify(input));
}
