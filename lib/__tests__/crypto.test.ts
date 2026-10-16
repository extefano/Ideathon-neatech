import { describe, expect, it } from 'vitest';
import { rfidListHash, sha256Hex } from '@/lib/crypto';

describe('sha256Hex', () => {
  it('coincide con el vector conocido de "abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('acepta buffers', () => {
    expect(sha256Hex(Buffer.from('abc'))).toBe(sha256Hex('abc'));
  });
});

describe('rfidListHash', () => {
  const rows = [
    { rfid: '032000000001', pesoKg: 200 },
    { rfid: '032000000002', pesoKg: 210 },
  ];

  it('es independiente del orden de las filas', () => {
    expect(rfidListHash(rows)).toBe(rfidListHash([...rows].reverse()));
  });

  it('cambia si cambia un peso', () => {
    const alterado = [{ rfid: '032000000001', pesoKg: 201 }, rows[1]];
    expect(rfidListHash(rows)).not.toBe(rfidListHash(alterado));
  });
});
