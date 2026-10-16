-- Ajuste robusto de secuencia y asignación de código de lote
-- Evita colisiones cuando se insertaron códigos manuales en seeds.

-- 1. Sincronizar el sequence con el máximo número existente en lotes
select setval(
  'public.lote_codigo_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(codigo_lote, '\D', '', 'g'), '')::bigint) from public.lotes), 100),
    109
  ) + 1
);

-- 2. Trigger para garantizar que nextval nunca asigne un código existente
create or replace function public.asignar_codigo_lote()
returns trigger as $$
declare
  v_num bigint;
  v_candidate text;
begin
  if new.codigo_lote is null or new.codigo_lote = '' then
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

drop trigger if exists trg_asignar_codigo_lote on public.lotes;
create trigger trg_asignar_codigo_lote
before insert on public.lotes
for each row
execute function public.asignar_codigo_lote();
