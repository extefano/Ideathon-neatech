import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@/lib/crypto';
import { METODO_HUMEDAL_V1, construirReporteDesdeRpc, type FilaHumedalRpc } from '@/lib/humedales';
import { analizarYGuardarHumedal, resolverVerificacionHumedal } from '@/lib/humedales-servidor';
import { jsonCanonico } from '@/lib/json-canonico';
import { hashReporteHumedal } from '@/lib/reportes-ambientales';
import type { createAdminClient } from '@/lib/storage';

type Admin = ReturnType<typeof createAdminClient>;

const POLIGONO = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-58.1, -29.5],
      [-58.07, -29.5],
      [-58.07, -29.45],
      [-58.1, -29.45],
      [-58.1, -29.5],
    ],
  ],
};

const VALIDACION_OK = {
  ok: true,
  errores: [],
  poligono: POLIGONO,
  superficieTotalHa: 55.4945,
  superficieTotalHaTexto: '55.4945',
};

const FILA_CALCULO: FilaHumedalRpc = {
  estado: 'VERIFICADO',
  motivo: null,
  poligono_normalizado: POLIGONO,
  superficie_total_ha: 55.4945,
  superficie_total_ha_texto: '55.4945',
  superficie_humedal_ha: 27.7473,
  porcentaje_humedal: 50,
  porcentaje_humedal_texto: '50.0000',
  cobertura_pct: 100,
  fuente_humedal: {
    proveedor: 'DEMO',
    dataset: 'humedales-demo-nea',
    version: '1',
    fechaDatos: null,
    clases: ['humedal-demo'],
    escala: null,
    url: null,
    licencia: null,
    atribucion: null,
    checksum: null,
    metodoVersion: '1',
    esDemo: true,
  },
  detalle_capas: [],
  metodo: METODO_HUMEDAL_V1,
  calculado_en: '2026-10-17T05:00:00.000Z',
};

function crearAdminFalso(
  opciones: {
    validacion?: unknown;
    validacionError?: { message: string } | null;
    calculo?: unknown;
    calculoError?: { message: string } | null;
    insertError?: { message: string } | null;
    verificaciones?: Record<string, unknown>;
    insertId?: string;
  } = {},
) {
  const inserts: Record<string, unknown>[] = [];

  const admin = {
    rpc: async (nombre: string) => {
      if (nombre === 'validar_poligono_lote') {
        return {
          data: opciones.validacion ?? VALIDACION_OK,
          error: opciones.validacionError ?? null,
        };
      }
      if (nombre === 'calcular_interseccion_humedal') {
        return { data: opciones.calculo ?? [FILA_CALCULO], error: opciones.calculoError ?? null };
      }
      return { data: null, error: { message: `rpc inesperada: ${nombre}` } };
    },
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return {
          select: () => ({
            single: async () => ({
              data: opciones.insertError ? null : { id: opciones.insertId ?? 'ver-1' },
              error: opciones.insertError ?? null,
            }),
          }),
        };
      },
      select: () => ({
        eq: (_columna: string, valor: string) => ({
          maybeSingle: async () => ({
            data: (opciones.verificaciones ?? {})[valor] ?? null,
            error: null,
          }),
        }),
      }),
    }),
  };

  return { admin: admin as unknown as Admin, inserts };
}

const POLIGONO_TEXTO = JSON.stringify(POLIGONO);

