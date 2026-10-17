import { sha256Hex } from '@/lib/crypto';
import {
  construirReporteDesdeRpc,
  construirReporteSinCalculo,
  type EstadoHumedal,
  type FilaHumedalRpc,
  type FuenteHumedal,
  type PoligonoGeoJSON,
  type ReporteHumedalV1,
} from '@/lib/humedales';
import { jsonCanonico } from '@/lib/json-canonico';
import { createAdminClient } from '@/lib/storage';

type Admin = ReturnType<typeof createAdminClient>;

export type VerificacionHumedalGuardada = {
  id: string;
  reporte: ReporteHumedalV1;
  reporteTexto: string;
  reporteHash: string;
  poligonoHash: string;
  estado: EstadoHumedal;
  porcentajeTexto: string | null;
  fuente: FuenteHumedal | null;
};

export type ResultadoAnalisisHumedal =
  | { ok: true; verificacion: VerificacionHumedalGuardada; reutilizada: boolean }
  | { ok: false; errores: string[] };

type ValidacionPoligono = {
  ok: boolean;
  errores: string[];
  poligono?: PoligonoGeoJSON;
  superficieTotalHaTexto?: string | null;
};

async function normalizarPoligono(
  admin: Admin,
  poligonoTexto: string,
): Promise<{ ok: true; validacion: ValidacionPoligono } | { ok: false; errores: string[] }> {
  let poligono: unknown;
  try {
    poligono = JSON.parse(poligonoTexto);
  } catch {
    return { ok: false, errores: ['El polígono no es un JSON válido.'] };
  }

  const { data, error } = await admin.rpc('validar_poligono_lote', {
    poligono_geojson: poligono,
  });

  if (error) {
    return {
      ok: false,
      errores: ['No pudimos validar el polígono en este momento. Reintentá en unos segundos.'],
    };
  }

  const validacion = data as ValidacionPoligono;
  if (!validacion?.ok || !validacion.poligono) {
    return { ok: false, errores: validacion?.errores ?? ['El polígono no es válido.'] };
  }

  return { ok: true, validacion };
}

/**
 * Analiza el polígono contra la fuente principal de humedales y persiste el
 * reporte canónico (bytes exactos + hash) asociado al usuario autenticado.
 * Nunca inventa un 0 %: si el motor espacial no responde, el reporte queda
 * como ERROR_CONSULTA con porcentaje nulo.
 */
