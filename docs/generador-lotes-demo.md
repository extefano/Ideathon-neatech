# Generador de lotes demo por migración SQL (#45)

Generador reproducible que produce una migración SQL con lotes ganaderos ficticios y consistentes
para poblar el marketplace. Reemplaza al seed manual de #15 (`20261016160000_seed_demo_lotes.sql`,
que queda intacto) y se apoya en el modelo real del dominio (no inventa tablas).

- `scripts/generar-lotes-demo.ts` — CLI.
- `scripts/lib/generar-lotes.ts` — generación determinista (PRNG propio sembrado).
- `scripts/lib/render-sql.ts` — render de la migración idempotente.
- `scripts/sql/limpieza-lotes-demo.sql` — limpieza por marcador.
- `scripts/sql/reset-lotes-demo.sql` — reset del demo (limpieza + re-siembra).
- `supabase/migrations/20261017120000_seed_demo_lots.sql` — ejemplo commiteado: **40 lotes
  `DISPONIBLE`** (seed `12345`, con certificaciones Eje 2).

## Modelo real (verificado en el código)

No existen tablas `establecimientos`, `animales` ni `documentos`:

- Establecimiento = campos de `lotes` (`renspa`, `provincia`, `localidad`, `poligono_geojson`,
  `superficie_ha`).
- Animales = `caravanas` (`rfid`, `peso_inicial_kg`, `peso_mes4_kg`, `peso_final_kg`).
- Documentos = campos de `lotes` (`renspa_doc_url/hash`, `boleto_marca_url`) y de
  `auditorias_veterinarias` / `recepciones_frigorifico`.

## Instalación

`tsx` es la única dependencia nueva (devDependency). Con Node 24 y pnpm 11:

```bash
pnpm install
```

## Comando

```bash
pnpm generate:lots -- --count 40 --seed 12345 [opciones]
```

| Parámetro             | Default                                       | Descripción                                              |
| --------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `--count <n>`         | `40`                                          | Cantidad de lotes (`1..500`).                            |
| `--seed <n>`          | `12345`                                       | Semilla del PRNG (reproducible).                         |
| `--estado <valor>`    | `DISPONIBLE`                                  | Solo `DISPONIBLE`; cualquier otro valor falla.           |
| `--provincias a,b`    | las 23 provincias                             | Subconjunto de provincias argentinas.                    |
| `--monedas USDC,EURC` | `USDC,EURC`                                   | Monedas de financiación.                                 |
| `--min-cabezas <n>`   | `20`                                          | Cabezas mínimas por lote.                                |
| `--max-cabezas <n>`   | `80`                                          | Cabezas máximas por lote.                                |
| `--certificaciones`   | `false`                                       | Adjunta las 3 certificaciones Eje 2 (marcadas `[DEMO]`). |
| `--out <path>`        | `supabase/migrations/<ts>_seed_demo_lots.sql` | Ruta de salida.                                          |
| `--dry-run`           | `false`                                       | Imprime el SQL por stdout sin escribir archivos.         |
| `--help`              | —                                             | Ayuda.                                                   |

### Ejemplos

```bash
# 10 lotes reproducibles, sin certificaciones, a stdout.
pnpm generate:lots -- --count 10 --seed 12345 --dry-run

# 40 lotes con certificaciones Eje 2 en la ruta de migración por defecto.
pnpm generate:lots -- --count 40 --seed 12345 --certificaciones

# Solo Santa Fe, 25 a 40 cabezas, en USDC.
pnpm generate:lots -- --count 12 --seed 777 --provincias "Santa Fe" \
  --monedas USDC --min-cabezas 25 --max-cabezas 40 \
  --out supabase/migrations/20261017120000_seed_demo_lots.sql
```

## Reglas del generador

- **Determinista**: PRNG propio (mulberry32) sembrado; mismo `--seed` → salida equivalente.
  `created_at` y `checkedAt` se derivan del seed. Sin dependencias nuevas salvo `tsx`.
- **Catálogos y hashes reutilizados**: `lib/domain.ts` (`CATEGORIAS`, `RAZAS`, `MONEDAS`,
  `TIPOS_OPERACION`, `TIPOS_RODEO`, `UNIFORMIDADES`, `CERTIFICACIONES_COMERCIALES`) y `lib/crypto.ts`
  (`rfidListHash`, `eudrGeoHash`, `sha256Hex` sobre `public/demo/renspa-demo.pdf`). No se duplican.
- **Solo `DISPONIBLE`**: `seal_1_eudr = true`, sellos 2/3 en `false`, `gfw_consulta` conforme
  (`totalLossHa: 0`), sin movimientos de escrow y `soroban_create_tx_hash = null`.
- **Marcadores DEMO**: `codigo_lote` con prefijo `LOTE-DEMO-`, `productor_wallet` con prefijo
  `GDEMO-LOTE-`, `titulo` con prefijo `[DEMO]` y certificaciones con `observaciones` `[DEMO] ...`.
- **Sin efectos**: NO ejecuta GFW, Stellar, Storage ni pagos. Solo escribe un archivo `.sql`.

## Estructura del SQL

Cada migración generada:

1. Cabecera con `count/seed/estado/certificaciones` y los marcadores demo.
2. `begin;` … `commit;` (transacción).
3. Guardia `do $$ … raise exception … $$;`: si hay lotes `LOTE-DEMO-%` pero no son exactamente
   `count`, aborta pidiendo el reset.
4. Por lote: `insert into public.lotes (...) select ... where not exists (select 1 from
public.lotes where codigo_lote = '...')` y `insert into public.caravanas (...) select ... cross
join (values ...) ... where not exists (...)`.

