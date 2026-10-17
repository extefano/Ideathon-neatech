-- Protección del origen/evidencia del lote tras el Sello 1 (EUDR):
-- toda corrección requiere un lote nuevo con certificaciones nuevas.

create or replace function public.proteger_origen_lote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.seal_1_eudr then
    if new.seal_1_eudr is distinct from true
      or new.poligono_geojson is distinct from old.poligono_geojson
      or new.superficie_ha is distinct from old.superficie_ha
      or new.renspa is distinct from old.renspa
      or new.productor_id is distinct from old.productor_id
      or new.productor_wallet is distinct from old.productor_wallet
      or new.renspa_doc_url is distinct from old.renspa_doc_url
      or new.renspa_doc_hash is distinct from old.renspa_doc_hash
      or new.rfid_list_hash is distinct from old.rfid_list_hash
      or new.eudr_geo_hash is distinct from old.eudr_geo_hash
      or new.gfw_consulta is distinct from old.gfw_consulta
      or new.soroban_create_tx_hash is distinct from old.soroban_create_tx_hash
      or new.cantidad_cabezas is distinct from old.cantidad_cabezas
      or new.peso_promedio_kg is distinct from old.peso_promedio_kg
      or new.peso_objetivo_kg is distinct from old.peso_objetivo_kg
      or new.monto_total_financiacion is distinct from old.monto_total_financiacion
    then
      raise exception 'El origen del lote % está sellado (Sello 1 EUDR) y no se puede modificar; creá un lote nuevo para corregir.', old.codigo_lote
        using errcode = 'P0001';
    end if;
  else
    if new.poligono_geojson is distinct from old.poligono_geojson then
      new.gfw_consulta := null;
      new.eudr_geo_hash := null;
      new.estado_publicacion := 'PENDIENTE_VALIDACION';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_origen_lote on public.lotes;
create trigger proteger_origen_lote
before update on public.lotes
for each row
execute function public.proteger_origen_lote();
