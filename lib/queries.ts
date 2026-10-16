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
