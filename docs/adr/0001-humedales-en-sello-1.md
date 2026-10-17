# ADR 0001 — El reporte de humedales se ancla dentro del Sello 1

Fecha: 2026-10-17
Estado: **superseded por ADR-0002** (el porcentaje de humedal es un atributo informativo del lote y no se ancla on-chain)

## Contexto

Los compradores necesitan saber qué proporción del campo donde se cría el lote
corresponde a humedales, y esa evidencia debe ser auditable e inmutable como el
resto del origen. El contrato `trazabilidad` ya ancla un hash de origen
(`eudr_geo_hash`) al emitir el Sello 1 y no expone una función de upgrade.

## Decisión

1. **Sin cambio de ABI**: el compromiso del origen pasa de un JSON ad-hoc a un
   manifiesto versionado (`muunar.origen.v2`) que incluye
   `humedales.sha256` (SHA-256 del reporte canónico). Soroban sigue recibiendo
   un único hash por `create_and_verify_origin`.
2. **Sin cuarto sello**: el porcentaje de humedal es informativo y no condiciona
   por sí solo el origen ni introduce umbrales de rechazo.
3. **Una fuente principal versionada**: INH o MapBiomas según aptitud predial,
   con cobertura observacional explícita. Los estados `SIN_DATOS`,
   `COBERTURA_PARCIAL` y `ERROR_CONSULTA` se publican como "sin dato" y quedan
   igualmente comprometidos por el manifiesto.
4. **Método único**: overlay y superficie en EPSG:6933 con unión previa para
   evitar doble conteo.

## Consecuencias

- Los lotes anteriores a esta funcionalidad mantienen su hash de origen legacy
  y se muestran como "sin dato"; no se reinterpretan ni se recalculan solos.
- Si el flujo necesita anclar humedales aunque GFW rechace el lote (o antes del
  Sello 1), hará falta una operación contractual nueva: esta decisión la deja
  fuera de alcance a propósito.
- Activar una fuente nueva no altera reportes ya anclados.
