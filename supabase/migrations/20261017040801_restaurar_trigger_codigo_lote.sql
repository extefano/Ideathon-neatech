-- La migración original `20261016170000_fix_lote_codigo_seq.sql` compartía prefijo
-- con `perfiles_y_actores_demo` y nunca se registró por separado; al resolver el
-- prefijo duplicado se eliminó su archivo y el trigger anti-colisión de códigos
-- quedó sin crear (la función sí existe, de `robust_codigo_lote_trigger`).
-- Se restaura aquí con una versión única.

drop trigger if exists trg_asignar_codigo_lote on public.lotes;

create trigger trg_asignar_codigo_lote
before insert on public.lotes
for each row
execute function public.asignar_codigo_lote();

-- Alinear la secuencia con el mayor número existente, como hacía la original.
select setval(
  'public.lote_codigo_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(codigo_lote, '\D', '', 'g'), '')::bigint) from public.lotes), 100),
    109
  ) + 1
);
