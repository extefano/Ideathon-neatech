-- Pruebas del motor geoespacial de humedales (pgTAP).
-- Fixtures analíticos: rectángulos en el NEA con proporciones exactas conocidas.
-- Se ejecuta con `pnpm dlx supabase@latest test db` contra la base local.

begin;
create extension if not exists pgtap;

select plan(38);

-- 1. Validación: polígono correcto
select ok(
  (public.validar_poligono_lote(
    '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
  ) ->> 'ok')::boolean,
  'validar_poligono_lote acepta un Polygon cerrado dentro de Argentina'
);

-- 2. Validación: autointersección (bow-tie)
select ok(
  not (public.validar_poligono_lote(
    '{"type":"Polygon","coordinates":[[[-58.0,-29.0],[-58.01,-29.01],[-58.01,-29.0],[-58.0,-29.01],[-58.0,-29.0]]]}'::jsonb
  ) ->> 'ok')::boolean,
  'validar_poligono_lote rechaza una geometría autointersectada'
);

-- 3. Validación: tipo distinto de Polygon
select ok(
  not (public.validar_poligono_lote('{"type":"Point","coordinates":[0,0]}'::jsonb) ->> 'ok')::boolean,
  'validar_poligono_lote rechaza tipos que no son Polygon'
);

-- 4. Validación: fuera de Argentina
select ok(
  not (public.validar_poligono_lote(
    '{"type":"Polygon","coordinates":[[[-3.7,40.4],[-3.8,40.4],[-3.8,40.5],[-3.7,40.5],[-3.7,40.4]]]}'::jsonb
  ) ->> 'ok')::boolean,
  'validar_poligono_lote rechaza polígonos fuera del territorio argentino'
);

-- 5 y 6. Sin fuente principal publicada: SIN_DATOS y porcentaje null
update public.fuentes_humedales set es_principal = false, estado_importacion = 'RETIRADA';

select is(
  (select estado from public.calcular_interseccion_humedal(
    '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
  )),
  'SIN_DATOS',
  'sin fuente principal publicada el estado es SIN_DATOS'
);
select is(
  (select porcentaje_humedal from public.calcular_interseccion_humedal(
    '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
  )),
  null,
  'sin fuente, el porcentaje es null (no se inventa un cero)'
);

-- 7. Importar y publicar la versión t1 (cobertura completa del área de prueba)
select is(
  (select public.importar_capas_humedales(
    jsonb_build_object(
      'proveedor', 'INH',
      'dataset', 'test-nea',
      'version', 't1',
      'esPrincipal', true,
      'coberturaGeojson', jsonb_build_object(
        'type', 'MultiPolygon',
        'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
          jsonb_build_array(-59.2, -27.6), jsonb_build_array(-58.8, -27.6),
          jsonb_build_array(-58.8, -27.4), jsonb_build_array(-59.2, -27.4),
          jsonb_build_array(-59.2, -27.6)
        )))
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'featureRef', 'h1',
        'clase', 'humedal',
        'geometry', jsonb_build_object(
          'type', 'MultiPolygon',
          'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
            jsonb_build_array(-59.01, -27.51), jsonb_build_array(-59.0, -27.51),
            jsonb_build_array(-59.0, -27.49), jsonb_build_array(-59.01, -27.49),
            jsonb_build_array(-59.01, -27.51)
          )))
        )
      )
    ),
    true
  ) ->> 'featuresTotales'),
  '1',
  'importar_capas_humedales publica la versión y cuenta sus features'
);

-- 8. 50 % analítico: el humedal cubre exactamente la mitad este-oeste del lote
select ok(
  abs(
    (select porcentaje_humedal from public.calcular_interseccion_humedal(
      '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
    )) - 50
  ) < 0.01,
  'el cruce del rectángulo partido al medio da 50 %'
);

-- 9. Superficie del lote en hectáreas (modelo equivalente 6933)
select ok(
  (select superficie_total_ha from public.calcular_interseccion_humedal(
    '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
  )) between 420 and 460,
  'la superficie del lote se informa en hectáreas (~4,4 km²)'
);

