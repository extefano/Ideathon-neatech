---
name: pr-prep
description: Corrida completa de los quality gates locales antes de pushear o abrir PR. Usala cuando el usuario pida "preparar PR", "checklist PR", "correr gates", "verificar antes de pushear", o antes de invocar la skill create-pr.
---

# PR Prep

Corré la verificación completa de calidad en orden. Si alguno falla, parar y mostrar el output recortado para que el agente o el humano decida cómo arreglar.

## Cuándo invocarla

- "Prepará el PR" / "preparar PR".
- "Corré los checks" / "run all checks".
- Antes de invocar la skill `create-pr`.
- Cuando el usuario reporta "algo se rompió en CI pero en local pasa" (corré exactamente estos gates: CI ejecuta los mismos).

## Orden de ejecución

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

El hook `pre-push` local corre lint + typecheck + test + format (y bloquea `console.log`/`debugger` en código de app). La CI de GitHub replica todo esto más el audit de dependencias.

## Por qué este orden

1. **format:check** — Prettier; rápido y atrapa ruido.
2. **lint** — ESLint con `--max-warnings=0`.
3. **typecheck** — `tsc --noEmit`.
4. **test** — Vitest.
5. **build** — Next build (compila, typechequea rutas y prerenderiza).

## Manejo de output

Si un check falla:

- Mostrar las **primeras 20 líneas** del output (no todo el log).
- Marcar el archivo causante del error.
- Ofrecer arreglar iterativamente o parar para que el humano decida.

## Output esperado

| Gate         | Tiempo | Estado |
| ------------ | ------ | ------ |
| format:check |        |        |
| lint         |        |        |
| typecheck    |        |        |
| test         |        |        |
| build        |        |        |
| **Total**    |        |        |

Si todo pasa, recién ahí sugerir: "Listo para pushear. ¿Push directo a `main` (política del repo) o PR con `create-pr`?".

## Anti-patterns

- No skipear gates con `git push --no-verify`: el hook pre-push corre los mismos checks; mejor arreglar.
- No pushear con gates rojos "y ver qué dice la CI": la CI va a fallar igual y el deploy queda esperando.
