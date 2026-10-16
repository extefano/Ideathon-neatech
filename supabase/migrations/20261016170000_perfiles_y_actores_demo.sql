-- Migration: 20261016170000_perfiles_y_actores_demo.sql
-- Autenticación y perfiles multi-rol (Ticket #19)

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol text not null check (rol in ('PRODUCTOR', 'VETERINARIO', 'COMPRADOR')),
  nombre_completo text not null,
  cuit text not null,
  matricula text,
  tipo_comprador text,
  wallet text,
  productor_id uuid references public.productores (id),
  veterinario_id uuid references public.veterinarios (id),
  comprador_id uuid references public.compradores (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS en perfiles
alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio"
on public.perfiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "perfiles_insert_propio" on public.perfiles;
create policy "perfiles_insert_propio"
on public.perfiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio"
on public.perfiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create index if not exists perfiles_rol_idx on public.perfiles (rol);

drop trigger if exists perfiles_set_updated_at on public.perfiles;
create trigger perfiles_set_updated_at
before update on public.perfiles
for each row
execute function public.set_updated_at();

-- Seed idempotente de los actores base demo en tablas de dominio
insert into public.productores (wallet, nombre_razon_social, cuit, anos_operando, operador_consignatario)
values ('GDEMO-PRODUCTOR', 'Cabaña Las Lilas SA', '30-50123456-9', 12, 'Consignataria del Sur SA')
on conflict (wallet) do update set
  nombre_razon_social = excluded.nombre_razon_social,
  cuit = excluded.cuit,
  operador_consignatario = excluded.operador_consignatario;

insert into public.veterinarios (wallet, nombre_completo, cuit, matricula_profesional, acreditacion_senasa)
values ('GDEMO-VETERINARIO', 'Dr. Carlos Saavedra', '20-28491823-4', 'MP-4102 SENASA', 'SENASA-0412')
on conflict (wallet) do update set
  nombre_completo = excluded.nombre_completo,
  cuit = excluded.cuit,
  matricula_profesional = excluded.matricula_profesional,
  acreditacion_senasa = excluded.acreditacion_senasa;

insert into public.compradores (wallet, razon_social, cuit, tipo_comprador, matricula_ruca)
values ('GDEMO-FRIGORIFICO', 'Frigorífico Rioplatense SA', '30-61234567-1', 'FRIGORIFICO_EXPORTADOR', 'RUCA-8921')
on conflict (wallet) do update set
  razon_social = excluded.razon_social,
  cuit = excluded.cuit,
  tipo_comprador = excluded.tipo_comprador,
  matricula_ruca = excluded.matricula_ruca;
