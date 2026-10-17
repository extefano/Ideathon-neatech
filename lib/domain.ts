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
  marcaLiquida: z.coerce.boolean().default(false),
  provincia: z.string().min(2, 'Provincia requerida'),
  localidad: z.string().min(2, 'Localidad requerida'),
  poligono: z.string().min(10, 'Cargá o dibujá el polígono del establecimiento'),
  tipoOperacion: z.enum(TIPOS_OPERACION),
  categoria: z.enum(CATEGORIAS),
  raza: z.enum(RAZAS),
  tipoRodeo: z.enum(TIPOS_RODEO),
  edadMeses: z.preprocess(
    (valor) => (valor === '' || valor === null ? undefined : valor),
    z.coerce.number().int().positive().optional(),
  ),
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

export const CODIGOS_CERTIFICACION_COMERCIAL = [
  'HUELLA_CARBONO_SINERGIA',
  'BIENESTAR_ANIMAL',
  'LIBRE_ANTIBIOTICOS_HORMONAS',
] as const;
export type CodigoCertificacionComercial = (typeof CODIGOS_CERTIFICACION_COMERCIAL)[number];

export type DefinicionCertificacionComercial = {
  codigo: CodigoCertificacionComercial;
  nombre: string;
  etiquetaTarjeta: string;
  etiquetaFiltro: string;
  norma: string;
  emisorDefault: string;
  rolTecnico: string;
  observacionesDefault: string;
  demoPdfUrl: string;
  demoPdfNombre: string;
  demoPdfHash: string;
};

export const CERTIFICACIONES_COMERCIALES: readonly DefinicionCertificacionComercial[] = [
  {
    codigo: 'HUELLA_CARBONO_SINERGIA',
    nombre: 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
    etiquetaTarjeta: 'GEI · Sinergia',
    etiquetaFiltro: 'Huella GEI · Sinergia',
    norma: 'ISO 14064 / ISO 14067 · GHG Protocol',
    emisorDefault: 'Sinergia Medio Ambiente · Auditoría IRAM / Control Union',
    rolTecnico:
      'Medición de inventario biológico GEI y diseño de plan de mitigación (pastoreo rotativo/silvopastoril) para valor comercial ESG en UE y Mercosur. No sustituye el control aduanero EUDR.',
    observacionesDefault: 'Inventario biológico GEI y plan de mitigación con pastoreo rotativo.',
    demoPdfUrl: '/demo/informe-sinergia-gei-demo.pdf',
    demoPdfNombre: 'informe-sinergia-gei-demo.pdf',
    demoPdfHash: 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076',
  },
  {
    codigo: 'BIENESTAR_ANIMAL',
    nombre: 'Bienestar Animal Certificado',
    etiquetaTarjeta: 'Bienestar Welfair',
    etiquetaFiltro: 'Bienestar Animal (Welfair)',
    norma: 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
    emisorDefault: 'OIA / Control Union / IRAM',
    rolTecnico:
      'Garantiza trato ético del ganado (libre de dolor, estrés, mutilaciones sin anestesia y transporte controlado) para mercados UE y Mercosur.',
    observacionesDefault:
      'Manejo ético en manga, sombra natural y protocolo de bienestar auditado.',
    demoPdfUrl: '/demo/certificado-bienestar-welfair-demo.pdf',
    demoPdfNombre: 'certificado-bienestar-welfair-demo.pdf',
    demoPdfHash: 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774',
  },
  {
    codigo: 'LIBRE_ANTIBIOTICOS_HORMONAS',
    nombre: 'Libre de Antibióticos y Promotores Hormonales',
    etiquetaTarjeta: 'Sin Antibióticos',
    etiquetaFiltro: 'Libre de Antibióticos y Hormonas',
    norma: 'Protocolo Cuota Hilton / Mercado UE',
    emisorDefault: 'Protocolo avalado por SENASA · Inspección OIA / LSQA',
    rolTecnico:
      'Garantiza inocuidad alimentaria: animales criados sin promotores de crecimiento hormonales ni antibióticos de forma preventiva o subterapéutica.',
    observacionesDefault:
      'Rodeo trazado sin promotores de crecimiento hormonales ni antibióticos preventivos.',
    demoPdfUrl: '/demo/certificado-libre-antibioticos-demo.pdf',
    demoPdfNombre: 'certificado-libre-antibioticos-demo.pdf',
    demoPdfHash: '8888ab9712a3ee0bafec87597ef56943b5bcc4bc8555c5be21f6e2581115f5b2',
  },
] as const;

