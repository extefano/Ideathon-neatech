import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  compararConHashes,
  textoComparacion,
  VerificadorIntegridad,
} from '@/components/verificador-integridad';

const hashes = [
  { etiqueta: 'Constancia oficial RENSPA (SENASA)', hash: 'Aa11Bb22' },
  { etiqueta: 'Acta de auditoría veterinaria (Mes 4)', hash: 'cc33dd44' },
];

describe('compararConHashes', () => {
  it('coincide: devuelve la etiqueta aunque difiera el uso de mayúsculas', () => {
    expect(compararConHashes(hashes, 'aa11bb22')).toBe('Constancia oficial RENSPA (SENASA)');
  });

  it('no coincide: devuelve null', () => {
    expect(compararConHashes(hashes, 'ff00')).toBeNull();
  });
});

describe('textoComparacion', () => {
  it('coincide: habla de la huella publicada del lote, nunca del contrato', () => {
    const aviso = textoComparacion('Constancia oficial RENSPA (SENASA)');

    expect(aviso.variante).toBe('exito');
    expect(aviso.detalle).toContain('huellas publicadas del lote');
    expect(`${aviso.titulo} ${aviso.detalle}`).not.toMatch(/contrato|anclad|on-chain/i);
  });

  it('no coincide: error honesto, sin acusar de adulteración', () => {
    const aviso = textoComparacion(null);

    expect(aviso.variante).toBe('error');
    expect(aviso.detalle).toContain('huellas publicadas del lote');
    expect(`${aviso.titulo} ${aviso.detalle}`).not.toMatch(/contrato|adulter|falsific/i);
  });
});

describe('VerificadorIntegridad', () => {
  it('no afirma que las huellas estén registradas en el contrato', () => {
    const html = renderToStaticMarkup(<VerificadorIntegridad hashes={hashes} />);

    expect(html).toContain('huella publicada del lote');
    expect(html).not.toMatch(/contrato|on-chain|blockchain|registrad/i);
  });
});
