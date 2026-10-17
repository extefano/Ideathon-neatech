-- Snapshot confiable del reporte de humedales y su vínculo con el lote.
-- El reporte canónico se persiste como texto exacto: los bytes descargados y
-- hasheados son los mismos que se anclan dentro del compromiso del Sello 1.

create table public.verificaciones_humedal (
  id uuid primary key default gen_random_uuid(),
  creada_por uuid not null,
  estado text not null check (
    estado in ('VERIFICADO', 'SIN_DATOS', 'SIN_COBERTURA', 'COBERTURA_PARCIAL', 'ERROR_CONSULTA')
  ),
  motivo text,
  poligono_geojson jsonb not null,
  poligono_hash text not null check (poligono_hash ~ '^[0-9a-f]{64}$'),
  superficie_total_ha numeric,
  superficie_humedal_ha numeric,
  porcentaje_humedal numeric check (
    porcentaje_humedal is null or (porcentaje_humedal >= 0 and porcentaje_humedal <= 100)
  ),
  cobertura_pct numeric,
  fuente jsonb,
  metodo jsonb not null,
  reporte_canonico text not null,
  reporte_hash text not null check (reporte_hash ~ '^[0-9a-f]{64}$'),
  calculado_en timestamptz not null,
  created_at timestamptz not null default now()
);

create index verificaciones_humedal_creada_por_idx on public.verificaciones_humedal (creada_por);

comment on table public.verificaciones_humedal is
  'Reportes de humedales generados por el servidor (vista previa y alta del lote). Solo backend.';
comment on column public.verificaciones_humedal.reporte_canonico is
  'Bytes exactos del reporte firmados por reporte_hash; nunca se reconstruyen desde JSONB.';

alter table public.verificaciones_humedal enable row level security;

create policy "verificaciones_humedal_sin_acceso" on public.verificaciones_humedal
  for select to anon, authenticated using (false);

revoke all on public.verificaciones_humedal from anon, authenticated;
grant select, insert on public.verificaciones_humedal to service_role;

-- ---------------------------------------------------------------------------
-- Campos ambientales y de anclaje del lote.
-- ---------------------------------------------------------------------------
alter table public.lotes
  add column porcentaje_humedal numeric,
  add column fuente_humedal jsonb,
  add column hash_verificacion_humedal text,
  add column estado_humedal text,
  add column verificacion_humedal_id uuid references public.verificaciones_humedal (id),
  add column creado_por uuid,
  add column creacion_key text,
  add column origen_manifest text,
  add column origen_manifest_hash text,
  add column anclaje_red text,
  add column anclaje_contrato_id text,
  add column anclaje_estado text;

alter table public.lotes
  add constraint lotes_porcentaje_humedal_rango
    check (porcentaje_humedal is null or (porcentaje_humedal >= 0 and porcentaje_humedal <= 100)),
  add constraint lotes_hash_humedal_formato
    check (hash_verificacion_humedal is null or hash_verificacion_humedal ~ '^[0-9a-f]{64}$'),
  add constraint lotes_origen_manifest_hash_formato
    check (origen_manifest_hash is null or origen_manifest_hash ~ '^[0-9a-f]{64}$'),
  add constraint lotes_estado_humedal_dominio
    check (
      estado_humedal is null
      or estado_humedal in ('VERIFICADO', 'SIN_DATOS', 'SIN_COBERTURA', 'COBERTURA_PARCIAL', 'ERROR_CONSULTA')
    ),
  add constraint lotes_anclaje_estado_dominio
    check (
      anclaje_estado is null
      or anclaje_estado in ('PENDIENTE', 'CONFIRMADO', 'DEMO', 'CONFLICTO')
    );

-- Idempotencia del alta: una clave por usuario.
create unique index lotes_creacion_key_uidx
  on public.lotes (creado_por, creacion_key)
  where creacion_key is not null;

create index lotes_porcentaje_humedal_idx on public.lotes (porcentaje_humedal);

comment on column public.lotes.hash_verificacion_humedal is
  'SHA-256 del reporte de humedales; queda comprometido por el manifiesto de origen y el Sello 1.';

-- ---------------------------------------------------------------------------
-- Inmutabilidad: una vez emitido el Sello 1, la evidencia de origen no cambia.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_evidencia_origen()
returns trigger
language plpgsql
as $$
begin
  if old.seal_1_eudr and (
       new.porcentaje_humedal is distinct from old.porcentaje_humedal
    or new.fuente_humedal is distinct from old.fuente_humedal
    or new.hash_verificacion_humedal is distinct from old.hash_verificacion_humedal
    or new.estado_humedal is distinct from old.estado_humedal
    or new.verificacion_humedal_id is distinct from old.verificacion_humedal_id
    or new.origen_manifest is distinct from old.origen_manifest
    or new.origen_manifest_hash is distinct from old.origen_manifest_hash
    or new.eudr_geo_hash is distinct from old.eudr_geo_hash
    or new.gfw_consulta is distinct from old.gfw_consulta
    or new.anclaje_estado is distinct from old.anclaje_estado
  ) then
    raise exception 'evidencia_origen_inmutable: el Sello 1 ya fue emitido y su evidencia no se puede modificar'
      using errcode = '55006';
  end if;
  return new;
end;
$$;

create trigger lotes_proteger_evidencia_origen
before update on public.lotes
for each row
execute function public.proteger_evidencia_origen();
