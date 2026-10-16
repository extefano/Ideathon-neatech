-- Dominio completo del MVP de trazabilidad (Ticket #6).
-- Reemplaza la tabla minima initial por el esquema canonico.
-- Escritura: solo server-side con la secret key (bypassa RLS); lectura publica para el demo.

drop table if exists public.lotes cascade;

create sequence if not exists public.lote_codigo_seq start 105;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.productores (
  id uuid primary key default gen_random_uuid(),
  wallet text unique,
  nombre_razon_social text not null,
  cuit text not null,
  anos_operando integer,
  operador_consignatario text,
  created_at timestamptz not null default now()
);

create table public.compradores (
  id uuid primary key default gen_random_uuid(),
  wallet text unique,
  razon_social text not null,
  cuit text not null,
  tipo_comprador text not null check (tipo_comprador in ('FRIGORIFICO_EXPORTADOR', 'INVERSOR_AGRO', 'CONSIGNATARIA')),
  matricula_ruca text,
  created_at timestamptz not null default now()
);

create table public.veterinarios (
  id uuid primary key default gen_random_uuid(),
  wallet text unique,
  nombre_completo text not null,
  cuit text not null,
  matricula_profesional text not null,
  acreditacion_senasa text,
  created_at timestamptz not null default now()
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  codigo_lote text unique not null default ('LOTE-' || lpad(nextval('public.lote_codigo_seq')::text, 5, '0')),
  titulo text,
  productor_id uuid references public.productores (id),
  productor_wallet text,
  renspa text not null,
  renspa_doc_url text,
  renspa_doc_hash text,
  boleto_marca_url text,
  marca_liquida boolean,
  provincia text,
  localidad text,
  poligono_geojson jsonb,
  superficie_ha numeric,
  cantidad_cabezas integer,
  peso_promedio_kg numeric,
  peso_min_kg numeric,
  peso_max_kg numeric,
  uniformidad text check (uniformidad in ('Parejo', 'Bastante parejo', 'Desparejo')),
  rfid_list_hash text,
  tipo_operacion text check (tipo_operacion in ('Recría', 'Invernada / Engorde', 'Cría', 'Faena')),
  categoria text,
  raza text,
  tipo_rodeo text,
  edad_meses integer,
  denticion text,
  tratamiento_nutricional text,
  estado_sanitario text,
  estado_corporal numeric,
  vacunaciones text[],
  zona_libre_garrapata boolean,
  zona_libre_miomio boolean,
  calidad integer,
  descripcion_operacion text,
  moneda text not null default 'USDC' check (moneda in ('USDC', 'EURC')),
  monto_total_financiacion numeric,
  peso_objetivo_kg numeric,
  plazo_meses integer,
  fecha_vigencia date,
  precio_por_cabeza numeric,
  precio_por_kg numeric,
  desbaste_pct numeric,
  iva_pct numeric,
  estado_publicacion text not null default 'PENDIENTE_VALIDACION' check (
    estado_publicacion in (
      'PENDIENTE_VALIDACION',
      'DISPONIBLE',
      'RECHAZADO_EUDR',
      'FINANCIADO_EN_ENGORDE',
      'EN_TRANSITO_A_FRIGORIFICO',
      'CERRADO_CICLO'
    )
  ),
  gfw_consulta jsonb,
  eudr_geo_hash text,
  seal_1_eudr boolean not null default false,
  seal_2_sanitary boolean not null default false,
  seal_3_reception boolean not null default false,
  soroban_create_tx_hash text,
  soroban_fund_tx_hash text,
  soroban_seal2_tx_hash text,
  soroban_seal3_tx_hash text,
  comprador_wallet text,
  funded_at timestamptz,
  peso_actual_promedio_kg numeric,
  adpv_kg_dia numeric,
  peso_final_promedio_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lotes_estado_publicacion_idx on public.lotes (estado_publicacion);

create trigger lotes_set_updated_at
before update on public.lotes
for each row
execute function public.set_updated_at();

create table public.caravanas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  rfid text not null,
  peso_inicial_kg numeric,
  peso_mes4_kg numeric,
  peso_final_kg numeric,
  created_at timestamptz not null default now(),
  unique (lote_id, rfid)
);

create table public.auditorias_veterinarias (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  vet_wallet text,
  vet_nombre text,
  matricula text,
  acta_url text,
  acta_hash text,
  csv_mes4_url text,
  csv_mes4_hash text,
  peso_promedio_mes4_kg numeric,
  adpv_kg_dia numeric,
  conciliacion_ok boolean,
  adpv_valido boolean,
  observaciones text,
  soroban_seal2_tx_hash text,
  created_at timestamptz not null default now()
);

create table public.recepciones_frigorifico (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  dte_nro text,
  dte_url text,
  dte_hash text,
  csv_recepcion_url text,
  csv_recepcion_hash text,
  ticket_balanza_url text,
  cabezas_recibidas integer,
  peso_final_promedio_kg numeric,
  kilos_recibidos numeric,
  kilos_objetivo numeric,
  ajuste_usdc numeric,
  conciliacion_ok boolean,
  buyer_wallet text,
  soroban_seal3_tx_hash text,
  created_at timestamptz not null default now()
);

create table public.movimientos_escrow (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  tipo text not null check (
    tipo in (
      'DEPOSIT_ESCROW',
      'RELEASE_MILESTONE_1',
      'RELEASE_MILESTONE_2',
      'RELEASE_MILESTONE_3',
      'REFUND_WEIGHT_SHORTFALL'
    )
  ),
  monto numeric not null,
  moneda text not null default 'USDC',
  tx_hash text,
  estado text not null default 'PAGO_LIBERADO',
  created_at timestamptz not null default now()
);

create index movimientos_escrow_lote_idx on public.movimientos_escrow (lote_id);

-- RLS: lectura publica para el demo (ficha y pasaporte son publicos).
-- No hay policies de escritura: escriben las server actions con la secret key.
alter table public.productores enable row level security;
alter table public.compradores enable row level security;
alter table public.veterinarios enable row level security;
alter table public.lotes enable row level security;
alter table public.caravanas enable row level security;
alter table public.auditorias_veterinarias enable row level security;
alter table public.recepciones_frigorifico enable row level security;
alter table public.movimientos_escrow enable row level security;

create policy "productores_select_publico" on public.productores for select to anon, authenticated using (true);
create policy "compradores_select_publico" on public.compradores for select to anon, authenticated using (true);
create policy "veterinarios_select_publico" on public.veterinarios for select to anon, authenticated using (true);
create policy "lotes_select_publico" on public.lotes for select to anon, authenticated using (true);
create policy "caravanas_select_publico" on public.caravanas for select to anon, authenticated using (true);
create policy "auditorias_select_publico" on public.auditorias_veterinarias for select to anon, authenticated using (true);
create policy "recepciones_select_publico" on public.recepciones_frigorifico for select to anon, authenticated using (true);
create policy "movimientos_select_publico" on public.movimientos_escrow for select to anon, authenticated using (true);
