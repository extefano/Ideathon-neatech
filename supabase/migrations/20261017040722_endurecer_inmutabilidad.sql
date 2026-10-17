-- Endurecimiento de inmutabilidad del flujo de humedales.
-- Snapshots de verificación, versiones publicadas de fuentes y evidencia de
-- origen del lote no cambian una vez ancladas. Todo error usa SQLSTATE 55006.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- a. Las verificaciones son snapshots inmutables: ni update ni delete.
-- ---------------------------------------------------------------------------
revoke update, delete on public.verificaciones_humedal from service_role;

create or replace function public.proteger_verificacion_humedal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'snapshot_inmutable: el reporte de humedal no se puede modificar ni eliminar'
    using errcode = '55006';
end;
$$;

create trigger verificaciones_humedal_inmutable
before update or delete on public.verificaciones_humedal
for each row
execute function public.proteger_verificacion_humedal();

-- ---------------------------------------------------------------------------
-- a bis. El hash declarado debe corresponder a los bytes exactos del reporte.
-- ---------------------------------------------------------------------------
create or replace function public.validar_hash_reporte_humedal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if encode(extensions.digest(convert_to(new.reporte_canonico, 'UTF8'), 'sha256'), 'hex')
    <> new.reporte_hash then
    raise exception 'reporte_hash_invalido: el hash no corresponde a los bytes del reporte canónico'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger verificaciones_humedal_hash_valido
before insert on public.verificaciones_humedal
for each row
execute function public.validar_hash_reporte_humedal();

-- ---------------------------------------------------------------------------
-- b. Una fuente PUBLICADA solo puede cambiar es_principal, updated_at o pasar
-- a RETIRADA. El resto de sus metadatos y su cobertura quedan congelados.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_fuente_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado_importacion = 'PUBLICADA' then
    if new.estado_importacion is distinct from old.estado_importacion
      and new.estado_importacion <> 'RETIRADA' then
      raise exception 'fuente_publicada_inmutable: una fuente publicada solo puede pasar a RETIRADA'
        using errcode = '55006';
    end if;

    if new.id is distinct from old.id
      or new.proveedor is distinct from old.proveedor
      or new.dataset is distinct from old.dataset
      or new.version is distinct from old.version
      or new.fecha_datos is distinct from old.fecha_datos
      or new.clases is distinct from old.clases
      or new.escala is distinct from old.escala
      or new.url is distinct from old.url
      or new.licencia is distinct from old.licencia
      or new.atribucion is distinct from old.atribucion
      or new.checksum is distinct from old.checksum
      or new.es_demo is distinct from old.es_demo
      or new.cobertura_geom::text is distinct from old.cobertura_geom::text
      or new.features_count is distinct from old.features_count
      or new.metodo_version is distinct from old.metodo_version
      or new.publicada_en is distinct from old.publicada_en
      or new.created_at is distinct from old.created_at then
      raise exception 'fuente_publicada_inmutable: los metadatos de una fuente publicada no se pueden modificar'
        using errcode = '55006';
    end if;
  end if;
  return new;
end;
$$;

create trigger fuentes_humedales_publicada_inmutable
before update on public.fuentes_humedales
for each row
execute function public.proteger_fuente_publicada();

-- ---------------------------------------------------------------------------
-- c. Las capas de una fuente PUBLICADA no se insertan, editan ni eliminan.
-- La importación legítima escribe las capas antes de publicar la versión.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_capas_fuente_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select f.estado_importacion into v_estado
    from public.fuentes_humedales f
    where f.id = old.fuente_id;

    if v_estado = 'PUBLICADA' then
      raise exception 'capas_publicadas_inmutables: las capas de una fuente publicada no se pueden modificar'
        using errcode = '55006';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select f.estado_importacion into v_estado
    from public.fuentes_humedales f
    where f.id = new.fuente_id;

    if v_estado = 'PUBLICADA' then
      raise exception 'capas_publicadas_inmutables: las capas de una fuente publicada no se pueden modificar'
        using errcode = '55006';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger capas_humedales_fuente_publicada_inmutable
before insert or update or delete on public.capas_humedales
for each row
execute function public.proteger_capas_fuente_publicada();

