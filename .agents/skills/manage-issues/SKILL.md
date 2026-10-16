---
name: manage-issues
description: Estandariza la creación, descomposición, triage y agrupación de GitHub Issues del proyecto Ideathon Neatech. Usala al planificar trabajo grande, reportar un bug, registrar trabajo emergente o actualizar el tablero.
---

# Manage GitHub Issues

## Objetivo

Convertir trabajo conversado en issues chicos, verificables y publicados con el mismo criterio, sin importar qué agente o humano inicia el flujo.

Fuentes de verdad:

- Issue tracker: `docs/agents/issue-tracker.md` (GitHub + `gh`).
- Vocabulario de labels: `docs/agents/triage-labels.md`.
- Dominio: `GLOSSARY.md`; flujo de negocio: `docs/flujo-completo.md`; convenciones: `AGENTS.md`.

## Cuándo intervenir

1. **Planning**: hay una feature o plan aprobado que debe dividirse y publicarse.
2. **Bug**: aparece un defecto que no se resuelve de inmediato.
3. **Trabajo emergente**: dependencia, deuda o tarea fuera del alcance actual que no se resolverá en los próximos 15 minutos.
4. **Triage**: un issue sin labels o sin estado claro.

No abras un issue por un arreglo trivial que ya se está resolviendo y no bloquea a nadie.

## Reglas duras

- Títulos, cuerpos y comentarios en español. Título corto e imperativo, sin prefijos tipo `[task]` (la clasificación va en labels).
- Labels literales del vocabulario del repo: `ticket`, `epic`, `area:db`, `area:lib`, `area:ui`, `area:api`, `blocked`, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
- Un ticket ejecutable dura como máximo ~2 h y apunta a no más de 5 archivos. Si excede eso o tiene entregables independientes, proponé un épico (`epic`) con tickets hijos.
- Labels clasifican; el estado lo da el cierre del issue. No crees labels de estado (`in-progress`, `done`).
- **Crear o comentar un issue publica contenido externo.** Mostrá una preview completa y pedí una sola confirmación para el lote, salvo que el usuario haya autorizado explícitamente esa publicación en el pedido actual.
- Nunca pongas secretos ni logs sensibles en el cuerpo.

## Pre-flight

```bash
gh auth status
gh repo view --json nameWithOwner,hasIssuesEnabled
gh label list
```

## 1. Detectar duplicados

```bash
gh issue list --state all --limit 100 --json number,title,body,state,labels,url
```

Normalizá mentalmente el título (minúsculas, sin puntuación) y compará objetivo, área y referencias. Si existe un candidato razonable: mostrar URL y diferencia, y proponer reutilizarlo o reabrirlo antes de crear otro.

## 2. Descomponer

Secciones sugeridas del body:

- **Contexto / objetivo** (con términos del `GLOSSARY.md`).
- **Alcance** (paths previstos).
- **Criterios de aceptación** (checklist observable, mínimo 3 ítems).
- **Dependencias** (`Part of #N`, `Blocked by: #N`).
- **Estimación** (15 min / 30 min / 1 h / 2 h).
- **Estrategia** (push directo a `main` o rama + PR).

Sub-issues con `gh issue edit <padre> --add-sub-issue <hijo>` (si la versión de `gh` lo soporta). Fallback: línea `Part of #N` en el hijo y un comentario con el plan y la lista de tickets en el padre.

## 3. Clasificar

- Exactamente un tipo: `ticket` (implementación) o `epic` (agrupa varios tickets).
- Al menos un `area:*` principal: `area:ui`, `area:api`, `area:db`, `area:lib`.
- `needs-triage` si es un bug sin reproducción o evidencia; `blocked` solo mientras exista un impedimento concreto; `ready-for-agent` cuando el ticket está especificado para un agente AFK.

## 4. Preview obligatoria (antes de publicar)

| Campo          | Contenido                        |
| -------------- | -------------------------------- |
| Título         | verbo + objeto                   |
| Criterios      | checklist observable             |
| Labels         | exactas                          |
| Dependencias   | padre / bloqueos                 |
| Estimación     | rango                            |

Para lotes: agregar orden de creación y relaciones, y pedir una sola confirmación para todo.

## 5. Crear y vincular

```bash
gh issue create --title "<título>" --body-file <tmp> --label ticket --label area:ui --label ready-for-agent
```

Eliminá el temporal al terminar. Reportá siempre las URLs creadas. Si un comando falla, mostrá el error literal y no afirmes que el recurso se creó.

## 6. Avance

- Al tomar la tarea: comentario breve de "tomado" (sin labels de estado).
- Al cerrar: commit conventional con `closes #N` + comentario con evidencia (tests, screenshots del navegador de Orca, tx hashes).
- Si se bloquea más de 15 min: label `blocked` + comentario con lo que falta; quitar la label al destrabar.
