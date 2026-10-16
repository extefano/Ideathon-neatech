import { describe, expect, it } from 'vitest';
import { etiquetaEstado, resumirLote } from '@/lib/estado-lote';

describe('etiquetaEstado (#30)', () => {
  it('describe cada estado en lenguaje claro, sin el enum crudo', () => {
    const etiquetas = [
      etiquetaEstado('PENDIENTE_VALIDACION'),
      etiquetaEstado('DISPONIBLE'),
      etiquetaEstado('RECHAZADO_EUDR'),
      etiquetaEstado('FINANCIADO_EN_ENGORDE'),
      etiquetaEstado('EN_TRANSITO_A_FRIGORIFICO'),
      etiquetaEstado('CERRADO_CICLO'),
    ];
    for (const etiqueta of etiquetas) {
      expect(etiqueta).not.toMatch(/_/);
      expect(etiqueta.length).toBeGreaterThan(3);
    }
  });
});

describe('resumirLote (#30)', () => {
  it('en engorde sin Sello 2 deriva a la auditoría veterinaria', () => {
    const resumen = resumirLote({
      estado: 'FINANCIADO_EN_ENGORDE',
      seal_2_sanitary: false,
      codigo: 'LOTE-1',
    });
    expect(resumen.etiqueta).toContain('auditoría Mes 4 pendiente');
    expect(resumen.accion).toEqual({
      texto: 'Ir a auditoría veterinaria',
      href: '/lotes/LOTE-1/auditoria',
    });
  });

  it('con Sello 2 deriva al despacho/recepción', () => {
    const resumen = resumirLote({
      estado: 'FINANCIADO_EN_ENGORDE',
      seal_2_sanitary: true,
      codigo: 'LOTE-1',
    });
    expect(resumen.accion?.href).toBe('/lotes/LOTE-1/recepcion');
  });

  it('disponible deriva a fondear el escrow en la ficha', () => {
    const resumen = resumirLote({ estado: 'DISPONIBLE', seal_2_sanitary: false, codigo: 'LOTE-2' });
    expect(resumen.accion).toEqual({ texto: 'Fondear y financiar', href: '/lotes/LOTE-2' });
  });

  it('rechazado EUDR no ofrece siguiente acción', () => {
    const resumen = resumirLote({
      estado: 'RECHAZADO_EUDR',
      seal_2_sanitary: false,
      codigo: 'LOTE-3',
    });
    expect(resumen.accion).toBeNull();
    expect(resumen.descripcion).toContain('31/12/2020');
  });

  it('ciclo cerrado deriva al pasaporte público', () => {
    const resumen = resumirLote({
      estado: 'CERRADO_CICLO',
      seal_2_sanitary: true,
      codigo: 'LOTE-4',
    });
    expect(resumen.accion?.href).toBe('/pasaporte/LOTE-4');
  });
});
