-- Mejora del trigger de código de lote para chequear si el código asignado por default ya existe.

create or replace function public.asignar_codigo_lote()
returns trigger as $$
declare
  v_num bigint;
  v_candidate text;
begin
  -- Si el código es nulo, vacío, o si el código propuesto (por default o manual) ya existe en lotes:
  if new.codigo_lote is null or new.codigo_lote = '' or exists (select 1 from public.lotes where codigo_lote = new.codigo_lote) then
    loop
      v_num := nextval('public.lote_codigo_seq');
      v_candidate := 'LOTE-' || lpad(v_num::text, 5, '0');
      exit when not exists (select 1 from public.lotes where codigo_lote = v_candidate);
    end loop;
    new.codigo_lote := v_candidate;
  end if;
  return new;
end;
$$ language plpgsql;

-- Asegurar que la secuencia esté bien por encima del máximo lote actual
select setval(
  'public.lote_codigo_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(codigo_lote, '\D', '', 'g'), '')::bigint) from public.lotes), 100),
    109
  ) + 1
);
