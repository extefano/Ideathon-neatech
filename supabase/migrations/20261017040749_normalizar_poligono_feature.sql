-- Normalización canónica del polígono del lote y estabilidad del porcentaje.
-- Acepta Feature<Polygon>, valida sobre la geometría ya normalizada (9
-- decimales) y nunca colapsa un humedal positivo a 0 al redondear.

create or replace function public.validar_poligono_lote(poligono_geojson jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = extensions, public
as $$
declare
  v_geojson jsonb := poligono_geojson;
  v_geom extensions.geometry;
  v_normalizada extensions.geometry;
  v_geom_calc extensions.geometry;
  v_errores text[] := '{}';
  v_area_m2 double precision;
begin
  if v_geojson is null or jsonb_typeof(v_geojson) <> 'object' then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['Falta el polígono']));
  end if;

  if v_geojson ->> 'type' = 'Feature' then
    v_geojson := v_geojson -> 'geometry';
  end if;

  if v_geojson is null
    or jsonb_typeof(v_geojson) <> 'object'
    or v_geojson ->> 'type' <> 'Polygon' then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['Se espera un GeoJSON de tipo Polygon']));
  end if;

  begin
    v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(v_geojson::text), 4326);
  exception when others then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['El GeoJSON no se pudo interpretar']));
  end;

  -- Normalización canónica primero: la validez y el área se calculan sobre la
  -- misma geometría (9 decimales) que se persiste, se hashea y se muestra.
  begin
    v_normalizada := extensions.st_setsrid(
      extensions.st_geomfromgeojson(extensions.st_asgeojson(v_geom, 9)),
      4326
    );
  exception when others then
    return jsonb_build_object('ok', false, 'errores', to_jsonb(array['El GeoJSON no se pudo interpretar']));
  end;

  if extensions.st_npoints(v_normalizada) > 20000 then
    return jsonb_build_object(
      'ok', false,
      'errores', to_jsonb(array['El polígono supera el límite de 20000 vértices'])
    );
  end if;

  if extensions.st_isempty(v_normalizada) then
    v_errores := array_append(v_errores, 'El polígono está vacío');
  end if;

  if not extensions.st_isvalid(v_normalizada) then
    v_errores := array_append(
      v_errores,
      'La geometría del polígono no es válida: ' || extensions.st_isvalidreason(v_normalizada)
    );
  end if;

  if v_errores = '{}' and (
    extensions.st_xmin(v_normalizada) < -73.6 or extensions.st_xmax(v_normalizada) > -53.6
    or extensions.st_ymin(v_normalizada) < -55.1 or extensions.st_ymax(v_normalizada) > -21.7
  ) then
    v_errores := array_append(v_errores, 'El polígono debe estar ubicado dentro del territorio argentino');
  end if;

  if v_errores = '{}' then
    v_geom_calc := extensions.st_transform(v_normalizada, 6933);
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
    'poligono', extensions.st_asgeojson(v_normalizada, 9)::jsonb,
    'superficieTotalHa', round((v_area_m2 / 10000)::numeric, 4),
    'superficieTotalHaTexto', round((v_area_m2 / 10000)::numeric, 4)::text
  );
end;
$$;

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
  v_sup_total numeric;
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

  -- El cruce, el denominador y superficieTotalHa usan la MISMA geometría
  -- normalizada que devolvió la validación.
  v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson((v_val -> 'poligono')::text), 4326);
  v_geom_calc := extensions.st_transform(v_geom, 6933);
  v_area_lote := extensions.st_area(v_geom_calc);
  v_sup_total := round((v_area_lote / 10000)::numeric, 4);
  v_sup_total_texto := v_sup_total::text;

  select * into v_fuente
  from public.fuentes_humedales f
  where f.es_principal and f.estado_importacion = 'PUBLICADA'
  limit 1;

  if not found then
    return query select
      'SIN_DATOS'::text, 'sin_fuente_principal'::text, v_val -> 'poligono',
      v_sup_total, v_sup_total_texto,
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
      v_sup_total, v_sup_total_texto,
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

  v_pct := round((100 * v_area_humedal / v_area_lote)::numeric, 6);

  -- Un recorte positivo nunca se reporta como 0 por el redondeo.
  if v_area_humedal > 0 and v_pct <= 0 then
    v_pct := 0.000001;
  end if;

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
    v_sup_total, v_sup_total_texto,
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
