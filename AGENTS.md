# AGENTS.md — Ideathon Neatech

App Next.js + Supabase para trazabilidad ganadera con sellos EUDR en Stellar (Soroban) y escrow USDC. El tracker de trabajo es GitHub Issues (`gh issue list`).

## Stack

- Next.js 16 (App Router, React 19, TypeScript estricto) + Tailwind CSS 4
- Supabase (Postgres + Auth + RLS). Cliente via `@supabase/ssr`.
- Stellar / Soroban (testnet) para sellos y escrow.
- pnpm 11 + Node 24 (ver `.nvmrc`). Tests con Vitest.

## Comandos

- `pnpm dev` — servidor local (http://localhost:3000)
- `pnpm test` / `pnpm test:watch` — Vitest
- `pnpm lint` — ESLint con `--max-warnings=0`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm format:check` / `pnpm format` — Prettier
- `pnpm build` — build de producción
- Probar UI en local: `pnpm dev` + navegador embebido de Orca (skill `orca-cli`): `orca tab create --url http://localhost:3000`, `orca snapshot`, `orca screenshot`
- `pnpm dlx supabase db push --db-url "$DATABASE_URL"` — aplicar migraciones al remoto (session pooler, funciona desde IPv4)
- `pnpm dlx supabase migration new <nombre>` — crear migración nueva

## Base de datos

- Las migraciones viven SOLO en `supabase/migrations/*.sql`. Nunca cambiar el schema a mano ni desde el dashboard.
- Toda tabla nueva necesita `enable row level security` + políticas explícitas.
- `service_role` solo en servidor; jamás en código cliente ni con prefijo `NEXT_PUBLIC_`.

## Convenciones

- Server Components por defecto; `'use client'` solo cuando sea necesario.
- Commits con conventional commits (`feat:`, `fix:`, `chore:`, ...).
- Se trabaja directo sobre `main` (política del hackathon); CI y deploy corren en cada push.
- Nunca commitear secretos. `.env.local` es local; en CI/Vercel van por secrets/envs.

## Definition of Done (por issue)

- Tests que cubren el comportamiento nuevo (Vitest; Playwright si hay flujo de UI).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.
- Si toca schema: migración nueva + RLS + políticas, aplicada con `supabase db push`.
- Commit descriptivo (qué y por qué) referenciando el issue (`closes #N`).

## Entorno

- Variables requeridas: ver `.env.example`.
- Local: `.env.local` (ya creado con las credenciales del proyecto, incluida `GFW_API_KEY`).
- Flujo funcional de negocio documentado en `docs/flujo-completo.md`.
- CI/CD: secrets `SUPABASE_*` y `VERCEL_*` en GitHub Actions.
- Skills en `.agents/skills/`: mattpocock (`/tdd`, `/implement`, `/code-review`, `/handoff`), supabase, `teamwork-preview` (equipos multi-agente con verificación adversarial). Para orquestar workers en paralelo, usar las skills de orca (`orca-cli`, `orchestration`).

## Agent skills

### Issue tracker

Issues y specs viven como GitHub Issues (usar `gh`). Ver `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulario default de triage (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Ver `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` en la raíz + `docs/adr/`. Ver `docs/agents/domain.md`.

## Alcance del MVP (no negociable)

Los 3 sellos del flujo: (1) origen libre de deforestación, (2) sanidad/engorde, (3) cierre/faena — con trazabilidad RFID, validaciones biológicas y liquidaciones escrow. Todo lo que no aporte a ese flujo queda fuera.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
