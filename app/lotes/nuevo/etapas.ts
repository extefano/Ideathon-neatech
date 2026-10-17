import { RENSPA_REGEX } from '@/lib/domain';

export type DatosEtapa = {
  renspa: string;
  provincia: string;
  localidad: string;
  poligonoOk: boolean;
  dibujoActivo: boolean;
  archivoCsv: boolean;
  csvOk: boolean;
  monto: string;
  pesoObjetivo: string;
  plazo: string;
  fechaVigencia: string;
  descripcion: string;
};

export type ErroresEtapa = Record<string, string>;

export const ETAPAS_LOTE = ['Origen', 'Ganado', 'Documentos', 'Condiciones'] as const;

export function validarEtapa(etapa: number, datos: DatosEtapa): ErroresEtapa {
  const errores: ErroresEtapa = {};

  if (etapa === 0) {
    if (!RENSPA_REGEX.test(datos.renspa))
      errores.renspa = 'Formato RENSPA inválido (XX.XXX.X.XXXXX/XX).';
    if (!datos.provincia) errores.provincia = 'Indicá la provincia.';
    if (!datos.localidad) errores.localidad = 'Indicá la localidad.';
    if (datos.dibujoActivo)
      errores.poligono = 'Terminá o guardá el dibujo del polígono antes de continuar.';
    else if (!datos.poligonoOk) errores.poligono = 'Dibujá o pegá el polígono del establecimiento.';
  } else if (etapa === 1) {
    if (!datos.archivoCsv) errores.archivo_rfid_csv = 'Subí el CSV del bastón lector.';
    else if (!datos.csvOk) errores.archivo_rfid_csv = 'El CSV tiene errores; revisá el detalle.';
  } else if (etapa === 3) {
    if (!datos.monto) errores.montoTotalFinanciacion = 'Indicá el monto.';
    if (!datos.pesoObjetivo) errores.pesoObjetivoKg = 'Indicá el peso objetivo.';
    if (!datos.plazo) errores.plazoMeses = 'Indicá el plazo.';
    if (!datos.fechaVigencia) errores.fechaVigencia = 'Indicá la vigencia de la oferta.';
    if (datos.descripcion.length < 10)
      errores.descripcionOperacion = 'Describí la operación (mínimo 10 caracteres).';
  }

  return errores;
}

export function puedeAvanzar(etapa: number, datos: DatosEtapa): boolean {
  return Object.keys(validarEtapa(etapa, datos)).length === 0;
}
