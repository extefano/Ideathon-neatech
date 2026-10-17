import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@/lib/crypto';
import {
  CERTIFICACIONES_COMERCIALES,
  CODIGOS_CERTIFICACION_COMERCIAL,
  contarLotesPorCertificacion,
  esCodigoCertificacionComercial,
  filtrarLotesPorCertificacion,
  normalizarCertificacionesComerciales,
  obtenerDefinicionCertificacion,
} from '@/lib/domain';

describe('Catálogo de Certificaciones Comerciales Voluntarias (Eje 2 · #42)', () => {
  it('define las 3 certificaciones canónicas con Sinergia Medio Ambiente obligatoria', () => {
    expect(CODIGOS_CERTIFICACION_COMERCIAL).toEqual([
      'HUELLA_CARBONO_SINERGIA',
      'BIENESTAR_ANIMAL',
      'LIBRE_ANTIBIOTICOS_HORMONAS',
    ]);
    expect(CERTIFICACIONES_COMERCIALES).toHaveLength(3);

    const sinergia = obtenerDefinicionCertificacion('HUELLA_CARBONO_SINERGIA');
    expect(sinergia.nombre).toContain('Sinergia Medio Ambiente');
    expect(sinergia.norma).toContain('ISO 14064');
    expect(sinergia.norma).toContain('ISO 14067');
    expect(sinergia.rolTecnico).toMatch(/inventario biológico GEI/i);
    expect(sinergia.rolTecnico).toMatch(/No sustituye el control aduanero EUDR/i);
  });

  it('los PDFs demo existen en public/demo y coinciden con su hash SHA-256 canónico', () => {
    for (const def of CERTIFICACIONES_COMERCIALES) {
      const rutaRelativa = def.demoPdfUrl.replace(/^\//, '');
      const contenido = readFileSync(join(process.cwd(), 'public', rutaRelativa));
      expect(sha256Hex(contenido)).toBe(def.demoPdfHash);
    }
  });

  it('valida códigos canónicos y normaliza arreglos JSONB de la base de datos', () => {
    expect(esCodigoCertificacionComercial('HUELLA_CARBONO_SINERGIA')).toBe(true);
    expect(esCodigoCertificacionComercial('OTRA_CERT')).toBe(false);
    expect(normalizarCertificacionesComerciales(null)).toEqual([]);
    expect(normalizarCertificacionesComerciales('invalido')).toEqual([]);

    const normalizadas = normalizarCertificacionesComerciales([
      {
        codigo: 'HUELLA_CARBONO_SINERGIA',
        emisor: 'Sinergia Medio Ambiente',
        doc_url: '/demo/informe-sinergia-gei-demo.pdf',
        doc_hash: 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076',
      },
      {
        // Duplicado que debe ignorarse
        codigo: 'HUELLA_CARBONO_SINERGIA',
        emisor: 'Otro',
      },
      {
        // Código desconocido que debe filtrarse
        codigo: 'DESCONOCIDO',
      },
    ]);

    expect(normalizadas).toHaveLength(1);
    expect(normalizadas[0].codigo).toBe('HUELLA_CARBONO_SINERGIA');
    expect(normalizadas[0].nombre).toContain('Sinergia Medio Ambiente');
    expect(normalizadas[0].norma).toContain('ISO 14064');
  });

  it('filtra y cuenta lotes por preferencia comercial del Comprador', () => {
    const lotes = [
      {
        id: '1',
        codigo_lote: 'LOTE-00107',
        certificaciones_comerciales: [
          { codigo: 'HUELLA_CARBONO_SINERGIA' },
          { codigo: 'LIBRE_ANTIBIOTICOS_HORMONAS' },
        ],
      },
      {
        id: '2',
        codigo_lote: 'LOTE-00108',
        certificaciones_comerciales: [
          { codigo: 'BIENESTAR_ANIMAL' },
          { codigo: 'HUELLA_CARBONO_SINERGIA' },
        ],
      },
      {
        id: '3',
        codigo_lote: 'LOTE-00110',
        certificaciones_comerciales: [],
      },
    ];

    expect(filtrarLotesPorCertificacion(lotes, 'TODOS')).toHaveLength(3);
    expect(filtrarLotesPorCertificacion(lotes, 'HUELLA_CARBONO_SINERGIA').map((l) => l.id)).toEqual(
      ['1', '2'],
    );
    expect(filtrarLotesPorCertificacion(lotes, 'BIENESTAR_ANIMAL').map((l) => l.id)).toEqual(['2']);
    expect(
      filtrarLotesPorCertificacion(lotes, 'LIBRE_ANTIBIOTICOS_HORMONAS').map((l) => l.id),
    ).toEqual(['1']);

    const conteo = contarLotesPorCertificacion(lotes);
    expect(conteo).toEqual({
      HUELLA_CARBONO_SINERGIA: 2,
      BIENESTAR_ANIMAL: 1,
      LIBRE_ANTIBIOTICOS_HORMONAS: 1,
    });
  });
});
