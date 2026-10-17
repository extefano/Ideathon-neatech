import { PREFIJO_CODIGO_DEMO, type EstadoGenerable, type LoteDemo } from './generar-lotes';

export type MetaMigracion = {
  count: number;
  seed: number;
  estado: EstadoGenerable;
  certificaciones: boolean;
};

const COLUMNAS_LOTE = [
  'codigo_lote',
  'titulo',
  'productor_wallet',
  'renspa',
  'provincia',
  'localidad',
  'poligono_geojson',
  'superficie_ha',
  'cantidad_cabezas',
  'peso_promedio_kg',
  'peso_min_kg',
  'peso_max_kg',
  'uniformidad',
  'rfid_list_hash',
  'tipo_operacion',
  'categoria',
  'raza',
  'tipo_rodeo',
  'moneda',
  'monto_total_financiacion',
  'peso_objetivo_kg',
  'plazo_meses',
  'fecha_vigencia',
  'precio_por_cabeza',
  'precio_por_kg',
  'descripcion_operacion',
  'estado_publicacion',
  'seal_1_eudr',
  'seal_2_sanitary',
  'seal_3_reception',
  'gfw_consulta',
  'eudr_geo_hash',
  'renspa_doc_url',
  'renspa_doc_hash',
  'certificaciones_comerciales',
  'created_at',
  'updated_at',
] as const;

export function escaparTexto(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

function literalJson(valor: unknown): string {
  return `${escaparTexto(JSON.stringify(valor))}::jsonb`;
}

function literalBooleano(valor: boolean): string {
  return valor ? 'true' : 'false';
}

function literalTimestamp(valor: string): string {
  return `${escaparTexto(valor)}::timestamptz`;
}

function valoresLote(lote: LoteDemo): string[] {
  return [
    escaparTexto(lote.codigoLote),
    escaparTexto(lote.titulo),
    escaparTexto(lote.productorWallet),
    escaparTexto(lote.renspa),
    escaparTexto(lote.provincia),
    escaparTexto(lote.localidad),
    literalJson(lote.poligonoGeojson),
    String(lote.superficieHa),
    String(lote.cantidadCabezas),
    String(lote.pesoPromedioKg),
    String(lote.pesoMinKg),
    String(lote.pesoMaxKg),
    escaparTexto(lote.uniformidad),
    escaparTexto(lote.rfidListHash),
    escaparTexto(lote.tipoOperacion),
    escaparTexto(lote.categoria),
    escaparTexto(lote.raza),
    escaparTexto(lote.tipoRodeo),
    escaparTexto(lote.moneda),
    String(lote.montoTotalFinanciacion),
    String(lote.pesoObjetivoKg),
    String(lote.plazoMeses),
    escaparTexto(lote.fechaVigencia),
    String(lote.precioPorCabeza),
    String(lote.precioPorKg),
    escaparTexto(lote.descripcionOperacion),
    escaparTexto('DISPONIBLE'),
    literalBooleano(true),
    literalBooleano(false),
    literalBooleano(false),
    literalJson(lote.gfwConsulta),
    escaparTexto(lote.eudrGeoHash),
    escaparTexto(lote.renspaDocUrl),
    escaparTexto(lote.renspaDocHash),
    literalJson(lote.certificaciones),
    literalTimestamp(lote.createdAt),
    literalTimestamp(lote.createdAt),
  ];
}

function renderInsertLote(lote: LoteDemo): string {
  const valores = valoresLote(lote)
    .map((valor) => `    ${valor}`)
    .join(',\n');

  return [
    `insert into public.lotes (`,
    `  ${COLUMNAS_LOTE.join(', ')}`,
    `)`,
    `select`,
    valores,
    `where not exists (select 1 from public.lotes where codigo_lote = ${escaparTexto(lote.codigoLote)});`,
  ].join('\n');
}

function renderInsertCaravanas(lote: LoteDemo): string {
  const filas = lote.caravanas
    .map((caravana) => `    (${escaparTexto(caravana.rfid)}, ${caravana.pesoInicialKg})`)
    .join(',\n');

  return [
    `insert into public.caravanas (lote_id, rfid, peso_inicial_kg)`,
    `select l.id, c.rfid, c.peso_inicial_kg`,
    `from public.lotes l`,
    `cross join (values`,
    filas,
    `) as c(rfid, peso_inicial_kg)`,
    `where l.codigo_lote = ${escaparTexto(lote.codigoLote)}`,
    `  and not exists (`,
    `    select 1 from public.caravanas cc where cc.lote_id = l.id and cc.rfid = c.rfid`,
    `  );`,
  ].join('\n');
}

export function renderMigracion(lotes: readonly LoteDemo[], meta: MetaMigracion): string {
  const encabezado = [
    `-- Generado por scripts/generar-lotes-demo.ts (issue #45). NO editar a mano.`,
    `-- count=${meta.count} seed=${meta.seed} estado=${meta.estado} certificaciones=${meta.certificaciones}`,
    `-- Marcador demo: codigo_lote like '${PREFIJO_CODIGO_DEMO}%'.`,
    `-- Idempotente: transacción + INSERT ... WHERE NOT EXISTS + guardia RAISE EXCEPTION.`,
    `-- Limpieza: scripts/sql/limpieza-lotes-demo.sql · Reset: scripts/sql/reset-lotes-demo.sql.`,
  ].join('\n');

  const guardia = [
    `do $$`,
    `declare`,
    `  v_actual integer;`,
    `begin`,
    `  select count(*) into v_actual from public.lotes where codigo_lote like '${PREFIJO_CODIGO_DEMO}%';`,
    `  if v_actual > 0 and v_actual <> ${meta.count} then`,
    `    raise exception`,
    `      'Seed demo inconsistente: % lotes ${PREFIJO_CODIGO_DEMO}% presentes; se esperaban ${meta.count}. Ejecutá scripts/sql/reset-lotes-demo.sql.',`,
    `      v_actual;`,
    `  end if;`,
    `end;`,
    `$$;`,
  ].join('\n');

  const bloques = lotes
    .map((lote) => `${renderInsertLote(lote)}\n\n${renderInsertCaravanas(lote)}`)
    .join('\n\n');

  return `${encabezado}\n\nbegin;\n\n${guardia}\n\n${bloques}\n\ncommit;\n`;
}