export const certificacionComercialSchema = z.object({
  codigo: z.enum(CODIGOS_CERTIFICACION_COMERCIAL),
  nombre: z.string().min(2),
  norma: z.string().min(2),
  emisor: z.string().min(2),
  fecha_emision: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  doc_url: z.string().nullable().optional(),
  doc_hash: z.string().nullable().optional(),
});

export type CertificacionComercialLote = z.infer<typeof certificacionComercialSchema>;

export function esCodigoCertificacionComercial(
  valor: unknown,
): valor is CodigoCertificacionComercial {
  return (
    typeof valor === 'string' &&
    (CODIGOS_CERTIFICACION_COMERCIAL as readonly string[]).includes(valor)
  );
}

export function obtenerDefinicionCertificacion(
  codigo: CodigoCertificacionComercial,
): DefinicionCertificacionComercial {
  const encontrada = CERTIFICACIONES_COMERCIALES.find((c) => c.codigo === codigo);
  if (!encontrada) {
    throw new Error(`Código de certificación comercial desconocido: ${codigo}`);
  }
  return encontrada;
}

export function normalizarCertificacionesComerciales(raw: unknown): CertificacionComercialLote[] {
  if (!Array.isArray(raw)) return [];
  const resultado: CertificacionComercialLote[] = [];
  const vistos = new Set<CodigoCertificacionComercial>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (!esCodigoCertificacionComercial(obj.codigo)) continue;
    if (vistos.has(obj.codigo)) continue;

    const def = obtenerDefinicionCertificacion(obj.codigo);
    const nombre =
      typeof obj.nombre === 'string' && obj.nombre.trim().length > 0
        ? obj.nombre.trim()
        : def.nombre;
    const norma =
      typeof obj.norma === 'string' && obj.norma.trim().length > 0 ? obj.norma.trim() : def.norma;
    const emisor =
      typeof obj.emisor === 'string' && obj.emisor.trim().length > 0
        ? obj.emisor.trim()
        : def.emisorDefault;

    vistos.add(obj.codigo);
    resultado.push({
      codigo: obj.codigo,
      nombre,
      norma,
      emisor,
      fecha_emision:
        typeof obj.fecha_emision === 'string' && obj.fecha_emision.trim().length > 0
          ? obj.fecha_emision.trim()
          : null,
      observaciones:
        typeof obj.observaciones === 'string' && obj.observaciones.trim().length > 0
          ? obj.observaciones.trim()
          : null,
      doc_url:
        typeof obj.doc_url === 'string' && obj.doc_url.trim().length > 0
          ? obj.doc_url.trim()
          : null,
      doc_hash:
        typeof obj.doc_hash === 'string' && obj.doc_hash.trim().length > 0
          ? obj.doc_hash.trim()
          : null,
    });
  }

  return resultado;
}

export function filtrarLotesPorCertificacion<T extends { certificaciones_comerciales?: unknown }>(
  lotes: readonly T[],
  filtro?: CodigoCertificacionComercial | 'TODOS' | null,
): T[] {
  if (!filtro || filtro === 'TODOS') return [...lotes];
  return lotes.filter((lote) => {
    const certs = normalizarCertificacionesComerciales(lote.certificaciones_comerciales);
    return certs.some((c) => c.codigo === filtro);
  });
}

export function contarLotesPorCertificacion<T extends { certificaciones_comerciales?: unknown }>(
  lotes: readonly T[],
): Record<CodigoCertificacionComercial, number> {
  const conteo: Record<CodigoCertificacionComercial, number> = {
    HUELLA_CARBONO_SINERGIA: 0,
    BIENESTAR_ANIMAL: 0,
    LIBRE_ANTIBIOTICOS_HORMONAS: 0,
  };
  for (const lote of lotes) {
    const certs = normalizarCertificacionesComerciales(lote.certificaciones_comerciales);
    for (const c of certs) {
      conteo[c.codigo] += 1;
    }
  }
  return conteo;
}