-- 10. Cero válido: lote dentro de cobertura, sin humedales debajo
select is(
  (select (estado || '|' || porcentaje_humedal::text) from public.calcular_interseccion_humedal(
    '{"type":"Polygon","coordinates":[[[-59.15,-27.55],[-59.13,-27.55],[-59.13,-27.53],[-59.15,-27.53],[-59.15,-27.55]]]}'::jsonb
  )),
  'VERIFICADO|0.000000',
  'sin intersección y con cobertura completa el resultado es 0 % verificado'
);

-- 11. Cobertura parcial: nunca se publica un porcentaje sobre cobertura incompleta
select is(
  (select (estado || '|' || coalesce(porcentaje_humedal::text, 'null')) from public.calcular_interseccion_humedal(
    '{"type":"Polygon","coordinates":[[[-59.3,-27.5],[-59.1,-27.5],[-59.1,-27.48],[-59.3,-27.48],[-59.3,-27.5]]]}'::jsonb
  )),
  'COBERTURA_PARCIAL|null',
  'fuera de cobertura el porcentaje es null y el estado lo explica'
);

-- 12. Publicar t2: un humedal con agujero
select is(
  (select public.importar_capas_humedales(
    jsonb_build_object(
      'proveedor', 'INH',
      'dataset', 'test-nea',
      'version', 't2',
      'esPrincipal', true,
      'coberturaGeojson', jsonb_build_object(
        'type', 'MultiPolygon',
        'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
          jsonb_build_array(-59.2, -27.6), jsonb_build_array(-58.8, -27.6),
          jsonb_build_array(-58.8, -27.4), jsonb_build_array(-59.2, -27.4),
          jsonb_build_array(-59.2, -27.6)
        )))
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'featureRef', 'donut',
        'clase', 'humedal',
        'geometry', jsonb_build_object(
          'type', 'MultiPolygon',
          'coordinates', jsonb_build_array(jsonb_build_array(
            jsonb_build_array(
              jsonb_build_array(-59.01, -27.51), jsonb_build_array(-58.99, -27.51),
              jsonb_build_array(-58.99, -27.49), jsonb_build_array(-59.01, -27.49),
              jsonb_build_array(-59.01, -27.51)
            ),
            jsonb_build_array(
              jsonb_build_array(-59.005, -27.505), jsonb_build_array(-59.005, -27.495),
              jsonb_build_array(-58.995, -27.495), jsonb_build_array(-58.995, -27.505),
              jsonb_build_array(-59.005, -27.505)
            )
          ))
        )
      )
    ),
    true
  ) ->> 'featuresTotales'),
  '1',
  'la versión t2 (con agujero) se publica'
);

-- 13. Agujero: el área del agujero no cuenta como humedal (75 % analítico)
select ok(
  abs(
    (select porcentaje_humedal from public.calcular_interseccion_humedal(
      '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
    )) - 75
  ) < 0.05,
  'el agujero del polígono de humedal no cuenta como superficie de humedal'
);

-- 14. Publicar t3: dos features duplicadas
select is(
  (select public.importar_capas_humedales(
    jsonb_build_object(
      'proveedor', 'INH',
      'dataset', 'test-nea',
      'version', 't3',
      'esPrincipal', true,
      'coberturaGeojson', jsonb_build_object(
        'type', 'MultiPolygon',
        'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
          jsonb_build_array(-59.2, -27.6), jsonb_build_array(-58.8, -27.6),
          jsonb_build_array(-58.8, -27.4), jsonb_build_array(-59.2, -27.4),
          jsonb_build_array(-59.2, -27.6)
        )))
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'featureRef', 'dup-este-1',
        'clase', 'humedal',
        'geometry', jsonb_build_object(
          'type', 'MultiPolygon',
          'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
            jsonb_build_array(-59.0, -27.51), jsonb_build_array(-58.99, -27.51),
            jsonb_build_array(-58.99, -27.49), jsonb_build_array(-59.0, -27.49),
            jsonb_build_array(-59.0, -27.51)
          )))
        )
      ),
      jsonb_build_object(
        'featureRef', 'dup-este-2',
        'clase', 'humedal',
        'geometry', jsonb_build_object(
          'type', 'MultiPolygon',
          'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
            jsonb_build_array(-59.0, -27.51), jsonb_build_array(-58.99, -27.51),
            jsonb_build_array(-58.99, -27.49), jsonb_build_array(-59.0, -27.49),
            jsonb_build_array(-59.0, -27.51)
          )))
        )
      )
    ),
    true
  ) ->> 'featuresTotales'),
  '2',
  'la versión t3 (con duplicados) se publica'
);

