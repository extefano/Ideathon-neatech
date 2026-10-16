---
name: teamwork-preview
description: Equipo multi-agente inspirado en /teamwork-preview de Antigravity (entrevista de alcance, hitos, verificación adversarial y handoffs estructurados). Usala cuando el usuario pida "trabajar con subagentes", "usar un equipo de agentes", "modo teamwork", "orquestar subagentes" o dividir una tarea grande en hitos verificados.
disable-model-invocation: false
---

# Teamwork: equipo multi-agente

Adaptación del `/teamwork-preview` de Google Antigravity al flujo de subagentes
del repo (Task tool de opencode). El agente primario actúa como **Sentinel +
Project Orchestrator**: entrevista, descompone, delega, verifica y reporta.

## Cuándo activarla

- El usuario pide explícitamente subagentes, equipo de agentes, modo teamwork u
  orquestación ("trabajá con subagentes", "armá un equipo", "teamwork").
- Tarea grande: refactor multi-archivo, migración, feature con varios módulos o
  investigación abierta donde conviene dividir en hitos.
- Si el usuario pide una tarea chica y dice "mantenelo simple / enfocado", usá
  la **ruta liviana** (un Worker + Auditor), no el equipo completo.

No la actives para tareas de un solo paso: un subagente solo agrega overhead.

## Principios

1. **Specify What, Not How**: primero el brief, después el código.
2. **Nada se aprueba sin evidencia real** (salida de comandos, no promesas).
3. **Un solo escritor por archivo**: ownership exclusivo por Worker.
4. **Handoffs limpios**: cada subagente recibe solo su contexto y devuelve un
   resumen estructurado; nunca se pasa el historial completo.
5. **Adversarial por diseño**: quien implementa no verifica; quien verifica no
   implementa.

## Fase 1 — Entrevista de alcance (obligatoria)

Antes de tocar código, preguntar (con `question` cuando haya opciones):

1. **Alcance y objetivo**: qué se construye/cambia, para qué, qué queda afuera.
2. **Requisitos**: bloques acotados a lo que al usuario le importa.
3. **Verificación independiente**: por cada requisito, un comando, test, métrica
   o rúbrica objetiva (ej: `pnpm test`, `pnpm build`, script de benchmark).
4. **Criterios de aceptación**: testeables y explícitos.
5. **Modo de integridad**: `development` (default), `demo` o `benchmark`.
6. **Límites del repo**: archivos/áreas permitidas y prohibidas (ej: `prisma/`,
   `public/sw.js`, migraciones, secretos).

Con las respuestas, presentar el **brief** (prompt artifact) en el chat:
objetivo, requisitos, verificación por requisito, criterios de aceptación, modo
de integridad, hitos propuestos y ownership por hito. Pedir **una sola
aprobación explícita**. Sin aprobación no se escribe código.

## Roles y mapeo a subagentes

| Rol             | Quién               | Herramienta                                  |
| --------------- | ------------------- | -------------------------------------------- |
| Sentinel        | agente primario     | coordina, rutea, reporta avance, cierra       |
| Project Orchestrator | agente primario | descompone en hitos, asigna ownership         |
| Explorers       | subagentes read-only | `explore` (en paralelo)                      |
| Workers         | subagentes con edición | `general` (uno por workstream)              |
| Critic          | subagente read-only | `general` con mandato de review               |
| Challenger      | subagente read-only | `general` con mandato adversarial             |
| Auditor         | subagente read-only | `general`; valida evidencia real              |
| Success Auditor | subagente read-only | `general`; corrida E2E final                  |

Si existen agentes dedicados (ej: `.opencode/agent/teamwork-*`), preferilos. En
Claude Code u otras herramientas, usá el equivalente a Task con el mismo
mandato de rol.

### Prompt de handoff (obligatorio en cada Task)

Todo subagente recibe: rol, objetivo, archivos propios (exclusivos), contexto
mínimo, entregable, evidencia requerida, prohibiciones (no editar fuera de
ownership, no commitear, no tocar GitHub) y el formato de respuesta: estado,
archivos tocados, comandos ejecutados, resultados y riesgos/bloqueos.

## Fase 2 — Ejecución por hitos

Reflejar los hitos en `todowrite` y actualizar el estado en tiempo real.

Para cada hito:

1. **Explorar** (paralelo): mapear archivos, call chains y riesgos antes de editar.
2. **Implementar** (paralelo): un Worker por workstream, archivos exclusivos.
   Nunca dos Workers sobre el mismo archivo a la vez.
3. **Verificar** (en orden):
   - **Critic**: correctitud, completitud lógica, robustez, interfaces, estilo.
   - **Challenger**: tests adversariales, edge cases, caminos de falla, peores
     casos de runtime/memoria.
   - **Auditor**: contrasta la evidencia contra salida real de comandos; detecta
     tests mockeados, skipeados o fabricados.
4. **Corregir**: si un gate falla, vuelve al Worker con el hallazgo puntual.
   Máximo 2 ciclos por hito; si no converge, frenar y escalar al usuario.
5. **Cerrar el hito**: recién con evidencia adjunta. Actualizar el progress
   artifact y reportar avance al usuario.

Entre hitos, el Project Orchestrator puede resetear su propio contexto
escribiendo el estado al progress artifact y retomando desde ahí.

## Modos de integridad

| Modo                   | Permite                                                | Prohíbe                                                                                          |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `development` (default) | reutilizar libs, frameworks y código existente          | outputs fabricados y fachadas (interfaz sin implementación)                                       |
| `demo`                 | lo anterior                                            | copiar lógica core de OSS, delegar el core a herramientas externas, leer tests para reverse-engineer |
| `benchmark`            | solo stdlib / implementación desde cero                | todo lo anterior; la verificación corre contra ground truth real                                  |

El Auditor aplica el modo elegido y lo deja escrito en el brief.

## Aislamiento y artefactos

- Artefactos fuera del repo: `%TEMP%\opencode\teamwork\<slug>\` (o
  `$TMPDIR/opencode/teamwork/<slug>` fuera de Windows) con `plan.md`,
  `progress.md`, `evidence/` y `scratch/<rol>/`.
- Los cambios de código van directo al repo con ownership exclusivo; el resto
  del repo queda congelado salvo indicación del usuario.
- Cada subagente escribe sus notas y logs en su scratch, no en la raíz del repo.
- El estado vive en `progress.md`: permite pausar y reanudar sin perder el hilo.
- **No commitear, no pushear, no crear issues** salvo pedido explícito. Al
  cerrar, correr los gates del repo (`pnpm verify`; `pnpm build` si toca
  runtime) y ofrecer commit/PR vía `commit-conventional` y `create-pr`.

## Cierre

1. **Success Auditor**: corrida E2E contra los criterios de aceptación del brief,
   uno por uno, con la salida real como evidencia.
2. **Sentinel** presenta: qué cambió, archivos, evidencia, riesgos/pendientes y
   próximo paso sugerido. Todo en español.

## Reglas duras

- La evidencia es salida real de comandos; nunca inventar ni resumir de memoria.
- Un solo escritor por archivo; si dos tracks chocan, el Orchestrator re-secuencia.
- Los subagentes no commitean, no pushean, no crean issues ni comentan en GitHub.
- No saltar la Fase 1: sin brief aprobado no hay Fase 2.
- Si algo no converge en 2 ciclos, escalar al humano en vez de insistir.
- Respetar las reglas del repo (`AGENTS.md`) aunque el equipo opere en paralelo.
