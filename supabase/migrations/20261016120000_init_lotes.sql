-- Esquema inicial minimo: lotes de trazabilidad.
-- Expandir en los issues del MVP (caravanas, eventos, sellos, liquidaciones).

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  renspa text not null,
  productor text,
  estado text not null default 'borrador',
  peso_promedio_kg numeric,
  created_at timestamptz not null default now()
);

alter table public.lotes enable row level security;

create policy "lotes_select_publico"
  on public.lotes for select
  to anon, authenticated
  using (true);

create policy "lotes_insert_authenticated"
  on public.lotes for insert
  to authenticated
  with check (true);

create policy "lotes_update_authenticated"
  on public.lotes for update
  to authenticated
  using (true)
  with check (true);

-- Dato demo para verificar la cadena E2E (app -> Supabase). Borrar cuando haya datos reales.
insert into public.lotes (renspa, productor, estado, peso_promedio_kg)
values ('05.077.0.00412/00', 'Demo Ideathon', 'borrador', 200);
