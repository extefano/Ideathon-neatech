# GLOSSARY.md — Vocabulario del dominio

Términos canónicos del proyecto. Usar estos nombres en código, issues, tests y UI.

## Actores

- **Productor**: dueño del ganado; registra el lote y recibe los desembolsos del escrow en su wallet Stellar (Freighter).
- **Comprador**: frigorífico exportador o inversor agro; fondea el escrow y confirma la recepción final.
- **Frigorífico**: planta de faena/exportación que recibe la tropa; opera como Comprador en el Paso 4.
- **Veterinario acreditado**: profesional SENASA con wallet propia; único autorizado a cargar la auditoría del Mes 4 (el productor tiene prohibido ese paso).
- **Oráculo / Admin**: cuenta del backend que firma las transacciones de registro y verificación (Paso 1).

## Documentos e identificadores

- **RENSPA**: código oficial del establecimiento (formato `XX.XXX.X.XXXXX/XX`, ej. `05.077.0.00412/00`).
- **Caravana RFID**: identificador electrónico de 15 dígitos que empieza con `032` (prefijo Argentina, ISO 11784/11785).
- **Boleta de Marca y Señal**: documento provincial que respalda la marca del ganado.
- **Acta de vacunación**: documento oficial SIGSA/SENASA cargado por el veterinario en el Mes 4.
- **DT-e**: Documento de Tránsito Electrónico de SENASA; ampara el traslado del campo al frigorífico.
- **Balanza fiscal**: balanza oficial del frigorífico donde se pesa la recepción.
- **Ticket de balanza / romaneo**: constancia de pesaje emitida por el frigorífico.

## Flujo y estados

- **Lote**: unidad de trazabilidad (tropa de animales + documentos + condiciones comerciales). Tabla `lotes`.
- **Sello 1 (Origen Libre de Deforestación)**: verificación EUDR del polígono contra GFW + anclaje de hashes.
- **Sello 2 (Sanidad y Engorde)**: auditoría del Mes 4 (vacunación + pesada) validada con ADPV.
- **Sello 3 (Cierre y Recepción)**: recepción en frigorífico y liquidación final.
- **Estado de origen**: ciclo de vida del anclaje del Sello 1: `PENDIENTE` → `PREPARADO` (manifiesto y raíz persistidos antes de enviar) → `ENVIADO` → `CONFIRMADO` (red real) o `DEMO` (cliente fake). `RECHAZADO` (deforestación) y `CONFLICTO` (raíz on-chain distinta de la preparada) son terminales y congelan la evidencia; un reintento reutiliza el manifiesto preparado y nunca lo regenera.
- **Hito**: etapa del contrato de financiación. Desembolsos: 40% (Hito 1, al fondear), 30% (Hito 2, Mes 4), 30% (Hito 3, recepción).
- **Escrow**: contrato inteligente en Soroban que retiene los USDC/EURC y libera por hitos.
- **Pasaporte digital EUDR**: página pública con QR (`/pasaporte/[codigo_lote]`) con las 3 pruebas on-chain y el legajo.
- **Modo demo**: cuando una integración (Soroban, Freighter) corre con implementación fake documentada; nunca presentarlo como real.

## Métricas biológicas

- **ADPV**: Aumento Diario de Peso Vivo = (peso actual − peso anterior) / días. Rango válido INTA Corrientes: 0,5 a 1,3 kg/día.
- **Uniformidad**: clasificación del lote por coeficiente de variación de pesos: Parejo (<10%), Bastante parejo (10-20%), Desparejo (>20%).
- **Desbaste**: pérdida de peso esperada entre campo y balanza fiscal (porcentaje informativo).
- **Peso objetivo**: peso promedio comprometido al final del ciclo (ej. 460 kg). El tramo final se ajusta proporcionalmente si falta.

## Verificación

