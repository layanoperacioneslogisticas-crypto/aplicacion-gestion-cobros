create table if not exists public.ct_cfg_stage_notify (
    process_key text not null,
    stage_order int not null,
    stage_name text,
    area_to text,
    cc_areas text,
    activo boolean not null default true,
    notas text,
    updated_at timestamptz not null default now(),
    primary key (process_key, stage_order)
);

create index if not exists ct_cfg_stage_notify_process_key_idx
    on public.ct_cfg_stage_notify (process_key);
