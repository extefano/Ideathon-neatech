import { describe, expect, it } from 'vitest';
import { conciliarCaravanas, parsePesadasCsv, resumenPesadas } from '@/lib/csv';

const rfid = (n: number) => `032${String(n).padStart(12, '0')}`;

describe('parsePesadasCsv', () => {
  it('parsea un archivo válido con encabezado', () => {
    const csv = ['caravana_rfid,peso_kg', `${rfid(1)},200`, `${rfid(2)},210.5`].join('\n');
    const { rows, errors } = parsePesadasCsv(csv);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { rfid: rfid(1), pesoKg: 200 },
      { rfid: rfid(2), pesoKg: 210.5 },
    ]);
  });

  it('rechaza duplicadas, caravanas inválidas y pesos fuera de rango', () => {
    const csv = [
      `${rfid(1)},200`,
      `${rfid(1)},201`,
      '123,200',
      `${rfid(3)},10`,
      `${rfid(4)},1500`,
    ].join('\n');
    const { rows, errors } = parsePesadasCsv(csv);

    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain('repetida');
    expect(errors[1]).toContain('inválida');
    expect(errors[2]).toContain('peso inválido');
  });

  it('falla si el archivo no tiene filas', () => {
    const { errors } = parsePesadasCsv('caravana_rfid,peso_kg\n');
    expect(errors[0]).toContain('no contiene filas');
  });

  it('acepta pesos con coma decimal y separador punto y coma', () => {
    const { rows } = parsePesadasCsv(`${rfid(7)};210,5`);
    expect(rows[0].pesoKg).toBe(210.5);
  });
});

describe('resumenPesadas', () => {
  it('calcula métricas y uniformidad parejo', () => {
    const rows = [200, 210, 220].map((pesoKg, i) => ({ rfid: rfid(i + 1), pesoKg }));
    const resumen = resumenPesadas(rows);

    expect(resumen.cantidad).toBe(3);
    expect(resumen.promedioKg).toBe(210);
    expect(resumen.minKg).toBe(200);
    expect(resumen.maxKg).toBe(220);
    expect(resumen.uniformidad).toBe('Parejo');
  });

  it('marca desparejo con CV alto', () => {
    const rows = [60, 300, 800].map((pesoKg, i) => ({ rfid: rfid(i + 1), pesoKg }));
    expect(resumenPesadas(rows).uniformidad).toBe('Desparejo');
  });

  it('tira error sin filas', () => {
    expect(() => resumenPesadas([])).toThrow();
  });
});

describe('conciliarCaravanas', () => {
  const padron = [rfid(1), rfid(2), rfid(3)];

  it('ok cuando coinciden exactamente', () => {
    expect(conciliarCaravanas(padron, [rfid(1), rfid(3), rfid(2)]).ok).toBe(true);
  });

  it('detecta faltantes y ajenas', () => {
    const r = conciliarCaravanas(padron, [rfid(1), rfid(2), rfid(9)]);
    expect(r.ok).toBe(false);
    expect(r.faltantes).toEqual([rfid(3)]);
    expect(r.ajenas).toEqual([rfid(9)]);
  });
});
