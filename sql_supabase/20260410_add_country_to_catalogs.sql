alter table public.ct_providers
    add column if not exists country_code text not null default 'PE';

alter table public.ct_pilots
    add column if not exists country_code text not null default 'PE';

alter table public.ct_master_items
    add column if not exists country_code text not null default 'PE';
