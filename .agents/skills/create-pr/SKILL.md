---
name: create-pr
description: Crea un pull request con gh CLI siguiendo la convención del repo Ideathon Neatech. Usala cuando el usuario pida abrir / crear / submit un PR, o cuando haya commits en una rama y el usuario diga "ya está" o "mandá el PR".
---

# Create Pull Request

## Cuándo usarla

Después de commitear cambios en una rama `feature/*`, `fix/*`, `chore/*`, `docs/*` y el usuario pide abrir el PR. **Solo cuando se pide un PR**: la política de este repo es push directo a `main` con CI y deploy automáticos.

## Reglas duras

- **Nunca abras un PR desde `main`.** `main` es la rama estable y los PRs contra sí misma no tienen sentido. Si la rama actual es `main`, abortá: "Estás en `main`. Este repo trabaja directo sobre `main` (con CI y deploy automáticos); si querés PR, primero creá una rama `feature/*` / `fix/*` / `chore/*`".
- **Este proyecto no usa `develop`.** La base de todo PR es `main`.
- **Título en Conventional Commits**: `<tipo>: <descripción imperativa>`, máximo 100 caracteres. Tipos válidos (commitlint): `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- No abras PR con working tree sucio ni con gates rojos.

## Pre-flight checks

```bash
git rev-parse --abbrev-ref HEAD
git log --oneline origin/main..HEAD
git status --short
```

- Working tree sucio → commit o stash primero.
- Sin commits contra base → abortá.

## Gates previos

Si no se corrieron, invocá la skill `pr-prep` (o corré):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Validador de diff

El diff del PR NO debe tocar:

- `.env`, `.env.local` ni credenciales (`*.pem`, `*.key`). `.env.example` solo en PRs de env.
- `node_modules/`.
- `pnpm-lock.yaml` salvo PRs de dependencias (`build(deps)` / `chore(deps)`).

Reglas extra del repo:

- Si toca `supabase/migrations/**`: verificar que la migración esté aplicada al remoto antes de mergear (`pnpm dlx supabase db push --db-url "$DATABASE_URL"`). El workflow `db-migrate` la aplica al pushear a `main`.
- Si toca `.github/workflows/**`: validar la sintaxis YAML (un workflow roto falla en 0s y enrojece todo).
- Los secretos del repo son server-only (`SUPABASE_SECRET_KEY`, `GFW_API_KEY`): si el diff los expone en cliente (`NEXT_PUBLIC_`), abortar.

## Push y creación

```bash
git push -u origin HEAD

gh pr create \
  --base main \
  --head "$(git rev-parse --abbrev-ref HEAD)" \
  --title "<título conventional>" \
  --body-file <tmp>
```

Flags útiles: `--draft` para WIP; `--label` para clasificar (`ticket`, `bug`, …); `--reviewer` solo si el usuario lo pide (no hay CODEOWNERS en este repo).

Si la rama tiene un issue asociado (buscar con `gh issue list --search <branch>`), el cuerpo debe incluir `Closes #N`.

## Cuerpo (template)

```markdown
## ¿Qué cambia?

- <bullet 1 — cambio concreto>
- <bullet 2 — cambio concreto>

## ¿Por qué?

<motivación en 1-2 frases, referenciando el issue si existe>

## Cómo verificar

1. <paso para reproducir o probar>
2. <resultado esperado>
```

## Output esperado

Mostrá la URL del PR y un resumen breve. Si la creación falló, reportá el error literal de `gh` y sugerí el siguiente paso.

## Anti-patterns

- ❌ Título vago: "wip", "fix", "cambios", "update".
- ❌ Cuerpo vacío cuando hay varios commits.
- ❌ PR desde `main` o contra `develop`.
- ❌ PR sin gates verdes (la CI lo va a rechazar igual; mejor avisar antes).
- ❌ `--force` sobre una rama compartida.
