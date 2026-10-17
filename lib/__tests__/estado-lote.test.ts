import { describe, expect, it } from 'vitest';
import { accionLoteParaRol, etiquetaEstado, resumirLote } from '@/lib/estado-lote';

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

describe('accionLoteParaRol (vistas por rol)', () => {
  const base = { estado: 'DISPONIBLE' as const, seal_2_sanitary: false, codigo: 'LOTE-9' };

  it('el productor nunca ve "Fondear" y va a la ficha', () => {
    const accion = accionLoteParaRol(base, 'PRODUCTOR');
    expect(accion).toEqual({ texto: 'Ver ficha del lote', href: '/lotes/LOTE-9' });
  });

  it('el productor despacha solo con Sello 2 y no ofrece auditoría', () => {
    expect(accionLoteParaRol({ ...base, estado: 'FINANCIADO_EN_ENGORDE' }, 'PRODUCTOR')).toEqual({
      texto: 'Ver ficha del lote',
      href: '/lotes/LOTE-9',
    });
    expect(
      accionLoteParaRol(
        { ...base, estado: 'FINANCIADO_EN_ENGORDE', seal_2_sanitary: true },
        'PRODUCTOR',
      ),
    ).toEqual({ texto: 'Despachar (DT-e)', href: '/lotes/LOTE-9/recepcion' });
  });

  it('el productor no recibe acción en un lote rechazado', () => {
    expect(accionLoteParaRol({ ...base, estado: 'RECHAZADO_EUDR' }, 'PRODUCTOR')).toBeNull();
  });

  it('el veterinario revisa solo los financiados sin Sello 2', () => {
    expect(accionLoteParaRol({ ...base, estado: 'FINANCIADO_EN_ENGORDE' }, 'VETERINARIO')).toEqual({
      texto: 'Revisar auditoría (Mes 4)',
      href: '/lotes/LOTE-9/auditoria',
    });
    expect(
      accionLoteParaRol(
        { ...base, estado: 'FINANCIADO_EN_ENGORDE', seal_2_sanitary: true },
        'VETERINARIO',
      ),
    ).toEqual({ texto: 'Ver ficha del lote', href: '/lotes/LOTE-9' });
  });

  it('el comprador fondea disponibles y recibe en tránsito', () => {
    expect(accionLoteParaRol(base, 'COMPRADOR')).toEqual({
      texto: 'Fondear y financiar',
      href: '/lotes/LOTE-9',
    });
    expect(
      accionLoteParaRol({ ...base, estado: 'EN_TRANSITO_A_FRIGORIFICO' }, 'COMPRADOR'),
    ).toEqual({ texto: 'Registrar recepción', href: '/lotes/LOTE-9/recepcion' });
    expect(accionLoteParaRol({ ...base, estado: 'CERRADO_CICLO' }, 'COMPRADOR')).toEqual({
      texto: 'Ver pasaporte EUDR',
      href: '/pasaporte/LOTE-9',
    });
  });

  it('el frigorífico registra recepción en tránsito o listo para despacho y ve pasaporte en cerrados', () => {
    expect(
      accionLoteParaRol({ ...base, estado: 'EN_TRANSITO_A_FRIGORIFICO' }, 'FRIGORIFICO'),
    ).toEqual({ texto: 'Registrar recepción', href: '/lotes/LOTE-9/recepcion' });
    expect(
      accionLoteParaRol(
        { ...base, estado: 'FINANCIADO_EN_ENGORDE', seal_2_sanitary: true },
        'FRIGORIFICO',
      ),
    ).toEqual({ texto: 'Registrar recepción', href: '/lotes/LOTE-9/recepcion' });
    expect(
      accionLoteParaRol(
        { ...base, estado: 'FINANCIADO_EN_ENGORDE', seal_2_sanitary: false },
        'FRIGORIFICO',
      ),
    ).toEqual({ texto: 'Ver ficha del lote', href: '/lotes/LOTE-9' });
    expect(accionLoteParaRol({ ...base, estado: 'CERRADO_CICLO' }, 'FRIGORIFICO')).toEqual({
      texto: 'Ver pasaporte EUDR',
      href: '/pasaporte/LOTE-9',
    });
    expect(accionLoteParaRol(base, 'FRIGORIFICO')).toEqual({
      texto: 'Ver ficha del lote',
      href: '/lotes/LOTE-9',
    });
  });
});
