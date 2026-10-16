import { z } from 'zod';

export const ESTADOS_LOTE = [
  'PENDIENTE_VALIDACION',
  'DISPONIBLE',
  'RECHAZADO_EUDR',
  'FINANCIADO_EN_ENGORDE',
  'EN_TRANSITO_A_FRIGORIFICO',
  'CERRADO_CICLO',
] as const;
export type EstadoLote = (typeof ESTADOS_LOTE)[number];

export const TIPOS_OPERACION = ['Recría', 'Invernada / Engorde', 'Cría', 'Faena'] as const;
export const CATEGORIAS = [
  'Terneros',
  'Terneras',
  'Terneros y terneras',
  'Novillitos',
  'Novillos',
  'Vaquillonas',
  'Vacas',
  'Toros',
] as const;
export const RAZAS = [
  'Aberdeen Angus negro',
  'Aberdeen Angus colorado',
  'Hereford',
  'Braford',
  'Brangus',
  'Brahman',
  'Holando',
  'Shorthorn',
  'Limousin',
  'Charolais',
  'Cruza',
  'Otra',
] as const;
export const TIPOS_RODEO = [
  'Rodeo general',
  'Cruza',
  'Puro de pedigree (PP)',
  'Puro controlado (PC)',
  'Puro registrado',
] as const;
export const MONEDAS = ['USDC', 'EURC'] as const;
export const UNIFORMIDADES = ['Parejo', 'Bastante parejo', 'Desparejo'] as const;
export type Uniformidad = (typeof UNIFORMIDADES)[number];
export const TIPOS_COMPRADOR = [
  'FRIGORIFICO_EXPORTADOR',
  'INVERSOR_AGRO',
  'CONSIGNATARIA',
] as const;
export type TipoComprador = (typeof TIPOS_COMPRADOR)[number];
export const TIPOS_MOVIMIENTO_ESCROW = [
  'DEPOSIT_ESCROW',
  'RELEASE_MILESTONE_1',
  'RELEASE_MILESTONE_2',
  'RELEASE_MILESTONE_3',
  'REFUND_WEIGHT_SHORTFALL',
] as const;
export const TAXONOMIA_EVIDENCIA = [
  'CARGADO',
  'VALIDADO_POR_PLATAFORMA',
  'CONTRASTADO_CON_FUENTE_OFICIAL',
  'REGISTRADO_EN_BLOCKCHAIN',
  'PAGO_LIBERADO',
] as const;

export const RENSPA_REGEX = /^\d{2}\.\d{3}\.\d\.\d{5}\/\d{2}$/;
export const CUIT_REGEX = /^\d{2}-?\d{8}-?\d$/;
export const RFID_REGEX = /^032\d{12}$/;
export const PESO_MIN_KG = 50;
export const PESO_MAX_KG = 1200;
export const ADPV_MIN_KG_DIA = 0.5;
export const ADPV_MAX_KG_DIA = 1.3;

export const paso1Schema = z.object({
  renspa: z.string().regex(RENSPA_REGEX, 'Formato RENSPA inválido (XX.XXX.X.XXXXX/XX)'),
  marcaLiquida: z.coerce.boolean(),
  provincia: z.string().min(2, 'Provincia requerida'),
  localidad: z.string().min(2, 'Localidad requerida'),
  poligono: z.string().min(10, 'Cargá o dibujá el polígono del establecimiento'),
  tipoOperacion: z.enum(TIPOS_OPERACION),
  categoria: z.enum(CATEGORIAS),
  raza: z.enum(RAZAS),
  tipoRodeo: z.enum(TIPOS_RODEO),
  edadMeses: z.coerce.number().int().positive().optional(),
  denticion: z.string().optional(),
  tratamientoNutricional: z.string().optional(),
  moneda: z.enum(MONEDAS),
  montoTotalFinanciacion: z.coerce.number().positive('Monto requerido'),
  pesoObjetivoKg: z.coerce.number().min(100).max(900),
  plazoMeses: z.coerce.number().int().min(1).max(36),
  fechaVigencia: z.string().min(8, 'Fecha de vigencia requerida'),
  descripcionOperacion: z.string().min(10, 'Describí la operación (mínimo 10 caracteres)'),
});
export type Paso1Input = z.infer<typeof paso1Schema>;
