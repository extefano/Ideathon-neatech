import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DIR_MIGRACIONES = join(RAIZ, 'supabase', 'migrations');
const ARCHIVO_SEED = join(DIR_MIGRACIONES, '20261017120000_seed_demo_lots.sql');
const ARCHIVO_RESET = join(RAIZ, 'scripts', 'sql', 'reset-lotes-demo.sql');

const ENTORNO = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? 'localhost',
  PGPORT: process.env.PGPORT ?? '5432',
  PGUSER: process.env.PGUSER ?? 'postgres',
  PGPASSWORD: process.env.PGPASSWORD ?? 'postgres',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};

// Stubs de los objetos Supabase-específicos que las migraciones asumen
// (roles, auth.users y storage.*) para poder correr sobre un postgres:17 limpio.
const STUBS = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text
);
`;

function psql(sql: string): string {
  return execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-tA', '-w'], {
    input: sql,
    encoding: 'utf8',
    env: ENTORNO,
  }).trim();
}

function psqlArchivo(ruta: string): string {
  return execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-tA', '-w', '-f', ruta], {
    encoding: 'utf8',
    env: ENTORNO,
  }).trim();
}

function contar(sql: string): number {
  return Number.parseInt(psql(sql), 10);
}

function aplicarTodasLasMigraciones(): void {
  const archivos = readdirSync(DIR_MIGRACIONES)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();
  for (const archivo of archivos) {
    psqlArchivo(join(DIR_MIGRACIONES, archivo));
  }
}

const FILTRO_DEMO = "codigo_lote like 'LOTE-DEMO-%'";

describe('Migración seed demo de lotes contra postgres:17 (#45)', () => {
  beforeAll(() => {
    psql(STUBS);
    aplicarTodasLasMigraciones();
  });

  it('aplica la migración generada con 40 lotes DISPONIBLE válidos', () => {
    expect(contar(`select count(*) from public.lotes where ${FILTRO_DEMO}`)).toBe(40);
    expect(
      contar(
        `select count(*) from public.lotes where ${FILTRO_DEMO} and estado_publicacion = 'DISPONIBLE'`,
      ),
    ).toBe(40);
    expect(
      contar(
        `select count(*) from public.lotes where ${FILTRO_DEMO}
           and seal_1_eudr and not seal_2_sanitary and not seal_3_reception
           and soroban_create_tx_hash is null`,
      ),
    ).toBe(40);
    expect(
      contar(
        `select count(*) from public.lotes where ${FILTRO_DEMO}
           and jsonb_array_length(certificaciones_comerciales) = 3`,
      ),
    ).toBe(40);

    const caravanas = contar(
      `select count(*) from public.caravanas c join public.lotes l on l.id = c.lote_id where l.${FILTRO_DEMO}`,
    );
    const cabezas = contar(
      `select coalesce(sum(cantidad_cabezas), 0) from public.lotes where ${FILTRO_DEMO}`,
    );
    expect(caravanas).toBe(cabezas);
    expect(caravanas).toBeGreaterThan(0);
  });

  it('reaplicar la migración no duplica (idempotente)', () => {
    psqlArchivo(ARCHIVO_SEED);
    expect(contar(`select count(*) from public.lotes where ${FILTRO_DEMO}`)).toBe(40);
  });

  it('aparece en el listado del marketplace (limit 60) y filtra por atributos', () => {
    const listados = contar(
      `select count(*) from (
         select id from public.lotes
         where estado_publicacion = 'DISPONIBLE'
         order by created_at desc
         limit 60
       ) t`,
    );
    expect(listados).toBeGreaterThanOrEqual(40);

    const filtrarPor = (columna: string): number =>
      contar(
        `select count(*) from public.lotes
         where ${FILTRO_DEMO}
           and ${columna} = (select ${columna} from public.lotes where ${FILTRO_DEMO} limit 1)`,
      );
    expect(filtrarPor('provincia')).toBeGreaterThan(0);
    expect(filtrarPor('categoria')).toBeGreaterThan(0);
    expect(filtrarPor('raza')).toBeGreaterThan(0);
    expect(filtrarPor('moneda')).toBeGreaterThan(0);
    expect(
      contar(
        `select count(*) from public.lotes
         where ${FILTRO_DEMO}
           and certificaciones_comerciales @> '[{"codigo":"HUELLA_CARBONO_SINERGIA"}]'::jsonb`,
      ),
    ).toBe(40);
  });

  it('la limpieza por marcador elimina solo los registros demo', () => {
    const antesReales = contar(
      "select count(*) from public.lotes where codigo_lote not like 'LOTE-DEMO-%'",
    );
    psql(`
      delete from public.caravanas
      where lote_id in (select id from public.lotes where codigo_lote like 'LOTE-DEMO-%');
      delete from public.lotes where codigo_lote like 'LOTE-DEMO-%';
    `);
    expect(contar(`select count(*) from public.lotes where ${FILTRO_DEMO}`)).toBe(0);
    expect(
      contar("select count(*) from public.lotes where codigo_lote not like 'LOTE-DEMO-%'"),
    ).toBe(antesReales);
    // Restaurar el estado para el resto de los tests.
    psqlArchivo(ARCHIVO_SEED);
    expect(contar(`select count(*) from public.lotes where ${FILTRO_DEMO}`)).toBe(40);
  });

  it('la guardia RAISE EXCEPTION detecta un estado inconsistente y el reset lo repara', () => {
    psql(`delete from public.lotes where codigo_lote = 'LOTE-DEMO-0001'`);
    expect(contar(`select count(*) from public.lotes where ${FILTRO_DEMO}`)).toBe(39);
    expect(() => psqlArchivo(ARCHIVO_SEED)).toThrow();

    psqlArchivo(ARCHIVO_RESET);
    expect(contar(`select count(*) from public.lotes where ${FILTRO_DEMO}`)).toBe(40);

    // Simular una compra en vivo: el lote deja el marketplace.
    psql(`
      update public.lotes
      set estado_publicacion = 'FINANCIADO_EN_ENGORDE'
      where codigo_lote = 'LOTE-DEMO-0002';
    `);
    expect(
      contar(
        `select count(*) from public.lotes where ${FILTRO_DEMO} and estado_publicacion = 'DISPONIBLE'`,
      ),
    ).toBe(39);

    psqlArchivo(ARCHIVO_RESET);
    expect(
      contar(
        `select count(*) from public.lotes where ${FILTRO_DEMO} and estado_publicacion = 'DISPONIBLE'`,
      ),
    ).toBe(40);
  });
});
