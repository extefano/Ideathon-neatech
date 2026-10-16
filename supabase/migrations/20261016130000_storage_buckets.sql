-- Buckets privados para evidencias documentales, planillas y multimedia del flujo.
insert into storage.buckets (id, name, public)
values
  ('documentos', 'documentos', false),
  ('planillas', 'planillas', false),
  ('multimedia', 'multimedia', false)
on conflict (id) do nothing;

-- Politicas base de Storage (refinar por recurso/rol en los tickets del MVP).
-- Los accesos publicos (ej: pasaporte EUDR del Paso 5) se sirven server-side
-- con la secret key, nunca directo con anon.
create policy "storage_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('documentos', 'planillas', 'multimedia'));

create policy "storage_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('documentos', 'planillas', 'multimedia'));

create policy "storage_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('documentos', 'planillas', 'multimedia'))
  with check (bucket_id in ('documentos', 'planillas', 'multimedia'));

create policy "storage_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('documentos', 'planillas', 'multimedia'));
