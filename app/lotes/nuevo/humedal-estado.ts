import type { ReporteHumedalV1 } from '@/lib/humedales';

export type ResultadoGuardarPoligono =
  | { ok: true; verificacionId: string; reporteHash: string; reporte: ReporteHumedalV1 }
  | { ok: false; errores: string[] };

export type EstadoAnalisisHumedal =
  | { fase: 'vacio' }
  | { fase: 'analizando'; geometria: string }
  | { fase: 'resultado'; geometria: string; verificacionId: string; reporte: ReporteHumedalV1 }
  | { fase: 'error'; errores: string[] };

/**
 * Controlador del análisis de humedales con protección contra respuestas
 * obsoletas: cada inicio de análisis gana un token y solo la respuesta vigente
 * (misma solicitud y misma geometría) puede publicar un estado.
 *
 * La vigencia del análisis es conservadora: `geometriaVigente()` devuelve la
 * geometría únicamente cuando el último estado concluido es un resultado
 * exitoso. Iniciar un análisis, fallar o limpiar no dejan vigencia.
 */
export function crearControladorHumedal(publicar: (estado: EstadoAnalisisHumedal) => void) {
  let token = 0;
  let vigente: EstadoAnalisisHumedal = { fase: 'vacio' };

  function emitir(estado: EstadoAnalisisHumedal): void {
    vigente = estado;
    publicar(estado);
  }

  return {
    iniciar(geometria: string): number {
      token += 1;
      emitir({ fase: 'analizando', geometria });
      return token;
    },

    invalidar(): void {
      token += 1;
      emitir({ fase: 'vacio' });
    },

    /**
     * Aplica la respuesta solo si sigue vigente. Devuelve si se aplicó, para
     * que quien llama no pise efectos (p. ej. el id oculto del formulario)
     * con una respuesta vieja.
     */
    resolver(
      tokenRespuesta: number,
      geometria: string,
      resultado: ResultadoGuardarPoligono,
    ): boolean {
      const solicitudVigente = vigente.fase === 'analizando' && vigente.geometria === geometria;
      if (tokenRespuesta !== token || !solicitudVigente) return false;

      if (resultado.ok) {
        emitir({
          fase: 'resultado',
          geometria,
          verificacionId: resultado.verificacionId,
          reporte: resultado.reporte,
        });
      } else {
        emitir({ fase: 'error', errores: resultado.errores });
      }
      return true;
    },

    /**
     * Geometría con resultado exitoso vigente; null mientras se analiza, tras
     * un error o después de limpiar. Es la única geometría enviable.
     */
    geometriaVigente(): string | null {
      return vigente.fase === 'resultado' ? vigente.geometria : null;
    },
  };
}
