import { describe, expect, it } from 'vitest';
import { MONEDAS, RENSPA_REGEX, RFID_REGEX } from '../../lib/domain';
import {
  CABEZAS_MAX,
  MAX_LOTES,
  PREFIJO_CODIGO_DEMO,
  PREFIJO_TITULO_DEMO,
  PREFIJO_WALLET_DEMO,
  PROVINCIAS_NOMBRES,
  generarLotes,
  opcionesPorDefecto,
  type OpcionesGenerador,
} from '../lib/generar-lotes';

function opciones(parciales: Partial<OpcionesGenerador> = {}): OpcionesGenerador {
  return { ...opcionesPorDefecto(), ...parciales };
}

describe('Generador de lotes demo (#45)', () => {
  it('genera exactamente la cantidad pedida con códigos y wallets deterministas', () => {
    const lotes = generarLotes(opciones({ count: 10, seed: 12345 }));
    expect(lotes).toHaveLength(10);
    expect(lotes.map((l) => l.codigoLote)).toEqual([
      'LOTE-DEMO-0001',
      'LOTE-DEMO-0002',
      'LOTE-DEMO-0003',
      'LOTE-DEMO-0004',
      'LOTE-DEMO-0005',
      'LOTE-DEMO-0006',
      'LOTE-DEMO-0007',
      'LOTE-DEMO-0008',
      'LOTE-DEMO-0009',
      'LOTE-DEMO-0010',
    ]);
    for (const lote of lotes) {
      expect(lote.codigoLote.startsWith(PREFIJO_CODIGO_DEMO)).toBe(true);
      expect(lote.productorWallet.startsWith(PREFIJO_WALLET_DEMO)).toBe(true);
      expect(lote.titulo.startsWith(PREFIJO_TITULO_DEMO)).toBe(true);
    }
  });

  it('es reproducible: misma semilla → salida idéntica', () => {
    const a = generarLotes(opciones({ count: 12, seed: 987654, certificaciones: true }));
    const b = generarLotes(opciones({ count: 12, seed: 987654, certificaciones: true }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('semillas distintas producen lotes distintos', () => {
    const a = generarLotes(opciones({ count: 5, seed: 1 }));
    const b = generarLotes(opciones({ count: 5, seed: 2 }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('cumple las reglas de negocio DISPONIBLE y los formatos verificables', () => {
    const lotes = generarLotes(opciones({ count: 30, seed: 4242, certificaciones: true }));
    const rfids = new Set<string>();

    for (const lote of lotes) {
      expect(RENSPA_REGEX.test(lote.renspa)).toBe(true);
      expect(MONEDAS).toContain(lote.moneda);
      expect(lote.cantidadCabezas).toBeGreaterThanOrEqual(20);
      expect(lote.cantidadCabezas).toBeLessThanOrEqual(80);
      expect(lote.pesoMinKg).toBeGreaterThanOrEqual(50);
      expect(lote.pesoMaxKg).toBeLessThanOrEqual(1200);
      expect(lote.pesoMinKg).toBeLessThanOrEqual(lote.pesoPromedioKg);
      expect(lote.pesoPromedioKg).toBeLessThanOrEqual(lote.pesoMaxKg);
      expect(lote.pesoObjetivoKg).toBeGreaterThanOrEqual(100);
      expect(lote.pesoObjetivoKg).toBeLessThanOrEqual(900);
      expect(lote.rfidListHash).toMatch(/^[0-9a-f]{64}$/);
      expect(lote.eudrGeoHash).toMatch(/^[0-9a-f]{64}$/);
      expect(lote.renspaDocHash).toMatch(/^[0-9a-f]{64}$/);
      expect(lote.gfwConsulta.totalLossHa).toBe(0);
      expect(lote.caravanas).toHaveLength(lote.cantidadCabezas);

      // Solo DISPONIBLE, con las certificaciones Eje 2 marcadas como demo.
      expect(lote.certificaciones).toHaveLength(3);
      for (const cert of lote.certificaciones) {
        expect(cert.observaciones?.startsWith(PREFIJO_TITULO_DEMO)).toBe(true);
        expect(cert.doc_url?.startsWith('/demo/')).toBe(true);
        expect(cert.doc_hash).toMatch(/^[0-9a-f]{64}$/);
      }

      for (const caravana of lote.caravanas) {
        expect(RFID_REGEX.test(caravana.rfid)).toBe(true);
        expect(rfids.has(caravana.rfid)).toBe(false);
        rfids.add(caravana.rfid);
      }
    }
  });

  it('sin --certificaciones no adjunta certificaciones', () => {
    const lotes = generarLotes(opciones({ count: 3, seed: 7 }));
    for (const lote of lotes) {
      expect(lote.certificaciones).toEqual([]);
    }
  });

  it('respeta provincias y monedas seleccionadas', () => {
    const lotes = generarLotes(
      opciones({ count: 20, seed: 99, provincias: ['Santa Fe'], monedas: ['USDC'] }),
    );
    for (const lote of lotes) {
      expect(lote.provincia).toBe('Santa Fe');
      expect(lote.moneda).toBe('USDC');
    }
  });

  it('falla con datos inválidos antes de emitir SQL', () => {
    expect(() => generarLotes(opciones({ count: 0 }))).toThrow(/--count/);
    expect(() => generarLotes(opciones({ count: -3 }))).toThrow(/--count/);
    expect(() => generarLotes(opciones({ count: MAX_LOTES + 1 }))).toThrow(/--count/);
    expect(() => generarLotes(opciones({ count: 1.5 }))).toThrow(/--count/);
    expect(() => generarLotes(opciones({ seed: -1 }))).toThrow(/--seed/);
    expect(() => generarLotes(opciones({ seed: 1.2 }))).toThrow(/--seed/);
    expect(() =>
      generarLotes(opciones({ estado: 'CERRADO_CICLO' as OpcionesGenerador['estado'] })),
    ).toThrow(/--estado/);
    expect(() => generarLotes(opciones({ provincias: ['Camelot'] }))).toThrow(/Provincia inválida/);
    expect(() => generarLotes(opciones({ provincias: [] }))).toThrow(/--provincias/);
    expect(() =>
      generarLotes(opciones({ monedas: ['BTC' as OpcionesGenerador['monedas'][number]] })),
    ).toThrow(/Moneda inválida/);
    expect(() => generarLotes(opciones({ minCabezas: 100, maxCabezas: 10 }))).toThrow(
      /--min-cabezas/,
    );
    expect(() => generarLotes(opciones({ minCabezas: 0 }))).toThrow(/cabezas/);
    expect(() => generarLotes(opciones({ maxCabezas: CABEZAS_MAX + 1 }))).toThrow(/cabezas/);
  });

  it('expone el catálogo de las 23 provincias argentinas', () => {
    expect(PROVINCIAS_NOMBRES).toHaveLength(23);
    expect(PROVINCIAS_NOMBRES).toContain('Tucumán');
    expect(PROVINCIAS_NOMBRES).toContain('Tierra del Fuego');
  });
});
