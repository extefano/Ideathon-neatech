import type { EstadoLote } from '@/lib/domain';
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
  created_at: string;
};

const LOTE_LIST_COLUMNS =
  'id, codigo_lote, titulo, estado_publicacion, provincia, localidad, categoria, raza, cantidad_cabezas, peso_promedio_kg, peso_objetivo_kg, monto_total_financiacion, moneda, seal_1_eudr, seal_2_sanitary, seal_3_reception, created_at';

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

  const { data, error } = await query;
  if (error) throw new Error(`Error listando lotes: ${error.message}`);
  return (data ?? []) as unknown as LoteListItem[];
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
  const { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .or(filtros.join(','))
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`Error listando lotes del productor: ${error.message}`);
  return (data ?? []) as unknown as LoteListItem[];
}

/** Compras del comprador: lotes donde su wallet quedó como `comprador_wallet` (se setea al fondear). */
export async function listarComprasDeComprador(wallet?: string | null): Promise<LoteListItem[]> {
  if (!wallet) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('comprador_wallet', wallet)
    .order('funded_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`Error listando compras del comprador: ${error.message}`);
  return (data ?? []) as unknown as LoteListItem[];
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

  const { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .in('id', ids)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`Error listando lotes revisados: ${error.message}`);
  return (data ?? []) as unknown as LoteListItem[];
}

/** Lotes financiados que todavía esperan la auditoría del Mes 4 (Sello 2). */
export async function listarLotesPendientesAuditoria(): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lotes')
    .select(LOTE_LIST_COLUMNS)
    .eq('estado_publicacion', 'FINANCIADO_EN_ENGORDE')
    .eq('seal_2_sanitary', false)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`Error listando lotes pendientes de auditoría: ${error.message}`);
  return (data ?? []) as unknown as LoteListItem[];
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
    lote,
    caravanas: caravanas.data ?? [],
    movimientos: movimientos.data ?? [],
    auditorias: auditorias.data ?? [],
    recepciones: recepciones.data ?? [],
    productor: productor.data ?? null,
  };
}
