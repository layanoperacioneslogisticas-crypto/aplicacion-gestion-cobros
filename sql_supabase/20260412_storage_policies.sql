-- Storage bucket + policies
-- Ejecutar desde Storage UI (Policies) o como supabase_storage_admin
begin;

insert into storage.buckets (id, name, public)
values ('Cobros_pdf', 'Cobros_pdf', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "Cobros_pdf read" on storage.objects
for select
using (bucket_id = 'Cobros_pdf' and auth.role() = 'authenticated');

create policy "Cobros_pdf insert" on storage.objects
for insert
with check (bucket_id = 'Cobros_pdf' and auth.role() = 'service_role');

create policy "Cobros_pdf update" on storage.objects
for update
using (bucket_id = 'Cobros_pdf' and auth.role() = 'service_role')
with check (bucket_id = 'Cobros_pdf' and auth.role() = 'service_role');

create policy "Cobros_pdf delete" on storage.objects
for delete
using (bucket_id = 'Cobros_pdf' and auth.role() = 'service_role');

commit;