export async function analizarYGuardarHumedal(opts: {
  poligonoTexto: string;
  usuarioId: string;
  supabase?: Admin;
}): Promise<ResultadoAnalisisHumedal> {
  const admin = opts.supabase ?? createAdminClient();

  const normalizado = await normalizarPoligono(admin, opts.poligonoTexto);
  if (!normalizado.ok) return { ok: false, errores: normalizado.errores };
  const validacion = normalizado.validacion;

  let poligonoOriginal: unknown;
  try {
    poligonoOriginal = JSON.parse(opts.poligonoTexto);
  } catch {
    return { ok: false, errores: ['El polígono no es un JSON válido.'] };
  }

  const calculo = await admin.rpc('calcular_interseccion_humedal', {
    poligono_geojson: poligonoOriginal,
  });

  let reporte: ReporteHumedalV1;
  if (calculo.error) {
    const mensaje = calculo.error.message ?? '';
    if (mensaje.includes('poligono_invalido')) {
      return { ok: false, errores: ['El polígono no es válido para el cálculo de humedales.'] };
    }
    reporte = construirReporteSinCalculo({
      estado: 'ERROR_CONSULTA',
      motivo: mensaje.includes('cobertura_invalida') ? 'cobertura_invalida' : 'error_servidor',
      poligono: validacion.poligono as PoligonoGeoJSON,
      superficieLoteHaTexto: validacion.superficieTotalHaTexto ?? null,
      calculadoEn: new Date().toISOString(),
    });
  } else {
    const fila = (Array.isArray(calculo.data) ? calculo.data[0] : calculo.data) as
      FilaHumedalRpc | undefined;
    if (!fila) {
      reporte = construirReporteSinCalculo({
        estado: 'ERROR_CONSULTA',
        motivo: 'respuesta_vacia',
        poligono: validacion.poligono as PoligonoGeoJSON,
        superficieLoteHaTexto: validacion.superficieTotalHaTexto ?? null,
        calculadoEn: new Date().toISOString(),
      });
    } else {
      reporte = construirReporteDesdeRpc(fila);
    }
  }

  const reporteTexto = jsonCanonico(reporte);
  const reporteHash = sha256Hex(reporteTexto);
  const poligonoHash = sha256Hex(jsonCanonico(reporte.poligono));

  const { data: insertado, error: insertError } = await admin
    .from('verificaciones_humedal')
    .insert({
      creada_por: opts.usuarioId,
      estado: reporte.estado,
      motivo: reporte.motivo,
      poligono_geojson: reporte.poligono,
      poligono_hash: poligonoHash,
      superficie_total_ha: reporte.superficieLoteHa,
      superficie_humedal_ha: reporte.superficieHumedalHa,
      porcentaje_humedal: reporte.porcentajeHumedal,
      cobertura_pct: reporte.coberturaPct,
      fuente: reporte.fuente,
      metodo: reporte.metodo,
      reporte_canonico: reporteTexto,
      reporte_hash: reporteHash,
      calculado_en: reporte.calculadoEn,
    })
    .select('id')
    .single();

  if (insertError || !insertado) {
    return {
      ok: false,
      errores: ['No pudimos guardar el análisis del humedal. Reintentá en unos segundos.'],
    };
  }

  return {
    ok: true,
    reutilizada: false,
    verificacion: {
      id: String(insertado.id),
      reporte,
      reporteTexto,
      reporteHash,
      poligonoHash,
      estado: reporte.estado,
      porcentajeTexto: reporte.porcentajeHumedal,
      fuente: reporte.fuente,
    },
  };
}

/**
 * Reutiliza una verificación existente solo si pertenece al usuario y su
 * geometría (normalizada) coincide exactamente con la enviada. En cualquier
 * otro caso recalcula; jamás confía en datos del formulario.
 */
export async function resolverVerificacionHumedal(opts: {
  poligonoTexto: string;
  usuarioId: string;
  verificacionId?: string | null;
  supabase?: Admin;
}): Promise<ResultadoAnalisisHumedal> {
  const admin = opts.supabase ?? createAdminClient();

  if (opts.verificacionId) {
    const { data: fila } = await admin
      .from('verificaciones_humedal')
      .select('id, creada_por, reporte_canonico, reporte_hash, poligono_hash')
      .eq('id', opts.verificacionId)
      .maybeSingle();

    if (fila && fila.creada_por === opts.usuarioId) {
      const normalizado = await normalizarPoligono(admin, opts.poligonoTexto);
      if (normalizado.ok) {
        const hashEnviado = sha256Hex(jsonCanonico(normalizado.validacion.poligono));
        if (hashEnviado === fila.poligono_hash) {
          const reporte = JSON.parse(fila.reporte_canonico as string) as ReporteHumedalV1;
          return {
            ok: true,
            reutilizada: true,
            verificacion: {
              id: String(fila.id),
              reporte,
              reporteTexto: fila.reporte_canonico as string,
              reporteHash: fila.reporte_hash as string,
              poligonoHash: fila.poligono_hash as string,
              estado: reporte.estado,
              porcentajeTexto: reporte.porcentajeHumedal,
              fuente: reporte.fuente,
            },
          };
        }
      }
    }
  }

  return analizarYGuardarHumedal({
    poligonoTexto: opts.poligonoTexto,
    usuarioId: opts.usuarioId,
    supabase: admin,
  });
}
