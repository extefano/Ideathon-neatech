-- Motor geoespacial para la verificación de humedales.
-- PostGIS vive en el schema `extensions` (igual que en el stack de Supabase).
-- Acceso: solo el backend (service_role) ejecuta las funciones y lee las capas.
-- El cálculo cruza el polígono del lote contra UNA fuente principal publicada.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Fuentes versionadas (INH, MapBiomas o demo). Una versión publicada es
-- inmutable: la procedencia y la cobertura quedan congeladas para auditoría.
-- ---------------------------------------------------------------------------
create table public.fuentes_humedales (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null check (proveedor in ('INH', 'MAPBIOMAS', 'DEMO')),
  dataset text not null,
  version text not null,
  fecha_datos date,
  clases text[] not null default '{}',
  escala text,
  url text,
  licencia text,
  atribucion text,
  checksum text,
  es_principal boolean not null default false,
  es_demo boolean not null default false,
  estado_importacion text not null default 'PENDIENTE'
    check (estado_importacion in ('PENDIENTE', 'PUBLICADA', 'RETIRADA')),
  cobertura_geom extensions.geometry(MultiPolygon, 4326),
  features_count integer,
  metodo_version text not null default '1',
  publicada_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proveedor, dataset, version),
  constraint fuentes_publicada_con_cobertura
    check (estado_importacion <> 'PUBLICADA' or cobertura_geom is not null)
);

create trigger fuentes_humedales_set_updated_at
before update on public.fuentes_humedales
for each row
execute function public.set_updated_at();

-- Solo puede existir una fuente principal publicada a la vez.
create unique index fuentes_humedales_principal_uidx
  on public.fuentes_humedales (es_principal)
  where es_principal and estado_importacion = 'PUBLICADA';

-- ---------------------------------------------------------------------------
-- Geometrías de humedal por versión de fuente.
-- ---------------------------------------------------------------------------
create table public.capas_humedales (
  id bigint generated always as identity primary key,
  fuente_id uuid not null references public.fuentes_humedales (id) on delete cascade,
  feature_ref text not null,
  clase text,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  constraint capas_humedales_geom_valida
    check (extensions.st_isvalid(geom) and not extensions.st_isempty(geom)),
  unique (fuente_id, feature_ref)
);

create index capas_humedales_geom_gix on public.capas_humedales using gist (geom);
create index capas_humedales_fuente_idx on public.capas_humedales (fuente_id);

comment on table public.fuentes_humedales is
  'Versiones de capas oficiales de humedales (INH/MapBiomas) y su cobertura observacional.';
comment on table public.capas_humedales is
  'Geometrías de humedal (MultiPolygon 4326) pertenecientes a una versión de fuente.';

-- ---------------------------------------------------------------------------
-- RLS: tablas de solo backend. Sin acceso para anon ni authenticated.
-- ---------------------------------------------------------------------------
alter table public.fuentes_humedales enable row level security;
alter table public.capas_humedales enable row level security;

create policy "fuentes_humedales_sin_acceso" on public.fuentes_humedales
  for select to anon, authenticated using (false);
create policy "capas_humedales_sin_acceso" on public.capas_humedales
  for select to anon, authenticated using (false);

