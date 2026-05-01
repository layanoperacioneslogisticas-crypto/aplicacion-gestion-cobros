alter table public.ct_providers
    add column if not exists activo boolean not null default true;

update public.ct_providers
set activo = true
where activo is null;
