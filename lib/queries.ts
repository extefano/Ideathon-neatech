import {
  resolverCertificacionesLote,
  type CertificacionComercialLote,
  type EstadoLote,
} from '@/lib/domain';
import { createAdminClient } from '@/lib/storage';

export type LoteListItem = {
  id: string;
  codigo_lote: string;
  titulo: string | null;
  estado_publicacion: EstadoLote;
  provincia: string | null;
  localidad: string | null;
  categoria: string | null;
  raza: string | null;
  cantidad_cabezas: number | null;
  peso_promedio_kg: number | null;
  peso_objetivo_kg: number | null;
  monto_total_financiacion: number | null;
  moneda: string;
  seal_1_eudr: boolean;
  seal_2_sanitary: boolean;
  seal_3_reception: boolean;
  certificaciones_comerciales?: CertificacionComercialLote[];
  created_at: string;
};

const LOTE_LIST_COLUMNS_BASE =
  'id, codigo_lote, titulo, estado_publicacion, provincia, localidad, categoria, raza, cantidad_cabezas, peso_promedio_kg, peso_objetivo_kg, monto_total_financiacion, moneda, seal_1_eudr, seal_2_sanitary, seal_3_reception, created_at';
const LOTE_LIST_COLUMNS = `${LOTE_LIST_COLUMNS_BASE}, certificaciones_comerciales`;

function mapearFilasLote(data: unknown): LoteListItem[] {
  const filas = (data ?? []) as Array<
    Omit<LoteListItem, 'certificaciones_comerciales'> & { certificaciones_comerciales?: unknown }
  >;
  return filas.map((fila) => ({
    ...fila,
    certificaciones_comerciales: resolverCertificacionesLote(
      fila.certificaciones_comerciales,
      fila.codigo_lote,
    ),
  }));
}

export async function listarLotes(opts?: { estado?: EstadoLote }): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  let query = admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(60);

  if (opts?.estado) {
    query = query.eq('estado_publicacion', opts.estado);
  }

  let { data, error } = await query;
  if (error && error.message.includes('certificaciones_comerciales')) {
    let fallbackQuery = admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .order('created_at', { ascending: false })
      .limit(60);
    if (opts?.estado) {
      fallbackQuery = fallbackQuery.eq('estado_publicacion', opts.estado);
    }
    const fallbackRes = await fallbackQuery;
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes: ${error.message}`);
  return mapearFilasLote(data);
}

/** Lotes del productor: los que registró (por `productor_id`) o los que llevan su wallet. */
export async function listarLotesDeProductor(opts: {
  productorId?: string | null;
  wallet?: string | null;
}): Promise<LoteListItem[]> {
  const filtros: string[] = [];
  if (opts.productorId) filtros.push(`productor_id.eq.${opts.productorId}`);
  if (opts.wallet) filtros.push(`productor_wallet.eq.${opts.wallet}`);
  if (filtros.length === 0) return [];

  const admin = createAdminClient();
  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .or(filtros.join(','))
    .order('created_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .or(filtros.join(','))
      .order('created_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes del productor: ${error.message}`);
  return mapearFilasLote(data);
}