revoke all on public.fuentes_humedales from anon, authenticated;
revoke all on public.capas_humedales from anon, authenticated;
grant select, insert, update on public.fuentes_humedales to service_role;
grant select, insert, delete on public.capas_humedales to service_role;
grant usage, select on sequence public.capas_humedales_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Validación geométrica e identidad normalizada del polígono del lote.
-- Independiente del cruce ambiental: un polígono inválido nunca se publica.
-- ---------------------------------------------------------------------------
create or replace function public.validar_poligono_lote(poligono_geojson jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = extensions, public
as $$
declare
  v_geom extensions.geometry;
  v_geom_calc extensions.geometry;
  v_errores text[] := '{}';
  v_area_m2 double precision;
begin
  if poligono_geojson is null or jsonb_typeof(poligono_geojson) <> 'object' then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['Falta el polígono']));
  end if;

  if poligono_geojson ->> 'type' <> 'Polygon' then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['Se espera un GeoJSON de tipo Polygon']));
  end if;

  begin
    v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(poligono_geojson::text), 4326);
  exception when others then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['El GeoJSON no se pudo interpretar']));
  end;

  if extensions.st_isempty(v_geom) then
    v_errores := array_append(v_errores, 'El polígono está vacío');
  end if;

  if not extensions.st_isvalid(v_geom) then
    v_errores := array_append(
      v_errores,
      'La geometría del polígono no es válida: ' || extensions.st_isvalidreason(v_geom)
    );
  end if;

  if v_errores = '{}' and (
    extensions.st_xmin(v_geom) < -73.6 or extensions.st_xmax(v_geom) > -53.6
    or extensions.st_ymin(v_geom) < -55.1 or extensions.st_ymax(v_geom) > -21.7
  ) then
    v_errores := array_append(v_errores, 'El polígono debe estar ubicado dentro del territorio argentino');
  end if;

  if v_errores = '{}' then
    v_geom_calc := extensions.st_transform(v_geom, 6933);
    if not extensions.st_isvalid(v_geom_calc) then
      v_errores := array_append(v_errores, 'La geometría no es válida en la proyección de cálculo');
    else
      v_area_m2 := extensions.st_area(v_geom_calc);
      if v_area_m2 <= 0 then
        v_errores := array_append(v_errores, 'El polígono no tiene superficie');
      end if;
    end if;
  end if;

  if v_errores <> '{}' then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(v_errores));
  end if;

  return jsonb_build_object(
    'ok', true,
    'errores', '[]'::jsonb,
    'poligono', extensions.st_asgeojson(v_geom, 9)::jsonb,
    'superficieTotalHa', round((v_area_m2 / 10000)::numeric, 4),
    'superficieTotalHaTexto', round((v_area_m2 / 10000)::numeric, 4)::text
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cálculo exacto de intersección contra la fuente principal publicada.
-- Método v1: pre-filtro por bbox en 4326 (índice GIST) y overlay en EPSG:6933
-- (superficie equivalente; numerador y denominador en el mismo modelo).
-- Sin doble conteo: los recortes positivos se unifican antes de medir.
-- ---------------------------------------------------------------------------
create or replace function public.calcular_interseccion_humedal(poligono_geojson jsonb)
returns table (
  estado text,
  motivo text,
  poligono_normalizado jsonb,
  superficie_total_ha numeric,
  superficie_total_ha_texto text,
  superficie_humedal_ha numeric,
  porcentaje_humedal numeric,
  porcentaje_humedal_texto text,
  cobertura_pct numeric,
  fuente_humedal jsonb,
  detalle_capas jsonb,
  metodo jsonb,
  calculado_en timestamptz
)
language plpgsql
stable
security invoker
set search_path = extensions, public
as $$
declare
  v_val jsonb;
  v_geom extensions.geometry;
  v_geom_calc extensions.geometry;
  v_area_lote double precision;
  v_fuente public.fuentes_humedales%rowtype;
  v_cob_calc extensions.geometry;
  v_union extensions.geometry;
  v_capas jsonb;
  v_area_humedal double precision := 0;
  v_area_cubierta double precision;
  v_cob_pct numeric;
  v_pct numeric;
  v_sup_total_texto text;
  v_metodo jsonb := jsonb_build_object(
    'version', '1',
    'motor', 'postgis',
    'sridEntrada', 4326,
    'sridCalculo', 6933,
    'modelo', 'lambert-cylindrical-equal-area'
  );
  v_fuente_json jsonb;
begin
  v_val := public.validar_poligono_lote(poligono_geojson);
  if not coalesce((v_val ->> 'ok')::boolean, false) then
    raise exception 'poligono_invalido: %',
      coalesce(v_val -> 'errores' ->> 0, 'geometría inválida')
      using errcode = '22023';
  end if;

  v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson((v_val -> 'poligono')::text), 4326);
  v_geom_calc := extensions.st_transform(v_geom, 6933);
  v_area_lote := extensions.st_area(v_geom_calc);
  v_sup_total_texto := v_val ->> 'superficieTotalHaTexto';

  select * into v_fuente
  from public.fuentes_humedales f
  where f.es_principal and f.estado_importacion = 'PUBLICADA'
  limit 1;

  if not found then
    return query select
      'SIN_DATOS'::text, 'sin_fuente_principal'::text, v_val -> 'poligono',
      (v_val ->> 'superficieTotalHa')::numeric, v_sup_total_texto,
      null::numeric, null::numeric, null::text, null::numeric,
      null::jsonb, '[]'::jsonb, v_metodo, now();
    return;
  end if;

  v_fuente_json := jsonb_build_object(
    'proveedor', v_fuente.proveedor,
    'dataset', v_fuente.dataset,
    'version', v_fuente.version,
    'fechaDatos', v_fuente.fecha_datos,
    'clases', to_jsonb(v_fuente.clases),
    'escala', v_fuente.escala,
    'url', v_fuente.url,
    'licencia', v_fuente.licencia,
    'atribucion', v_fuente.atribucion,
    'checksum', v_fuente.checksum,
    'metodoVersion', v_fuente.metodo_version,
    'esDemo', v_fuente.es_demo
  );

  v_cob_calc := extensions.st_transform(v_fuente.cobertura_geom, 6933);
  if not extensions.st_isvalid(v_cob_calc) then
    raise exception 'cobertura_invalida: la cobertura de la fuente publicada no es válida'
      using errcode = '22000';
  end if;

  if not extensions.st_covers(v_cob_calc, v_geom_calc) then
    v_area_cubierta := coalesce(
      extensions.st_area(extensions.st_intersection(v_geom_calc, v_cob_calc)),
      0
    );
    v_cob_pct := round((100 * v_area_cubierta / v_area_lote)::numeric, 2);
    return query select
      'COBERTURA_PARCIAL'::text, 'fuera_de_cobertura'::text, v_val -> 'poligono',
      (v_val ->> 'superficieTotalHa')::numeric, v_sup_total_texto,
      null::numeric, null::numeric, null::text, v_cob_pct,
      v_fuente_json, '[]'::jsonb, v_metodo, now();
    return;
  end if;

  with recortes as (
    select
      c.feature_ref,
      c.clase,
      extensions.st_intersection(v_geom_calc, extensions.st_transform(c.geom, 6933)) as g
    from public.capas_humedales c
    where c.fuente_id = v_fuente.id
      and c.geom && v_geom
  ),
  positivos as (
    select r.feature_ref, r.clase, r.g
    from recortes r
    where not extensions.st_isempty(r.g)
  )
  select
    extensions.st_unaryunion(extensions.st_collect(p.g)),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'featureRef', p.feature_ref,
          'clase', p.clase,
          'areaHa', round((extensions.st_area(p.g) / 10000)::numeric, 4)
        )
        order by p.feature_ref
      ),
      '[]'::jsonb
    )
  into v_union, v_capas
  from positivos p;

  if v_union is not null and not extensions.st_isempty(v_union) then
    v_area_humedal := extensions.st_area(v_union);
  end if;

  v_pct := round((100 * v_area_humedal / v_area_lote)::numeric, 4);

  -- Tolerancia numérica documentada: solo desvíos mínimos por redondeo.
  if v_pct < 0 then
    v_pct := 0;
  elsif v_pct > 100 then
    if v_pct > 100.01 then
      raise exception 'calculo_inconsistente: porcentaje % fuera de rango', v_pct
        using errcode = '22000';
    end if;
    v_pct := 100;
  end if;

  return query select
    'VERIFICADO'::text, null::text, v_val -> 'poligono',
    (v_val ->> 'superficieTotalHa')::numeric, v_sup_total_texto,
    round((v_area_humedal / 10000)::numeric, 4),
    v_pct,
    v_pct::text,
    100::numeric,
    v_fuente_json,
    coalesce(v_capas, '[]'::jsonb),
    v_metodo,
    now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Importación reproducible de versiones (script scripts/importar-humedales.mjs).