-- ---------------------------------------------------------------------------
-- d. Evidencia de origen: sellada o con origen CONFIRMADO/DEMO/RECHAZADO,
-- el polígono y los datos del reporte quedan congelados.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_evidencia_origen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.seal_1_eudr or old.origen_estado in ('CONFIRMADO', 'DEMO', 'RECHAZADO', 'CONFLICTO') then
    if new.porcentaje_humedal is distinct from old.porcentaje_humedal
      or new.fuente_humedal is distinct from old.fuente_humedal
      or new.hash_verificacion_humedal is distinct from old.hash_verificacion_humedal
      or new.estado_humedal is distinct from old.estado_humedal
      or new.verificacion_humedal_id is distinct from old.verificacion_humedal_id
      or new.origen_manifest is distinct from old.origen_manifest
      or new.origen_manifest_hash is distinct from old.origen_manifest_hash
      or new.eudr_geo_hash is distinct from old.eudr_geo_hash
      or new.gfw_consulta is distinct from old.gfw_consulta
      or new.anclaje_estado is distinct from old.anclaje_estado
      or new.origen_preparado_en is distinct from old.origen_preparado_en
      or new.poligono_geojson is distinct from old.poligono_geojson
      -- Campos firmados en Soroban al emitir el Sello 1.
      or new.renspa_doc_hash is distinct from old.renspa_doc_hash
      or new.rfid_list_hash is distinct from old.rfid_list_hash
      or new.cantidad_cabezas is distinct from old.cantidad_cabezas
      or new.peso_promedio_kg is distinct from old.peso_promedio_kg
      or new.peso_objetivo_kg is distinct from old.peso_objetivo_kg
      or new.monto_total_financiacion is distinct from old.monto_total_financiacion then
      raise exception 'evidencia_origen_inmutable: el origen ya fue anclado y su evidencia no se puede modificar'
        using errcode = '55006';
    end if;
  end if;

  if old.seal_1_eudr and new.origen_estado is distinct from old.origen_estado then
    raise exception 'evidencia_origen_inmutable: el estado de origen no cambia después del Sello 1'
      using errcode = '55006';
  end if;

  if old.seal_1_eudr and not new.seal_1_eudr then
    raise exception 'evidencia_origen_inmutable: el Sello 1 no se puede retirar'
      using errcode = '55006';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- e. Estado del anclaje de origen y huella de creación del lote.
-- ---------------------------------------------------------------------------
alter table public.lotes
  add column origen_estado text not null default 'PENDIENTE',
  add column origen_preparado_en timestamptz,
  add column creacion_huella text;

alter table public.lotes
  add constraint lotes_origen_estado_dominio
    check (origen_estado in ('PENDIENTE', 'PREPARADO', 'ENVIADO', 'CONFIRMADO', 'DEMO', 'CONFLICTO', 'RECHAZADO')),
  add constraint lotes_creacion_huella_formato
    check (creacion_huella is null or creacion_huella ~ '^[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------
-- f. Consistencia lote <-> verificación. Corre después del trigger de
-- evidencia para que un lote sellado conserve el 55006 como error principal.
-- ---------------------------------------------------------------------------
create or replace function public.validar_consistencia_humedal_lote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporte_hash text;
  v_estado text;
  v_porcentaje numeric;
  v_fuente jsonb;
  v_poligono jsonb;
begin
  if new.verificacion_humedal_id is not null then
    select v.reporte_hash, v.estado, v.porcentaje_humedal, v.fuente, v.poligono_geojson
    into v_reporte_hash, v_estado, v_porcentaje, v_fuente, v_poligono
    from public.verificaciones_humedal v
    where v.id = new.verificacion_humedal_id;

    if not found then
      raise exception 'lote_verificacion_inconsistente: la verificación % no existe', new.verificacion_humedal_id
        using errcode = '23514';
    end if;

    if new.hash_verificacion_humedal is distinct from v_reporte_hash
      or new.estado_humedal is distinct from v_estado
      or new.porcentaje_humedal is distinct from v_porcentaje
      or new.fuente_humedal is distinct from v_fuente
      or new.poligono_geojson is distinct from v_poligono then
      raise exception 'lote_verificacion_inconsistente: el lote no coincide con su verificación de humedal'
        using errcode = '23514';
    end if;
  elsif new.porcentaje_humedal is not null
    or new.hash_verificacion_humedal is not null
    or new.estado_humedal is not null then
    raise exception 'lote_verificacion_inconsistente: sin verificación no puede haber datos de humedal'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger lotes_validar_consistencia_humedal
before insert or update on public.lotes
for each row
execute function public.validar_consistencia_humedal_lote();