-- 15. Doble conteo: features duplicadas no suman dos veces
select ok(
  abs(
    (select porcentaje_humedal from public.calcular_interseccion_humedal(
      '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
    )) - 50
  ) < 0.01,
  'las features superpuestas se unifican antes de medir (sin doble conteo)'
);

-- 16. La versión publicada más reciente es la principal y las anteriores no contaminan
select is(
  (select fuente_humedal ->> 'version' from public.calcular_interseccion_humedal(
    '{"type":"Polygon","coordinates":[[[-59.15,-27.55],[-59.13,-27.55],[-59.13,-27.53],[-59.15,-27.53],[-59.15,-27.55]]]}'::jsonb
  )),
  't3',
  'el cálculo usa únicamente la versión principal publicada'
);

-- 17. Una versión publicada es inmutable
select throws_ok(
  $$ select public.importar_capas_humedales(
       jsonb_build_object('proveedor','INH','dataset','test-nea','version','t3'),
       '[]'::jsonb,
       false
     ) $$,
  '55006',
  null,
  'no se puede reimportar una versión ya publicada'
);

-- 18. No se publica sin cobertura observacional
select throws_ok(
  $$ select public.importar_capas_humedales(
       jsonb_build_object('proveedor','INH','dataset','test-sin-cob','version','t1'),
       '[]'::jsonb,
       true
     ) $$,
  '22023',
  null,
  'publicar sin cobertura es un error explícito'
);

-- 19. Polígono inválido en el cálculo: excepción, nunca un resultado
select throws_ok(
  $$ select public.calcular_interseccion_humedal(
       '{"type":"Polygon","coordinates":[[[-58.0,-29.0],[-58.01,-29.01],[-58.01,-29.0],[-58.0,-29.01],[-58.0,-29.0]]]}'::jsonb
     ) $$,
  '22023',
  null,
  'un polígono inválido lanza poligono_invalido'
);