- **EUDR**: Reglamento (UE) 2023/1115; exige origen libre de deforestación posterior al 31/12/2020.
- **GFW**: Global Forest Watch (`data-api.globalforestwatch.org`), dataset `umd_tree_cover_loss`; pérdida arbórea ≥ 2021 en el polígono = rechazo.
- **Porcentaje de humedal**: proporción (0–100 %) del polígono del establecimiento clasificada como humedal por la fuente principal, calculada en PostGIS (EPSG:6933, unión previa sin doble conteo). Se almacena con 6 decimales y un recorte positivo nunca se reporta como 0 (piso 0,000001 %). Es un **atributo informativo del lote**: no se ancla on-chain ni condiciona el Sello 1.
- **Fuente de humedales versionada**: producto oficial o científico (INH, MapBiomas) con versión, clases, escala y cobertura observacional propias. Una versión publicada es inmutable; los datos de desarrollo se marcan como demo.
- **Sin dato de humedal**: resultado explícito (`SIN_DATOS`, `COBERTURA_PARCIAL`, `ERROR_CONSULTA`) cuando el 0 % no puede afirmarse. Jamás se muestra como cero.
- **Reporte de humedales**: documento canónico `muunar.humedal.v1` con geometría normalizada, métricas y fuente. Se persiste como snapshot con su SHA-256 como integridad interna del atributo; **no se ancla on-chain**.
- **Manifiesto de origen v2**: documento `muunar.origen.v2` (código, polígono normalizado y consulta GFW) cuya raíz SHA-256 es el `eudr_geo_hash` que recibe Soroban en el Sello 1. No incluye atributos informativos como humedales (ADR-0002).
- **Hash SHA-256**: huella del contenido de un archivo (PDF/CSV) anclada on-chain; permite detectar alteraciones pero no prueba veracidad.
- **Taxonomía de estados**: `CARGADO`, `VALIDADO_POR_PLATAFORMA`, `CONTRASTADO_CON_FUENTE_OFICIAL`, `REGISTRADO_EN_BLOCKCHAIN`, `PAGO_LIBERADO`.

## Certificaciones comerciales voluntarias (Eje 2)

- **Eje 1 (Acceso aduanero obligatorio)**: los 3 sellos obligatorios (identidad RFID individual, tránsito oficial RENSPA/DT-e de SENASA y polígono libre de deforestación EUDR post 31/12/2020). Sin ellos no hay exportación legal a la Unión Europea.
- **Eje 2 (Agregado de valor comercial voluntario)**: certificaciones y mediciones privadas/independientes que **no reemplazan** los 3 sellos del Eje 1, pero actúan como preferencias de compra para frigoríficos exportadores e importadores (UE / Mercosur) y habilitan precios _premium_ en góndola.
- **Huella de Carbono e Inventario GEI — Sinergia Medio Ambiente (`HUELLA_CARBONO_SINERGIA`)**: medición de inventario biológico de gases de efecto invernadero y diseño de planes de mitigación (pastoreo rotativo, manejo silvopastoril) bajo **ISO 14064 / ISO 14067** y GHG Protocol, con auditoría independiente (IRAM, SGS, Control Union). Aporta diferencial ESG comercial sin sustituir el control satelital EUDR.
- **Bienestar Animal Certificado (`BIENESTAR_ANIMAL`)**: certificación bajo **ISO 34700 / Welfare Quality** (sellos **Welfair** en UE/Latam e **ITW / QS** en Alemania), auditada por IRAM, OIA o Control Union; garantiza trato ético del ganado libre de dolor, estrés y transporte controlado.
- **Libre de Antibióticos y Promotores Hormonales (`LIBRE_ANTIBIOTICOS_HORMONAS`)**: certificación bajo **Protocolo Cuota Hilton / Mercado UE** avalada por SENASA e inspeccionada por OIA / LSQA; garantiza crianza sin promotores de crecimiento hormonales ni uso preventivo/subterapéutico de antibióticos.
