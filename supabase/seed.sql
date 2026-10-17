-- Seed local (solo `supabase db reset`; nunca se ejecuta en el deploy remoto).
-- Fuente DEMO sintética del NEA: cobertura alrededor de Mercedes (Corrientes) y
-- dos humedales. El humedal oeste cubre exactamente la mitad del polígono de
-- demo (public/demo/poligono.geojson), útil para verificar el 50 % de forma
-- analítica. Está marcada esDemo = true y la UI la muestra como tal.

delete from public.fuentes_humedales
where proveedor = 'DEMO' and dataset = 'humedales-demo-nea';

select public.importar_capas_humedales(
  jsonb_build_object(
    'proveedor', 'DEMO',
    'dataset', 'humedales-demo-nea',
    'version', '1',
    'fechaDatos', '2026-01-01',
    'clases', jsonb_build_array('humedal-demo'),
    'escala', 'sintética',
    'licencia', 'Datos sintéticos de desarrollo (no oficiales)',
    'atribucion', 'Muunar - fixture de desarrollo',
    'esDemo', true,
    'esPrincipal', true,
    'coberturaGeojson', jsonb_build_object(
      'type', 'MultiPolygon',
      'coordinates', jsonb_build_array(
        jsonb_build_array(jsonb_build_array(
          jsonb_build_array(-58.3, -29.6),
          jsonb_build_array(-57.8, -29.6),
          jsonb_build_array(-57.8, -29.3),
          jsonb_build_array(-58.3, -29.3),
          jsonb_build_array(-58.3, -29.6)
        ))
      )
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'featureRef', 'demo-humedal-oeste',
      'clase', 'humedal-demo',
      'geometry', jsonb_build_object(
        'type', 'MultiPolygon',
        'coordinates', jsonb_build_array(
          jsonb_build_array(jsonb_build_array(
            jsonb_build_array(-58.1, -29.5),
            jsonb_build_array(-58.07, -29.5),
            jsonb_build_array(-58.07, -29.45),
            jsonb_build_array(-58.1, -29.45),
            jsonb_build_array(-58.1, -29.5)
          ))
        )
      )
    ),
    jsonb_build_object(
      'featureRef', 'demo-laguna-sur',
      'clase', 'humedal-demo',
      'geometry', jsonb_build_object(
        'type', 'MultiPolygon',
        'coordinates', jsonb_build_array(
          jsonb_build_array(jsonb_build_array(
            jsonb_build_array(-58.2, -29.55),
            jsonb_build_array(-58.16, -29.55),
            jsonb_build_array(-58.16, -29.52),
            jsonb_build_array(-58.2, -29.52),
            jsonb_build_array(-58.2, -29.55)
          ))
        )
      )
    )
  ),
  true
) as resultado_seed_humedales;
