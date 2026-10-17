-- Reset del demo de lotes (issue #45).
-- Borra los lotes del generador (marcador `LOTE-DEMO-%`) y los vuelve a sembrar
-- reaplicando la migración generada. Repetible: usalo cada vez que quieras
-- recomenzar la demo (por ejemplo, después de comprar lotes en vivo).
--
-- Uso:
--   psql "$DATABASE_URL" -f scripts/sql/reset-lotes-demo.sql
--
-- Si regenerás la migración con otro timestamp, actualizá la ruta del \ir de abajo.
\set ON_ERROR_STOP on

-- 1. Limpieza por marcador (solo registros demo).
delete from public.caravanas
where lote_id in (select id from public.lotes where codigo_lote like 'LOTE-DEMO-%');

delete from public.lotes
where codigo_lote like 'LOTE-DEMO-%';

-- 2. Re-siembra idempotente (la migración abre/cierra su propia transacción).
\ir ../../supabase/migrations/20261017120000_seed_demo_lots.sql