-- 20. anon no puede ejecutar el motor espacial
set local role anon;
select throws_ok(
  $$ select public.calcular_interseccion_humedal('{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb) $$,
  '42501',
  null,
  'anon no tiene permiso de ejecución sobre la RPC'
);
reset role;

-- 21. La evidencia del Sello 1 no se puede modificar
insert into public.verificaciones_humedal (
  creada_por, estado, poligono_geojson, poligono_hash, porcentaje_humedal,
  metodo, reporte_canonico, reporte_hash, calculado_en
) values (
  gen_random_uuid(),
  'VERIFICADO',
  '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb,
  repeat('c', 64),
  50.000000,
  '{"version":"1"}'::jsonb,
  '{"fixture":"sello1"}',
  encode(extensions.digest(convert_to('{"fixture":"sello1"}', 'UTF8'), 'sha256'), 'hex'),
  now()
);

insert into public.lotes (
  renspa, poligono_geojson, seal_1_eudr,
  porcentaje_humedal, hash_verificacion_humedal, estado_humedal,
  verificacion_humedal_id, origen_manifest_hash
)
select
  '05.077.0.00999/00',
  '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb,
  true,
  50.000000,
  encode(extensions.digest(convert_to('{"fixture":"sello1"}', 'UTF8'), 'sha256'), 'hex'),
  'VERIFICADO',
  id,
  repeat('b', 64)
from public.verificaciones_humedal
where reporte_canonico = '{"fixture":"sello1"}';

select throws_ok(
  $$ update public.lotes set porcentaje_humedal = 99
     where renspa = '05.077.0.00999/00' $$,
  '55006',
  null,
  'el porcentaje de humedal no cambia después del Sello 1'
);

-- 22. Un update legítimo posterior (título) sigue funcionando
select lives_ok(
  $$ update public.lotes set titulo = 'Lote de prueba'
     where renspa = '05.077.0.00999/00' $$,
  'los updates que no tocan la evidencia siguen permitidos'
);

-- 23. Rango del porcentaje protegido por constraint (en un lote nuevo)
select throws_ok(
  $$ insert into public.lotes (renspa, porcentaje_humedal)
     values ('05.077.0.00998/00', 150) $$,
  '23514',
  null,
  'un porcentaje fuera de rango viola el constraint'
);

-- 24. Quitar el Sello 1 de un lote sellado está prohibido
select throws_ok(
  $$ update public.lotes set seal_1_eudr = false
     where renspa = '05.077.0.00999/00' $$,
  '55006',
  null,
  'el Sello 1 no se puede retirar de un lote sellado'
);

-- 25. Un lote CONFIRMADO no puede cambiar su polígono
insert into public.lotes (renspa, poligono_geojson, origen_estado)
values (
  '05.077.0.00997/00',
  '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb,
  'CONFIRMADO'
);

select throws_ok(
  $$ update public.lotes
     set poligono_geojson = '{"type":"Polygon","coordinates":[[[-59.02,-27.52],[-58.98,-27.52],[-58.98,-27.48],[-59.02,-27.48],[-59.02,-27.52]]]}'::jsonb
     where renspa = '05.077.0.00997/00' $$,
  '55006',
  null,
  'un lote con origen CONFIRMADO no puede cambiar su polígono'
);

-- 26. El lote debe coincidir con su verificación
select throws_ok(
  $$ insert into public.lotes (
       renspa, verificacion_humedal_id, hash_verificacion_humedal,
       estado_humedal, porcentaje_humedal
     )
     select '05.077.0.00996/00', id, repeat('d', 64), 'VERIFICADO', 50
     from public.verificaciones_humedal where reporte_canonico = '{"fixture":"sello1"}' $$,
  '23514',
  null,
  'un lote con hash distinto al de su verificación no se inserta'
);

-- 27. Sin verificación no puede haber porcentaje de humedal
select throws_ok(
  $$ insert into public.lotes (renspa, porcentaje_humedal)
     values ('05.077.0.00995/00', 12.5) $$,
  '23514',
  null,
  'un lote sin verificación no puede declarar porcentaje de humedal'
);

-- 28. Update de un snapshot bloqueado
select throws_ok(
  $$ update public.verificaciones_humedal set estado = 'SIN_DATOS'
     where reporte_canonico = '{"fixture":"sello1"}' $$,
  '55006',
  null,
  'un snapshot de verificación no se puede actualizar'
);

-- 29. Delete de un snapshot bloqueado
select throws_ok(
  $$ delete from public.verificaciones_humedal
     where reporte_canonico = '{"fixture":"sello1"}' $$,
  '55006',
  null,
  'un snapshot de verificación no se puede eliminar'
);

-- 30. Delete de una capa de fuente publicada bloqueado
select throws_ok(
  $$ delete from public.capas_humedales
     where fuente_id = (
       select id from public.fuentes_humedales
       where proveedor = 'INH' and dataset = 'test-nea' and version = 't3'
     )
     and feature_ref = 'dup-este-1' $$,
  '55006',
  null,
  'las capas de una fuente publicada no se pueden eliminar'
);

-- 31. Contenido de fuente publicada bloqueado
select throws_ok(
  $$ update public.fuentes_humedales set checksum = 'manipulado'
     where proveedor = 'INH' and dataset = 'test-nea' and version = 't3' $$,
  '55006',
  null,
  'los metadatos de una fuente publicada no se pueden modificar'
);

-- 32. Cambiar es_principal en una fuente publicada sí está permitido
select lives_ok(
  $$ update public.fuentes_humedales set es_principal = false
     where proveedor = 'INH' and dataset = 'test-nea' and version = 't3' $$,
  'cambiar es_principal en una fuente publicada sigue permitido'
);

-- 33. Feature<Polygon> se desenvuelve y normaliza igual que Polygon
select ok(
  (public.validar_poligono_lote(
    '{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}}'::jsonb
  ) ->> 'ok')::boolean
  and public.validar_poligono_lote(
    '{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}}'::jsonb
  ) -> 'poligono' = public.validar_poligono_lote(
    '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
  ) -> 'poligono',
  'Feature<Polygon> se desenvuelve y normaliza igual que un Polygon'
);

-- 34. Un recorte positivo diminuto no se redondea a cero
select public.importar_capas_humedales(
  jsonb_build_object(
    'proveedor', 'INH',
    'dataset', 'test-sliver',
    'version', 't1',
    'esPrincipal', true,
    'coberturaGeojson', jsonb_build_object(
      'type', 'MultiPolygon',
      'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
        jsonb_build_array(-59.2, -27.6), jsonb_build_array(-58.8, -27.6),
        jsonb_build_array(-58.8, -27.4), jsonb_build_array(-59.2, -27.4),
        jsonb_build_array(-59.2, -27.6)
      )))
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'featureRef', 'sliver',
      'clase', 'humedal',
      'geometry', jsonb_build_object(
        'type', 'MultiPolygon',
        'coordinates', jsonb_build_array(jsonb_build_array(jsonb_build_array(
          jsonb_build_array(-59.005, -27.51), jsonb_build_array(-59.004999992, -27.51),
          jsonb_build_array(-59.004999992, -27.49), jsonb_build_array(-59.005, -27.49),
          jsonb_build_array(-59.005, -27.51)
        )))
      )
    )
  ),
  true
);

