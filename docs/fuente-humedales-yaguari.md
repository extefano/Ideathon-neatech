# Fuente real publicada: INH — sitio piloto Arroyo Yaguarí

Primera capa **oficial y real** cargada en el sistema. Reemplaza a los datos
sintéticos como fuente principal (la DEMO queda publicada, sin ser principal,
para fixtures locales).

## Qué se cargó

- **Capa**: `recursos_acuaticos:unidades_humedales_yaguari` del GeoServer de la
  Subsecretaría de Ambiente (`geo.ambiente.gob.ar/geoserver/ows`, WFS).
- **Origen**: Inventario Nacional de Humedales — **sitio piloto cuenca del
  Arroyo Yaguarí** (centro-sur de Corrientes, departamentos Mercedes y Curuzú
  Cuatiá), proyecto FICH-UNL / SAyDS (2017).
  Citación: Rodríguez et al. (2021), _Boletín Geológico y Minero_ 132(1-2).
- **Contenido importado**: 627 unidades de humedal — 533 corredores ribereños,
  64 tajamares, 18 arroceras, 10 embalses, 2 planicies de inundación.
- **Registro**: fuente `INH / piloto-arroyo-yaguari / v1`, principal y
  publicada en local y en el proyecto remoto, con URL, licencia, atribución,
  escala (Nivel 3 INH) y checksum del GeoJSON importado.

## Cobertura (evaluada, real y citable)

No existe una capa oficial del "área de estudio" del piloto. Para no inventar
una cobertura se usó un límite de cuenca real y reproducible:

- **HydroBASINS v1c nivel 12** (Lehner & Grill 2013, hydrosheds.org): unión de
  las 16 celdas aguas arriba del punto de salida `HYBAS_ID 6120846200` →
  **2238,0 km²**, geometría válida (277 vértices).
- Contiene **624 de las 627** unidades. Las 3 restantes quedan fuera de la
  cobertura: un lote que las solape se informa como _cobertura parcial_
  (conservador: nunca un falso cero).
- El informe del sitio piloto describe 1571 km² (método y época distintos); la
  subcuenca HydroBASINS es más amplia, y se eligió porque **contiene la
  evidencia publicada** y evita falsos negativos.
- Archivo versionado:
  `supabase/fixtures/inh-yaguari/cobertura-cuenca-hydrobasins-lev12.geojson`.

## Reparaciones registradas (no silenciosas)

4 unidades traían autointersección en la fuente oficial (idx 597 corredor
ribereño; 611, 616 y 627 arroceras). Se corrigieron con
`ST_MakeValid` + `ST_CollectionExtract(polygonal)` (PostGIS 3) y se revalidaron
contra la restricción de la tabla. Registro:
`supabase/fixtures/inh-yaguari/unidades-reparadas.json`.

## Verificación (evidencia real, local y remoto idénticos)

| Caso                                                    | Resultado                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Polígono demo de Mercedes (‑58,10‑29,50 → ‑58,04‑29,45) | `VERIFICADO` **28,269273 %** · 911,7464 ha · 51 unidades intersectadas · fuente `piloto-arroyo-yaguari` |
| Caja seca dentro de la cuenca (‑57,90‑29,40)            | `VERIFICADO` **0 %** (cero real con cobertura completa)                                                 |
| Caja fuera de la cuenca (‑57,40‑29,60)                  | `COBERTURA_PARCIAL`, porcentaje `null`                                                                  |

## Cómo reimportar (reproducible)

```powershell
# 1. Descargar la capa oficial (WFS → GeoJSON)
curl.exe -s -L "https://geo.ambiente.gob.ar/geoserver/ows?service=wfs&version=2.0.0&request=GetFeature&typeName=recursos_acuaticos:unidades_humedales_yaguari&outputFormat=application/json&srsName=EPSG:4326" -o unidades.json

# 2. Normalizar (featureRef + clase=nombre) y reparar las 4 inválidas con PostGIS
#    (ver unidades-reparadas.json; validación: st_isvalid sobre las 627)

# 3. Importar y publicar (usa .env.local → proyecto remoto; para local,
#    sobreescribir SUPABASE_URL/SUPABASE_SECRET_KEY con `supabase status -o env`)
node scripts/importar-humedales.mjs ^
  --archivo unidades-inh-yaguari.geojson ^
  --cobertura supabase/fixtures/inh-yaguari/cobertura-cuenca-hydrobasins-lev12.geojson ^
  --proveedor INH --dataset piloto-arroyo-yaguari --version 1 ^
  --clases "corredor ribereño,tajamar,arrocera,embalse,planicie de inundación" ^
  --escala "Nivel 3 INH (unidades de humedal)" ^
  --url "https://geo.ambiente.gob.ar/geoserver/ows?service=WFS&typeName=recursos_acuaticos:unidades_humedales_yaguari" ^
  --licencia "Datos públicos - Subsecretaría de Ambiente de la Nación (SINIA/CIAM)" ^
  --atribucion "INH - sitio piloto cuenca del A° Yaguarí (FICH-UNL / SAyDS, 2017)" ^
  --principal --publicar
```

## Limitaciones

- Los datos son de **2017** (el INH es un proceso progresivo): no hay
  actualización anual como en MapBiomas.
- La cobertura es una **cuenca modelada** (HydroBASINS), no el polígono exacto
  del informe del piloto.
- MapBiomas queda como fuente alternativa/complementaria (ráster 30 m, CC BY
  4.0), documentado para una futura colección vectorizada.
- El porcentaje es un **atributo informativo del lote** (ADR-0002): no se ancla
  on-chain, no condiciona el Sello 1 y no implica cumplimiento EUDR.
