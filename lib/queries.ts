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
  porcentaje_humedal: number | null;
  estado_humedal: string | null;
  created_at: string;
};

const LOTE_LIST_COLUMNS =
  'id, codigo_lote, titulo, estado_publicacion, provincia, localidad, categoria, raza, cantidad_cabezas, peso_promedio_kg, peso_objetivo_kg, monto_total_financiacion, moneda, seal_1_eudr, seal_2_sanitary, seal_3_reception, porcentaje_humedal, estado_humedal, created_at';

export type FiltroHumedalListado = {
  min?: number | null;
  max?: number | null;
  soloSinDato?: boolean;
};

export type OpcionesListarLotes = {
  estado?: EstadoLote;
  humedal?: FiltroHumedalListado;
  provincia?: string;
  categoria?: string;
  raza?: string;
  moneda?: string;
};

export async function listarLotes(opts?: OpcionesListarLotes): Promise<LoteListItem[]> {
  const admin = createAdminClient();
  let query = admin.from('lotes').select(LOTE_LIST_COLUMNS);

  if (opts?.estado) {
    query = query.eq('estado_publicacion', opts.estado);
  }
  if (opts?.provincia) {
    query = query.eq('provincia', opts.provincia);
  }
  if (opts?.categoria) {
    query = query.eq('categoria', opts.categoria);
  }
  if (opts?.raza) {
    query = query.eq('raza', opts.raza);
  }
  if (opts?.moneda) {
    query = query.eq('moneda', opts.moneda);
  }

  // El filtro de humedal se aplica en la consulta, antes del límite: un lote
  // que cumple no puede quedar afuera por estar fuera de los primeros 60.
  const humedal = opts?.humedal;
  if (humedal?.soloSinDato) {
    query = query.is('porcentaje_humedal', null);
  } else if (humedal) {
    if (typeof humedal.min === 'number') {
      query = query.gte('porcentaje_humedal', humedal.min);
    }
    if (typeof humedal.max === 'number') {
      query = query.lte('porcentaje_humedal', humedal.max);
    }
  }

  // Todos los filtros van antes del límite: la ventana de 60 es de resultados
  // que ya cumplen, no de lotes recientes que después se descartan.
  query = query.order('created_at', { ascending: false }).limit(60);

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
