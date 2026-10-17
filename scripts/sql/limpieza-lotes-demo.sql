-- Limpieza de los lotes demo generados por scripts/generar-lotes-demo.ts (issue #45).
-- Borra SOLO los registros del generador (marcador `LOTE-DEMO-%`); no toca el seed
-- manual de #15 ni datos reales. Las caravanas caen por ON DELETE CASCADE, pero las
-- borramos explícitamente para que quede documentado.
--
-- Uso:
--   pnpm dlx supabase db push --db-url "$DATABASE_URL"   (aplica la migración)
--   psql "$DATABASE_URL" -f scripts/sql/limpieza-lotes-demo.sql   (limpia)
\set ON_ERROR_STOP on

begin;

delete from public.caravanas
where lote_id in (select id from public.lotes where codigo_lote like 'LOTE-DEMO-%');

delete from public.lotes
where codigo_lote like 'LOTE-DEMO-%';

commit;