La idempotencia no se apoya solo en `ON CONFLICT`: usa códigos deterministas + `WHERE NOT EXISTS` +
transacción + guardia.

## Validaciones

El generador **falla antes de emitir SQL** si:

- `--count` no es entero, `<= 0` o `> 500`.
- `--seed` no es entero o está fuera de `0..2147483647`.
- `--estado` no es `DISPONIBLE`.
- `--provincias` está vacío o tiene una provincia que no existe.
- `--monedas` está vacío o tiene una moneda fuera de `USDC`/`EURC`.
- `--min-cabezas`/`--max-cabezas` no son enteros, están fuera de `1..5000` o `min > max`.
- Un lote generado rompe los invariantes: pesos fuera de `50..1200`, RENSPA/RFID con formato
  inválido, etc. (los valores se claman contra `PESO_MIN_KG`/`PESO_MAX_KG` y los regex de dominio).

## Aplicación

### En producción (remoto Supabase)

`main` está conectado a la Supabase remota: el workflow **Deploy DB Migrations (Supabase)** corre
`supabase db push` con cada push que toque `supabase/migrations/**`. Por eso la migración commiteada
**sí llega a producción**: los 40 lotes `DISPONIBLE` quedan en la base real, se ven en `/mercado`
(`listarLotes({ estado: 'DISPONIBLE' })`, `limit 60`) y **son comprables** en el flujo de demo
(revisar sesión `COMPRADOR` + Freighter en Testnet).

Los lotes quedan marcados (`[DEMO]`, `LOTE-DEMO-`, `GDEMO-LOTE-`) para poder convivir con datos
reales e identificarlos/limpiarlos en cualquier momento.

### Manual (local o remoto)

```bash
pnpm dlx supabase db push --db-url "$DATABASE_URL"
```

## Limpieza

Elimina **solo** los registros del generador (marcador `LOTE-DEMO-%`); no toca el seed de #15 ni datos
reales. Las caravanas caen por `ON DELETE CASCADE` (y se borran explícitamente).

```bash
psql "$DATABASE_URL" -f scripts/sql/limpieza-lotes-demo.sql
```

## Reset (demo repetible)

Al comprar un lote en vivo, este pasa a `FINANCIADO_EN_ENGORDE` y sale del marketplace. Para volver a
dejar los 40 lotes `DISPONIBLE` en una sola corrida:

```bash
psql "$DATABASE_URL" -f scripts/sql/reset-lotes-demo.sql
```

El reset borra por marcador y reaplica la migración generada (idempotente). Si regenerás la migración
con otro timestamp, actualizá la ruta del `\ir` dentro del script.

## Limitaciones

- Solo genera lotes `DISPONIBLE` (etapa de marketplace). No produce lotes en engorde, tránsito ni
  ciclos cerrados, ni auditorías/recepciones/movimientos de escrow.
- `productor_wallet` es un marcador (`GDEMO-LOTE-xx`), no una cuenta Stellar real: no sirve para
  auto-compras con esa wallet (el flujo bloquea auto-compra de todos modos).
- Los documentos (`renspa_doc_url`, certificaciones) apuntan a los PDFs demo de `public/demo`.
- `listarLotes` corta en `limit(60)` sin paginación: con más de 60 lotes `DISPONIBLE` totales el
  mercado no los muestra todos.
- No aplica a un entorno sin el schema canónico (`lib/domain` + migraciones de dominio).

## §10.E · Informe de validación

Comandos de verificación (Windows, Node 24.16.0, pnpm 11.14.0). Los gates locales se corrieron en
esta máquina; la verificación de migraciones contra `postgres:17` corre en CI (el entorno local no
tiene Docker/`psql` activos), dentro del job `db-test`:

| Verificación                                                                           | Comando                                                                                                                       | Resultado                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Cantidad exacta                                                                        | `pnpm generate:lots -- --count 10 --seed 12345 --dry-run`                                                                     | 10 lotes `LOTE-DEMO-0001..0010`        |
| Reproducibilidad                                                                       | dos corridas con `--seed 12345` comparadas                                                                                    | salida idéntica (test unitario)        |
| Migración de ejemplo con 40 lotes                                                      | `pnpm generate:lots -- --count 40 --seed 12345 --certificaciones --out supabase/migrations/20261017120000_seed_demo_lots.sql` | 40 `insert` de lotes + 40 de caravanas |
| Aplica en `postgres:17` y reaplicar no duplica                                         | `pnpm test:db` (job CI `db-test` con `services: postgres:17`)                                                                 | 40 lotes; reaplicar mantiene 40        |
| Filtra como el marketplace (provincia/categoría/raza/moneda/certificación, `limit 60`) | `pnpm test:db`                                                                                                                | 40 lotes filtrables                    |
| Guardia + reset                                                                        | `psql -f scripts/sql/reset-lotes-demo.sql` + test de guardia                                                                  | reconstituye 40 `DISPONIBLE`           |
| Datos inválidos fallan antes del SQL                                                   | `pnpm test` (`scripts/__tests__/generar-lotes.test.ts`)                                                                       | 11 casos de error cubiertos            |
| Gates locales                                                                          | `pnpm lint && pnpm typecheck && pnpm test && pnpm build`                                                                      | en verde                               |
| Push a `main` → migración en producción                                                | workflow **Deploy DB Migrations (Supabase)**                                                                                  | aplica la migración al remoto          |

> El test de integración (`scripts/__tests__/seed-demo-lots.db.test.ts`) se excluye del run default
> (`pnpm test`) y corre aparte con `pnpm test:db`, que necesita un `postgres:17` accesible vía `psql`
> (variables `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`). El job `db-test` de CI lo levanta
> como service container y prepara stubs de `auth`/`storage`/roles para correr sobre Postgres limpio.