select ok(
  (select porcentaje_humedal > 0 and porcentaje_humedal::text <> '0.000000'
   from public.calcular_interseccion_humedal(
     '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb
   )),
  'un sliver positivo no se colapsa a 0.000000'
);

-- 35. Un snapshot con hash que no corresponde a sus bytes no se inserta
select throws_ok(
  $$ insert into public.verificaciones_humedal (
       creada_por, estado, poligono_geojson, poligono_hash,
       metodo, reporte_canonico, reporte_hash, calculado_en
     ) values (
       gen_random_uuid(), 'SIN_DATOS',
       '{"type":"Polygon","coordinates":[[[-59.01,-27.51],[-58.99,-27.51],[-58.99,-27.49],[-59.01,-27.49],[-59.01,-27.51]]]}'::jsonb,
       repeat('e', 64), '{"version":"1"}'::jsonb,
       '{"fixture":"hash-falso"}', repeat('f', 64), now()
     ) $$,
  '23514',
  null,
  'el hash del snapshot debe corresponder a sus bytes exactos'
);

-- 36. Un lote cuyo polígono no coincide con su verificación no se inserta
select throws_ok(
  $$ insert into public.lotes (
       renspa, poligono_geojson, verificacion_humedal_id,
       porcentaje_humedal, hash_verificacion_humedal, estado_humedal
     )
     select
       '05.077.0.00994/00',
       '{"type":"Polygon","coordinates":[[[-59.02,-27.52],[-58.98,-27.52],[-58.98,-27.48],[-59.02,-27.48],[-59.02,-27.52]]]}'::jsonb,
       id, 50, encode(extensions.digest(convert_to('{"fixture":"sello1"}', 'UTF8'), 'sha256'), 'hex'), 'VERIFICADO'
     from public.verificaciones_humedal where reporte_canonico = '{"fixture":"sello1"}' $$,
  '23514',
  null,
  'el polígono del lote debe ser el de su verificación'
);

-- 37. Después del Sello 1 tampoco cambia el hash firmado del padrón RFID
select throws_ok(
  $$ update public.lotes set rfid_list_hash = repeat('9', 64)
     where renspa = '05.077.0.00999/00' $$,
  '55006',
  null,
  'los hashes firmados en Soroban quedan congelados tras el Sello 1'
);

-- 38. Después del Sello 1 el estado de origen no cambia
select throws_ok(
  $$ update public.lotes set origen_estado = 'CONFLICTO'
     where renspa = '05.077.0.00999/00' $$,
  '55006',
  null,
  'el estado de origen no cambia tras el Sello 1'
);

select * from finish();
rollback;
