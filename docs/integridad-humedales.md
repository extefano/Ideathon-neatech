# Integridad de humedales

Cómo se calcula, se informa y se ancla el **porcentaje de humedal** de un lote.

## Fuente de datos

- La fuente real publicada actualmente es el **INH — sitio piloto cuenca del
  Arroyo Yaguarí** (Corrientes, 627 unidades, publicada en local y remoto como
  principal). Procedencia, cobertura, reparaciones y reimportación:
  `docs/fuente-humedales-yaguari.md`.
- Se usa **una fuente principal versionada** (`fuentes_humedales`): un producto
  concreto (INH o MapBiomas), con cobertura observacional propia y estado de
  publicación. Otras fuentes pueden cargarse para consulta, pero **no se unen
  clasificaciones distintas** en el mismo porcentaje.
- Una versión publicada es **inmutable**: para reimportar hay que subir la
  versión. La publicación es atómica y exige geometría de cobertura.
- Datos sintéticos de desarrollo se cargan con `esDemo = true` y se muestran
  como "Datos de demostración". Nunca se presentan como fuente oficial.

## Cálculo (método v1)

- Entrada: GeoJSON `Polygon` (el cliente normaliza `Feature` antes de enviar).
- Validación en PostGIS: tipo, anillos, validez topológica, área positiva y
  bounding box de Argentina. Un polígono inválido **se rechaza; no se repara**.
- Superficie: proyección equivalente **EPSG:6933** (lambert cylindrical equal
  area). Numerador y denominador usan el mismo modelo, con aristas rectas en el
  CRS de cálculo. No se mide en grados cuadrados.
- Intersección: pre-filtro por bounding box en 4326 (índice GIST) y overlay en 6933. Los recortes positivos se **unifican antes de medir** (`ST_UnaryUnion`):
  features superpuestas o duplicadas no cuentan dos veces.
- Porcentaje: `100 × área(humedal ∩ lote) / área(lote)`, `numeric(0–100)` con 6
  decimales de almacenamiento (un recorte positivo nunca se colapsa a 0: piso
  documentado de `0,000001 %`). La UI muestra 2 decimales; un positivo ínfimo se
  presenta como `<0,01 %`. Nunca se convierte en booleano.

## Estados (nunca "cero" para "desconocido")

| Estado              | Significado                               | `porcentaje_humedal` |
| ------------------- | ----------------------------------------- | -------------------- |
| `VERIFICADO`        | Cobertura completa; el 0 es un cero real. | 0–100                |
| `SIN_DATOS`         | No hay fuente principal publicada.        | `null`               |
| `COBERTURA_PARCIAL` | El lote sale de la cobertura observada.   | `null`               |
| `ERROR_CONSULTA`    | El motor espacial no respondió.           | `null`               |
| (legacy)            | Lote anterior a esta funcionalidad.       | `null` sin estado    |

La indisponibilidad del cruce ambiental **no** exime de la validación
geométrica: un polígono inválido siempre se rechaza.

## Reporte canónico del atributo (sin anclaje)

- El servidor construye `ReporteHumedalV1` (`muunar.humedal.v1`) con la
  geometría normalizada, métricas como textos decimales, fuente, método y un
  `calculadoEn` UTC. Se serializa con la **canonicalización v1** (claves
  ordenadas recursivamente, sin espacios; ver `lib/json-canonico.ts`), se
  persisten los **bytes exactos**
  (`verificaciones_humedal.reporte_canonico`) y su SHA-256 como **integridad
  interna del snapshot** para detectar ediciones en la base.
- El **manifiesto de origen v2** (`muunar.origen.v2`) del Sello 1 compromete
  código, polígono y GFW, **sin** el reporte de humedales (ver ADR-0002): el
  porcentaje es un atributo informativo y no se verifica contra la cadena.
- Los lotes solo pueden referenciar una verificación cuyos valores y geometría
  coincidan (trigger de consistencia) y los snapshots son inmutables.
- Presentación pública: porcentaje, fuente y estado en mercado, ficha y
  pasaporte, sin lenguaje de anclaje ni contrato.

## Estado del origen y reconciliación

- El anclaje sigue una máquina de estados explícita en `lotes.origen_estado`:
  `PENDIENTE` → `PREPARADO` (manifiesto y raíz persistidos **antes** de enviar)
  → `ENVIADO` (marcado antes de firmar) → `CONFIRMADO` (red real) o `DEMO`
  (cliente fake). `RECHAZADO` (deforestación) y `CONFLICTO` son terminales.
- Un reintento **nunca regenera** el manifiesto preparado: reutiliza sus bytes,
  su raíz y su timestamp, sin volver a consultar GFW para reemplazarlo.
- Si un envío quedó incierto, la reconciliación consulta `get_lote` en el
  contrato: raíz igual → confirma sin reenviar; lote inexistente → reenvía desde
  la preparación; raíz distinta → persiste `CONFLICTO` y bloquea reintentos
  automáticos hasta revisión manual.
- Sin contrato configurado (modo demo) no hay cadena que consultar: un `ENVIADO`
  se reenvía de forma segura porque el envío local es determinista.
- Un hash de transacción no es prueba de éxito: el wrapper de invocación exige
  que la red confirme la transacción como exitosa antes de emitir el sello.
- El reintento exige titularidad del lote (`creado_por`) y que el alta esté
  completa (caravanas y su hash); las altas a medias se limpian y no se anclan.
- `anclaje_estado` distingue `CONFIRMADO` (red real), `DEMO` (cliente fake),
  `PENDIENTE` y `CONFLICTO`. El modo real mal configurado **falla explícito**
  en vez de caer silenciosamente a fake.

## Limitaciones

- El porcentaje es un dato estructural de la capa y su versión: no es humedad
  instantánea, riesgo de inundación ni certificación legal.
- Un hash detecta alteraciones; no prueba la veracidad de la fuente.
- El INH es un proceso progresivo con distintas escalas: la aptitud predial de
  cada capa se documenta en la procedencia antes de publicarla.
