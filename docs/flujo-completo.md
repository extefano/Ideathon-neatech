# Flujo completo del sistema

Este documento describe el flujo de punta a punta del sistema, siguiendo el recorrido de los datos y documentos desde que el productor registra el ganado hasta que el frigorífico confirma la recepción y se libera el último pago.

## 1. El productor registra el lote

**Origen:** productor y documentación del establecimiento.

El productor carga en el sistema:

- **RENSPA:** obtiene la constancia mediante los canales oficiales de SENASA y la adjunta.
- **Cantidad de animales:** informa cuántos tiene y aporta la documentación disponible.
- **Identificación electrónica:** registra los números de los dispositivos RFID de los animales.
- **Campo:** dibuja o carga el polígono geográfico del establecimiento.
- **Financiación:** solicita, por ejemplo, 10.000 USDC.

**¿Qué hace la app?**

Recibe los datos y archivos, los guarda y crea una solicitud **pendiente de validación**. Que el productor los cargue no significa que ya estén verificados.

---

## 2. El sistema evalúa el riesgo ambiental

**Origen:** Global Forest Watch (GFW) y ubicación del campo.

1. El backend envía el polígono del campo a una fuente compatible de datos ambientales.
2. Consulta la información disponible sobre pérdida de cobertura forestal desde la fecha definida por el proyecto.
3. Calcula el porcentaje de humedal del establecimiento contra una capa oficial versionada (INH/MapBiomas) y lo deja disponible para el comprador.
4. Guarda el resultado, la fecha de consulta, la fuente y los criterios utilizados.

**Resultado:** el lote recibe una evaluación ambiental que podrá revisar el comprador. El porcentaje de humedales se informa como dato estructural: si la capa no cubre el campo o el cálculo no está disponible, se muestra **"sin dato"** (jamás un cero inventado).

> **Importante:** una consulta sin alertas no demuestra por sí sola el cumplimiento de toda la normativa ambiental.

---

## 3. El veterinario valida el lote

**Origen:** sistemas y documentos oficiales de SENASA, más lecturas de dispositivos.

### A. Verificación del establecimiento y la documentación

- Revisa la constancia de RENSPA y contrasta los datos con los canales oficiales disponibles.
- Revisa la documentación que respalda la existencia y situación del ganado.

### B. Identificación y peso inicial

- Lee los dispositivos RFID de los animales.
- Obtiene los pesos desde la balanza o el sistema utilizado.
- Exporta un CSV si el equipo lo permite, o prepara un archivo con el formato requerido por la plataforma.

### C. Carga de evidencias

- Sube al sistema los documentos de respaldo y el archivo de identificaciones y pesos.
- Revisa los datos y confirma la validación desde su cuenta.

**¿Cómo sabemos que está validado?**

La app registra quién lo aprobó, cuándo, qué evidencias revisó y qué resultado dio. El sistema puede verificar formatos y consistencia, pero la revisión humana no equivale automáticamente a una certificación de SENASA.

> El CSV es un archivo de integración del sistema, no necesariamente un documento oficial de SENASA. La disponibilidad de consultas o exportaciones oficiales debe confirmarse.

---

## 4. Se publica el lote y el comprador financia

**Origen:** datos validados y contrato inteligente en Stellar Soroban.

1. Una vez aprobados los controles requeridos, el lote se publica en el marketplace.
2. El comprador revisa la información, las evidencias y el estado ambiental.
3. El comprador deposita 10.000 USDC en el mecanismo de escrow del contrato inteligente.
4. El contrato libera el primer 40% (4.000 USDC) al productor y mantiene el resto condicionado a los hitos.

> En la demo, los pagos se pueden ejecutar en Stellar Testnet con USDC de prueba, aclarando que no es dinero real.

---

## 5. Control del mes 4: vacunación y evolución del ganado

**Origen:** vacunador acreditado, SIGSA, lecturas RFID y pesos.

1. El vacunador realiza la vacunación y registra el acto según el procedimiento oficial correspondiente en SIGSA.
2. Obtiene el acta o constancia disponible y la adjunta a la plataforma.
3. Se vuelven a leer los RFID y se cargan los nuevos pesos.
4. El backend compara los identificadores con el lote inicial y comprueba faltantes, duplicados y variaciones de peso.
5. El veterinario revisa las evidencias y aprueba el hito.

**Liberación del segundo pago**

Si se cumplen las condiciones del contrato, Soroban libera el 30% correspondiente a este hito: **3.000 USDC**.

---

## 6. Mes 8: traslado y recepción en el frigorífico

**Origen:** productor, SENASA y frigorífico.

### A. El productor prepara el traslado

- Gestiona el DT-e mediante el canal oficial habilitado de SENASA/SIGSA.
- Adjunta el documento a la plataforma.

### B. El frigorífico verifica la recepción

- Compara el DT-e con el envío recibido.
- Controla las identificaciones RFID y los pesos según el procedimiento acordado.
- Confirma la recepción desde su cuenta y adjunta la evidencia correspondiente.

### C. La app registra el cierre

- Guarda quién confirmó la recepción, cuándo y qué documentos respaldan la operación.
- Si existe un mecanismo oficial disponible, puede contrastar el estado del movimiento; no debe asumir que basta con subir un archivo.

**Liberación del último pago**

Cuando se cumple el hito de recepción definido en el contrato, Soroban libera el 30% final: **3.000 USDC**.

---

## 7. Se genera el pasaporte digital del lote

El sistema crea un QR que permite consultar la trazabilidad del lote:

- Identificación del lote y sus hitos.
- Evidencias y estados de validación disponibles para consulta.
- Historial de eventos y referencias a las transacciones en Stellar.
- Confirmación de recepción final.

> Los documentos completos se guardan fuera de la blockchain, con acceso restringido. En Stellar se registran los datos mínimos necesarios, hashes y eventos del contrato; un hash permite detectar cambios en un archivo, pero no demuestra que su contenido sea verdadero.

---

## ¿Cómo viaja la información hasta la blockchain?

1. **Fuentes externas**
   - SENASA / SIGSA.
   - Global Forest Watch (GFW).
   - Lector RFID.
   - Balanza.
   - Usuarios.

2. **Frontend del sistema**
   - Formularios.
   - Carga de documentos.
   - Estados y aprobaciones.

3. **Backend + Supabase**
   - Almacena archivos y metadatos.
   - Valida formatos y consistencia.
   - Registra responsables.
   - Calcula hashes.

4. **Contrato inteligente en Stellar Soroban**
   - Registra hitos, autorizaciones y referencias a evidencias.
   - Administra los pagos condicionados.

---

## ¿Qué significa cada estado?

| Estado en el sistema               | Qué significa                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Cargado**                        | El usuario adjuntó datos o documentos. Todavía no fueron aprobados.                                                   |
| **En revisión**                    | Está pendiente el control del responsable correspondiente.                                                            |
| **Validado por la plataforma**     | Se realizaron los controles definidos y un usuario autorizado aprobó el hito.                                         |
| **Contrastado con fuente oficial** | Se comprobó el dato con una fuente o mecanismo oficial disponible y se registró la evidencia.                         |
| **Registrado en blockchain**       | Se registró el evento o su referencia en Stellar. No significa que la información original sea verdadera por sí sola. |
| **Pago liberado**                  | El contrato ejecutó el pago porque se cumplieron las condiciones programadas.                                         |

## Consideración clave

El sistema no debería indicar que un dato está «validado por SENASA» solamente porque un veterinario subió un documento y lo aprobó. Debe indicar si fue cargado por un usuario, revisado por un profesional o contrastado efectivamente con una fuente oficial.
