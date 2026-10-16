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
- **Hash SHA-256**: huella del contenido de un archivo (PDF/CSV) anclada on-chain; permite detectar alteraciones pero no prueba veracidad.
- **Taxonomía de estados**: `CARGADO`, `VALIDADO_POR_PLATAFORMA`, `CONTRASTADO_CON_FUENTE_OFICIAL`, `REGISTRADO_EN_BLOCKCHAIN`, `PAGO_LIBERADO`.