/** Compras del comprador: lotes donde su wallet quedó como `comprador_wallet` (se setea al fondear). */
export async function listarComprasDeComprador(wallet?: string | null): Promise<LoteListItem[]> {
  if (!wallet) return [];

  const admin = createAdminClient();
  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('comprador_wallet', wallet)
    .order('funded_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .eq('comprador_wallet', wallet)
      .order('funded_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando compras del comprador: ${error.message}`);
  return mapearFilasLote(data);
}

/** Lotes que un veterinario ya auditó (auditorías con su wallet). */
export async function listarLotesRevisadosPorVeterinario(
  wallet?: string | null,
): Promise<LoteListItem[]> {
  if (!wallet) return [];

  const admin = createAdminClient();
  const { data: auditorias, error: errorAuditorias } = await admin
    .from('auditorias_veterinarias')
    .select('lote_id')
    .eq('vet_wallet', wallet);
  if (errorAuditorias) throw new Error(`Error leyendo auditorías: ${errorAuditorias.message}`);

  const ids = [...new Set((auditorias ?? []).map((a) => a.lote_id as string))];
  if (ids.length === 0) return [];

  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .in('id', ids)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .in('id', ids)
      .order('created_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes revisados: ${error.message}`);
  return mapearFilasLote(data);
}

/** Lotes financiados que todavía esperan la auditoría del Mes 4 (Sello 2). */
export async function listarLotesPendientesAuditoria(): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('estado_publicacion', 'FINANCIADO_EN_ENGORDE')
    .eq('seal_2_sanitary', false)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .eq('estado_publicacion', 'FINANCIADO_EN_ENGORDE')
      .eq('seal_2_sanitary', false)
      .order('created_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes pendientes de auditoría: ${error.message}`);
  return mapearFilasLote(data);
}

/**
 * Lotes en tránsito hacia la planta faenadora (listos para recepción en balanza fiscal).
 */
export async function listarLotesEnTransitoFrigorifico(): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('estado_publicacion', 'EN_TRANSITO_A_FRIGORIFICO')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .eq('estado_publicacion', 'EN_TRANSITO_A_FRIGORIFICO')
      .order('created_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes en tránsito al frigorífico: ${error.message}`);
  return mapearFilasLote(data);
}

/**
 * Lotes listos para despacho (engorde finalizado con Sello 2 sanitario aprobado).
 */
export async function listarLotesListosDespachoFrigorifico(): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('estado_publicacion', 'FINANCIADO_EN_ENGORDE')
    .eq('seal_2_sanitary', true)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .eq('estado_publicacion', 'FINANCIADO_EN_ENGORDE')
      .eq('seal_2_sanitary', true)
      .order('created_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes listos para despacho: ${error.message}`);
  return mapearFilasLote(data);
}

/**
 * Lotes recepcionados con ciclo cerrado (Sello 3 y pasaporte EUDR).
 */
export async function listarLotesRecepcionadosFrigorifico(): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  let { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('estado_publicacion', 'CERRADO_CICLO')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error && error.message.includes('certificaciones_comerciales')) {
    const fallbackRes = await admin
      .from('lotes')
      .select(LOTE_LIST_COLUMNS_BASE)
      .eq('estado_publicacion', 'CERRADO_CICLO')
      .order('created_at', { ascending: false })
      .limit(60);
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) throw new Error(`Error listando lotes recepcionados: ${error.message}`);
  return mapearFilasLote(data);
}

export async function getLoteCompleto(codigo: string) {
  const admin = createAdminClient();
  const { data: lote, error } = await admin
    .from('lotes')
    .select('*')
    .eq('codigo_lote', codigo)
    .maybeSingle();

  if (error) throw new Error(`Error leyendo lote: ${error.message}`);
  if (!lote) return null;

  const loteConCertificaciones = {
    ...lote,
    certificaciones_comerciales: resolverCertificacionesLote(
      lote.certificaciones_comerciales,
      String(lote.codigo_lote),
    ),
  };

  const [caravanas, movimientos, auditorias, recepciones, productor] = await Promise.all([
    admin.from('caravanas').select('*').eq('lote_id', lote.id).order('rfid'),
    admin.from('movimientos_escrow').select('*').eq('lote_id', lote.id).order('created_at'),
    admin
      .from('auditorias_veterinarias')
      .select('*')
      .eq('lote_id', lote.id)
      .order('created_at', { ascending: false }),
    admin
      .from('recepciones_frigorifico')
      .select('*')
      .eq('lote_id', lote.id)
      .order('created_at', { ascending: false }),
    lote.productor_id
      ? admin.from('productores').select('*').eq('id', lote.productor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    lote: loteConCertificaciones,
    caravanas: caravanas.data ?? [],
    movimientos: movimientos.data ?? [],
    auditorias: auditorias.data ?? [],
    recepciones: recepciones.data ?? [],
    productor: productor.data ?? null,
  };
}
