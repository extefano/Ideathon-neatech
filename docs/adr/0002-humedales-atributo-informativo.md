# ADR 0002 — El porcentaje de humedal es un atributo informativo del lote

Fecha: 2026-10-17
Estado: aceptado (supersede al ADR-0001)

## Contexto

El ADR-0001 incluyó el hash del reporte de humedales dentro del manifiesto de
origen del Sello 1. El producto lo revirtió: el porcentaje de humedal **no**
responde a una regulación como EUDR — es información del establecimiento
(hay compradores que buscan o evitan campos con humedal), por lo que no debe
presentarse como evidencia anclada ni verificarse contra la cadena.

## Decisión

1. El **manifiesto de origen v2** (`muunar.origen.v2`) compromete únicamente
   código, polígono normalizado y consulta GFW. **No incluye** el reporte de
   humedales.
2. El reporte se conserva como **snapshot interno del atributo**
   (`verificaciones_humedal` + columnas espejo en `lotes`) con su SHA-256 para
   detectar ediciones en la base — nunca para verificación on-chain.
3. Se eliminan los artefactos de anclaje: verificador de humedales, API de
   integridad y descargas del reporte/manifiesto. La UI presenta el atributo
   (porcentaje, fuente, estado) en mercado, ficha y pasaporte, sin lenguaje de
   "Sello", "anclaje" ni "contrato".
4. El Sello 1 sigue anclando el origen EUDR (polígono + GFW) como antes.

## Consecuencias

- Los lotes nuevos no comprometen humedales on-chain; una revisión del atributo
  no afecta el origen anclado.
- El trigger vigente aún congela los campos de humedales tras el Sello 1
  (estricto por diseño); si el negocio necesitara corregir el atributo en un
  lote ya sellado, se hará una migración explícita que lo permita.
- `hash_verificacion_humedal` queda como integridad interna del snapshot del
  atributo.