describe('analizarYGuardarHumedal', () => {
  it('persiste el reporte canónico con hashes verificables y sin tocar el formulario', async () => {
    const { admin, inserts } = crearAdminFalso();

    const resultado = await analizarYGuardarHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      supabase: admin,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.reutilizada).toBe(false);
    expect(resultado.verificacion.estado).toBe('VERIFICADO');
    expect(resultado.verificacion.reporteHash).toBe(
      hashReporteHumedal(resultado.verificacion.reporte),
    );
    expect(resultado.verificacion.reporteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(resultado.verificacion.poligonoHash).toMatch(/^[0-9a-f]{64}$/);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      creada_por: 'user-1',
      estado: 'VERIFICADO',
      reporte_hash: resultado.verificacion.reporteHash,
      reporte_canonico: resultado.verificacion.reporteTexto,
    });
  });

  it('cuando el motor espacial falla guarda ERROR_CONSULTA en vez de inventar 0 %', async () => {
    const { admin, inserts } = crearAdminFalso({
      calculoError: { message: 'connection refused' },
    });

    const resultado = await analizarYGuardarHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      supabase: admin,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.verificacion.reporte.estado).toBe('ERROR_CONSULTA');
    expect(resultado.verificacion.reporte.porcentajeHumedal).toBeNull();
    expect(resultado.verificacion.reporte.superficieLoteHa).toBe('55.4945');
    expect(inserts).toHaveLength(1);
  });

  it('un polígono inválido para el motor aborta sin persistir nada', async () => {
    const { admin, inserts } = crearAdminFalso({
      calculoError: { message: 'poligono_invalido: la geometría no es válida' },
    });

    const resultado = await analizarYGuardarHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      supabase: admin,
    });

    expect(resultado.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it('usa los errores de validación de PostGIS cuando el polígono no es válido', async () => {
    const { admin, inserts } = crearAdminFalso({
      validacion: {
        ok: false,
        errores: ['La geometría del polígono no es válida: self-intersection'],
      },
    });

    const resultado = await analizarYGuardarHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      supabase: admin,
    });

    expect(resultado).toEqual({
      ok: false,
      errores: ['La geometría del polígono no es válida: self-intersection'],
    });
    expect(inserts).toHaveLength(0);
  });

  it('si la validación no pudo ejecutarse pide reintentar y no persiste', async () => {
    const { admin, inserts } = crearAdminFalso({
      validacionError: { message: 'timeout' },
    });

    const resultado = await analizarYGuardarHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      supabase: admin,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores[0]).toContain('Reintentá');
    expect(inserts).toHaveLength(0);
  });

  it('rechaza un JSON que no es un polígono sin llamar a la base', async () => {
    const { admin, inserts } = crearAdminFalso();

    const resultado = await analizarYGuardarHumedal({
      poligonoTexto: 'no-json',
      usuarioId: 'user-1',
      supabase: admin,
    });

    expect(resultado.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });
});

describe('resolverVerificacionHumedal', () => {
  const reporte = construirReporteDesdeRpc(FILA_CALCULO);
  const reporteTexto = jsonCanonico(reporte);
  const reporteHash = hashReporteHumedal(reporte);
  const poligonoHash = sha256Hex(jsonCanonico(POLIGONO));

  it('reutiliza la verificación del dueño cuando la geometría coincide exactamente', async () => {
    const { admin, inserts } = crearAdminFalso({
      verificaciones: {
        'ver-x': {
          id: 'ver-x',
          creada_por: 'user-1',
          reporte_canonico: reporteTexto,
          reporte_hash: reporteHash,
          poligono_hash: poligonoHash,
        },
      },
    });

    const resultado = await resolverVerificacionHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      verificacionId: 'ver-x',
      supabase: admin,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.reutilizada).toBe(true);
    expect(resultado.verificacion.reporteTexto).toBe(reporteTexto);
    expect(inserts).toHaveLength(0);
  });

  it('no reutiliza una verificación de otro usuario: recalcula', async () => {
    const { admin, inserts } = crearAdminFalso({
      verificaciones: {
        'ver-x': {
          id: 'ver-x',
          creada_por: 'otro-user',
          reporte_canonico: reporteTexto,
          reporte_hash: reporteHash,
          poligono_hash: poligonoHash,
        },
      },
    });

    const resultado = await resolverVerificacionHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      verificacionId: 'ver-x',
      supabase: admin,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.reutilizada).toBe(false);
    expect(inserts).toHaveLength(1);
  });

  it('no reutiliza cuando la geometría enviada difiere de la verificada', async () => {
    const { admin, inserts } = crearAdminFalso({
      verificaciones: {
        'ver-x': {
          id: 'ver-x',
          creada_por: 'user-1',
          reporte_canonico: reporteTexto,
          reporte_hash: reporteHash,
          poligono_hash: 'f'.repeat(64),
        },
      },
    });

    const resultado = await resolverVerificacionHumedal({
      poligonoTexto: POLIGONO_TEXTO,
      usuarioId: 'user-1',
      verificacionId: 'ver-x',
      supabase: admin,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.reutilizada).toBe(false);
    expect(inserts).toHaveLength(1);
  });
});
