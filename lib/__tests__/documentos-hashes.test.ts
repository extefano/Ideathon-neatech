import { describe, expect, it } from 'vitest';
import { construirDocumentos } from '@/lib/documentos-hashes';

describe('construirDocumentos (#21)', () => {
  it('traduce las claves crudas a documentos comprensibles', () => {
    const documentos = construirDocumentos({
      renspaDocHash: 'a'.repeat(64),
      rfidListHash: 'b'.repeat(64),
      eudrGeoHash: 'c'.repeat(64),
      actaHash: 'd'.repeat(64),
      dteHash: 'e'.repeat(64),
    });

    const titulos = documentos.map((d) => d.titulo);
    expect(titulos).toContain('Constancia oficial RENSPA (SENASA)');
    expect(titulos).toContain('Padrón de caravanas electrónicas (RFID)');
    expect(titulos).toContain('Geolocalización del polígono (EUDR)');
    expect(titulos).toContain('Acta de auditoría veterinaria (Mes 4)');
    expect(titulos).toContain('DT-e de tránsito hacia faena');

    expect(titulos.some((t) => t.includes('_hash'))).toBe(false);
    for (const documento of documentos) {
      expect(documento.garantia.length).toBeGreaterThan(10);
      expect(documento.hash).not.toBeNull();
    }
  });

  it('explica el estado pendiente en lugar de un guion cuando falta el hash', () => {
    const documentos = construirDocumentos({
      renspaDocHash: null,
      rfidListHash: undefined,
      eudrGeoHash: '',
      actaHash: null,
      dteHash: null,
    });

    for (const documento of documentos) {
      expect(documento.hash).toBeNull();
      expect(documento.pendiente).toMatch(/Pendiente/);
    }
  });
});