const SEED_CERTIFICACIONES_POR_CODIGO: Record<string, CertificacionComercialLote[]> = {
  'LOTE-00107': [
    {
      codigo: 'HUELLA_CARBONO_SINERGIA',
      nombre: 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
      norma: 'ISO 14064 / ISO 14067 · GHG Protocol',
      emisor: 'Sinergia Medio Ambiente · Auditoría IRAM / Control Union',
      fecha_emision: '2026-10-05',
      observaciones:
        'Inventario biológico GEI y plan de mitigación con pastoreo rotativo en pradera pampeana.',
      doc_url: '/demo/informe-sinergia-gei-demo.pdf',
      doc_hash: 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076',
    },
    {
      codigo: 'LIBRE_ANTIBIOTICOS_HORMONAS',
      nombre: 'Libre de Antibióticos y Promotores Hormonales',
      norma: 'Protocolo Cuota Hilton / Mercado UE',
      emisor: 'Protocolo avalado por SENASA · Inspección OIA / LSQA',
      fecha_emision: '2026-10-08',
      observaciones:
        'Rodeo recriado sin promotores de crecimiento hormonales ni antibióticos subterapéuticos.',
      doc_url: '/demo/certificado-libre-antibioticos-demo.pdf',
      doc_hash: '8888ab9712a3ee0bafec87597ef56943b5bcc4bc8555c5be21f6e2581115f5b2',
    },
  ],
  'LOTE-00108': [
    {
      codigo: 'BIENESTAR_ANIMAL',
      nombre: 'Bienestar Animal Certificado',
      norma: 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
      emisor: 'OIA / Control Union',
      fecha_emision: '2026-10-02',
      observaciones:
        'Manejo de hacienda sin perros ni picana eléctrica, sombra natural y corrales de descanso.',
      doc_url: '/demo/certificado-bienestar-welfair-demo.pdf',
      doc_hash: 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774',
    },
    {
      codigo: 'HUELLA_CARBONO_SINERGIA',
      nombre: 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
      norma: 'ISO 14064 / ISO 14067 · GHG Protocol',
      emisor: 'Sinergia Medio Ambiente · Auditoría SGS',
      fecha_emision: '2026-10-04',
      observaciones:
        'Balance positivo de captura de carbono en pastizal natural y monte silvopastoril correntino.',
      doc_url: '/demo/informe-sinergia-gei-demo.pdf',
      doc_hash: 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076',
    },
  ],
  'LOTE-00109': [
    {
      codigo: 'HUELLA_CARBONO_SINERGIA',
      nombre: 'Huella de Carbono e Inventario GEI (Sinergia Medio Ambiente)',
      norma: 'ISO 14064 / ISO 14067 · GHG Protocol',
      emisor: 'Sinergia Medio Ambiente · Auditoría IRAM',
      fecha_emision: '2026-10-10',
      observaciones:
        'Medición de inventario biológico GEI y diseño de plan de mitigación sobre verdeo de invierno.',
      doc_url: '/demo/informe-sinergia-gei-demo.pdf',
      doc_hash: 'e86d8ca1aefa0060f52ec295c1cf494fd0902de61baa0b3fee9b9cbbeeb46076',
    },
    {
      codigo: 'BIENESTAR_ANIMAL',
      nombre: 'Bienestar Animal Certificado',
      norma: 'ISO 34700 / Welfare Quality · Sellos Welfair e ITW (Alemania)',
      emisor: 'IRAM / OIA',
      fecha_emision: '2026-10-11',
      observaciones: 'Destete racional y protocolo de bienestar auditado en manga y aguadas.',
      doc_url: '/demo/certificado-bienestar-welfair-demo.pdf',
      doc_hash: 'cffc690dd11bbb2530817bbd23bc34e1e4ec6d0cd36855bb1bf952140d404774',
    },
    {
      codigo: 'LIBRE_ANTIBIOTICOS_HORMONAS',
      nombre: 'Libre de Antibióticos y Promotores Hormonales',
      norma: 'Protocolo Cuota Hilton / Mercado UE',
      emisor: 'Protocolo avalado por SENASA · Inspección OIA / LSQA',
      fecha_emision: '2026-10-11',
      observaciones:
        'Tropa trazada desde el destete sin uso de anabólicos ni antibióticos preventivos.',
      doc_url: '/demo/certificado-libre-antibioticos-demo.pdf',
      doc_hash: '8888ab9712a3ee0bafec87597ef56943b5bcc4bc8555c5be21f6e2581115f5b2',
    },
  ],
};

export function resolverCertificacionesLote(
  raw: unknown,
  codigoLote?: string | null,
): CertificacionComercialLote[] {
  const normalizadas = normalizarCertificacionesComerciales(raw);
  if (normalizadas.length > 0) return normalizadas;
  if (codigoLote && SEED_CERTIFICACIONES_POR_CODIGO[codigoLote]) {
    return SEED_CERTIFICACIONES_POR_CODIGO[codigoLote];
  }
  return [];
}
