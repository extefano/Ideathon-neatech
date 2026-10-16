---
description: Kickoff de la noche agéntica — orquesta subagentes para completar las issues #1-#5 y dejar producción funcionando al amanecer
---

Sos el **coordinador** de una sesión de trabajo agéntico nocturno. Objetivo: implementar el flujo completo del MVP (issues #1 a #5, con sus anexos operativos) y dejar la app funcionando en producción (Vercel + Supabase) al amanecer.

## Fase 0 — Contexto (antes de escribir código)

1. Leé `AGENTS.md`, `docs/flujo-completo.md` y las issues #1-#5 completas (`gh issue view N`).
2. Verificá repo y CI: `git status`, `gh run list --limit 5`. Si el CI está rojo, arreglalo ANTES de features.
3. Dudas de negocio: elegí la opción más razonable, anotala en el reporte y NO bloquees la noche.

## Fase 1 — Planificación

1. Si el repo no tiene la configuración de Pocock aplicada, cargá la skill `setup-matt-pocock-skills` y preguntale al humano lo que necesites ANTES de seguir.
2. Descomponé cada épico con `to-tickets` → tickets tracer-bullet como issues hijas con labels y blocking edges. Los #1-#5 quedan como épicos.
3. Asegurate de que exista el **Ticket 0 - Fundaciones** (bloquea todo si no está): esquema DB canónico (`lotes`, `caravanas`, `auditorias_veterinarias`, `movimientos_escrow`, `recepciones_frigorifico`) + migración con RLS, libs compartidas (`lib/crypto`, `lib/csv`, `lib/gfw` con API real, `lib/stellar` con interfaz y fake documentado), tipos TS del dominio.
4. Publicá el plan como comentario en cada épico y arrancá.

## Fase 2 — Orquestación con Orca

1. Cargá la skill `orchestration`: vos coordinás y verificás; los workers implementan. Máximo 3 workers en paralelo (comparten la misma Supabase).
2. Un worktree/terminal de Orca por ticket listo (`orca worktree create --no-parent --json` o `orca terminal create`), ownership exclusivo de archivos por worker (un escritor por archivo).
3. Si algo no converge en 2 ciclos de corrección, marcá el ticket como bloqueado, documentá el hallazgo y seguí con lo desbloqueado.

## Fase 3 — Implementación (por ticket)

1. Skill `implement` + `tdd` (red-green-refactor por vertical slice).
2. Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.
3. Prueba funcional en el navegador embebido de Orca (skill `orca-cli`): `orca terminal create --worktree active --title dev --command "pnpm dev" --json`, `orca tab create --url http://localhost:3000 --json`, `orca snapshot`, interactuar, `orca screenshot` + `orca console` como evidencia.
4. Skill `code-review` obligatorio antes de cerrar. Después commit conventional con `closes #N` y push directo a `main` (CI y deploy corren solos).
5. Migraciones: `pnpm dlx supabase db push --db-url "$DATABASE_URL"` (session pooler).

## Fase 4 — Stellar (riesgo alto, al final)

1. El flujo demoable E2E en producción vale más que la perfección on-chain: si el contrato Soroban real no está listo en 2 ciclos, dejá la integración detrás de la interfaz `lib/stellar` con fake documentado y modo demo.
2. Si alcanza el tiempo, testnet real: stellar-sdk + contrato desplegado, con links a Stellar Expert como evidencia.

## Fase 5 — Validación final y reporte

1. Cargá `teamwork-preview` para validación adversarial de lo terminado (critic + challenger + auditor con evidencia real de comandos, no promesas).
2. Corrida E2E final en el navegador de Orca contra producción (URL de Vercel) y local.
3. Escribí `docs/reporte-noche.md` con: tickets completados (evidencia: screenshots, tests, tx hashes), pendientes con próximo paso, URLs de producción, y qué quedó en modo demo.
4. Dejá el resumen final en el chat para leerlo al despertar.

## Reglas de oro

- CI siempre verde antes de cerrar un ticket; nunca pushear con gates rojos.
- Nunca commitear secretos ni exponer `SUPABASE_SECRET_KEY` / `GFW_API_KEY` en código cliente.
- No romper el flujo existente (home + contador de lotes); el deploy de producción es la prioridad #1.
- UI, commits y reportes en español. Conventional commits.