-- Reemplaza las capas de una versión no publicada y publica de forma atómica.
-- ---------------------------------------------------------------------------
create or replace function public.importar_capas_humedales(
  p_fuente jsonb,
  p_capas jsonb,
  p_publicar boolean default false,
  p_reemplazar_capas boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = extensions, public
as $$
declare
  v_fuente_id uuid;
  v_estado text;
  v_cobertura extensions.geometry;
  v_capas jsonb := coalesce(p_capas, '[]'::jsonb);
  v_features integer := 0;
  v_total integer := 0;
  v_es_principal boolean := coalesce((p_fuente ->> 'esPrincipal')::boolean, false);
begin
  if p_fuente is null
    or coalesce(p_fuente ->> 'proveedor', '') = ''
    or coalesce(p_fuente ->> 'dataset', '') = ''
    or coalesce(p_fuente ->> 'version', '') = '' then
    raise exception 'Metadatos de fuente incompletos (proveedor, dataset y version son obligatorios)'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_capas) <> 'array' then
    raise exception 'p_capas debe ser un arreglo de features' using errcode = '22023';
  end if;

  select id, estado_importacion into v_fuente_id, v_estado
  from public.fuentes_humedales
  where proveedor = p_fuente ->> 'proveedor'
    and dataset = p_fuente ->> 'dataset'
    and version = p_fuente ->> 'version';

  if v_estado = 'PUBLICADA' then
    raise exception 'La versión % de % ya está publicada y es inmutable',
      p_fuente ->> 'version', p_fuente ->> 'dataset'
      using errcode = '55006';
  end if;

  if p_fuente ? 'coberturaGeojson' and p_fuente -> 'coberturaGeojson' is not null then
    begin
      v_cobertura := extensions.st_multi(
        extensions.st_setsrid(
          extensions.st_geomfromgeojson((p_fuente -> 'coberturaGeojson')::text),
          4326
        )
      );
    exception when others then
      raise exception 'La cobertura de la fuente no es un GeoJSON válido' using errcode = '22023';
    end;
    if not extensions.st_isvalid(v_cobertura) or extensions.st_isempty(v_cobertura) then
      raise exception 'La cobertura de la fuente es inválida' using errcode = '22023';
    end if;
  end if;

  if p_publicar and v_cobertura is null then
    raise exception 'No se puede publicar una fuente sin geometría de cobertura' using errcode = '22023';
  end if;

  insert into public.fuentes_humedales (
    proveedor, dataset, version, fecha_datos, clases, escala, url, licencia,
    atribucion, checksum, es_demo, cobertura_geom
  ) values (
    p_fuente ->> 'proveedor',
    p_fuente ->> 'dataset',
    p_fuente ->> 'version',
    nullif(p_fuente ->> 'fechaDatos', '')::date,
    array(select jsonb_array_elements_text(coalesce(p_fuente -> 'clases', '[]'::jsonb))),
    p_fuente ->> 'escala',
    p_fuente ->> 'url',
    p_fuente ->> 'licencia',
    p_fuente ->> 'atribucion',
    p_fuente ->> 'checksum',
    coalesce((p_fuente ->> 'esDemo')::boolean, false),
    v_cobertura
  )
  on conflict (proveedor, dataset, version) do update set
    fecha_datos = excluded.fecha_datos,
    clases = excluded.clases,
    escala = excluded.escala,
    url = excluded.url,
    licencia = excluded.licencia,
    atribucion = excluded.atribucion,
    checksum = excluded.checksum,
    es_demo = excluded.es_demo,
    cobertura_geom = excluded.cobertura_geom
  returning id into v_fuente_id;

  if p_reemplazar_capas then
    delete from public.capas_humedales where fuente_id = v_fuente_id;
  end if;

  if jsonb_array_length(v_capas) > 0 then
    begin
      insert into public.capas_humedales (fuente_id, feature_ref, clase, geom)
      select
        v_fuente_id,
        coalesce(nullif(item ->> 'featureRef', ''), 'f' || ordinality::text),
        nullif(item ->> 'clase', ''),
        extensions.st_multi(
          extensions.st_setsrid(
            extensions.st_geomfromgeojson((item -> 'geometry')::text),
            4326
          )
        )
      from jsonb_array_elements(v_capas) with ordinality as t(item, ordinality);
    exception when others then
      raise exception 'Capa inválida en la importación: %', sqlerrm using errcode = '22023';
    end;

    get diagnostics v_features = row_count;
  end if;

  select count(*) into v_total from public.capas_humedales where fuente_id = v_fuente_id;

  if p_publicar then
    update public.fuentes_humedales
    set es_principal = false
    where es_principal and id <> v_fuente_id;

    update public.fuentes_humedales
    set estado_importacion = 'PUBLICADA',
        publicada_en = now(),
        features_count = v_total,
        es_principal = v_es_principal
    where id = v_fuente_id;
  end if;

  return jsonb_build_object(
    'fuenteId', v_fuente_id,
    'featuresImportadas', v_features,
    'featuresTotales', v_total,
    'publicada', p_publicar
  );
end;
$$;

-- Las funciones espaciales son de uso exclusivo del backend.
revoke all on function public.validar_poligono_lote(jsonb) from public, anon, authenticated;
revoke all on function public.calcular_interseccion_humedal(jsonb) from public, anon, authenticated;
revoke all on function public.importar_capas_humedales(jsonb, jsonb, boolean, boolean) from public, anon, authenticated;

grant execute on function public.validar_poligono_lote(jsonb) to service_role;
grant execute on function public.calcular_interseccion_humedal(jsonb) to service_role;
grant execute on function public.importar_capas_humedales(jsonb, jsonb, boolean, boolean) to service_role;
