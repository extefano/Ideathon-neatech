'use server';

import { getCurrentUser } from '@/lib/auth';
import { analizarYGuardarHumedal } from '@/lib/humedales-servidor';
import type { ResultadoGuardarPoligono } from './humedal-estado';

/**
 * Vista previa del porcentaje de humedal al confirmar el polígono. No crea el
 * lote: persiste una verificación (reporte canónico + hash) propiedad del
 * productor autenticado y devuelve el resultado para mostrarlo.
 */
export async function guardarPoligonoAction(
  poligonoTexto: string,
): Promise<ResultadoGuardarPoligono> {
  const user = await getCurrentUser();
  if (!user || user.rol !== 'PRODUCTOR') {
    return {
      ok: false,
      errores: ['Iniciá sesión con una cuenta de Productor para analizar el polígono.'],
    };
  }

  if (
    typeof poligonoTexto !== 'string' ||
    poligonoTexto.length === 0 ||
    poligonoTexto.length > 200_000
  ) {
    return { ok: false, errores: ['El polígono no es válido.'] };
  }

  const resultado = await analizarYGuardarHumedal({
    poligonoTexto,
    usuarioId: user.id,
  });

  if (!resultado.ok) return resultado;

  return {
    ok: true,
    verificacionId: resultado.verificacion.id,
    reporteHash: resultado.verificacion.reporteHash,
    reporte: resultado.verificacion.reporte,
  };
}
