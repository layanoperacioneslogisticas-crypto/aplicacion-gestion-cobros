create table if not exists public.ct_notifications (
    id text primary key,
    created_at timestamptz not null default now(),
    user_email text not null,
    cobro_id text,
    etapa text,
    accion text,
    message text,
    read_at timestamptz
);

create index if not exists ct_notifications_user_email_idx
    on public.ct_notifications (user_email);

create index if not exists ct_notifications_created_at_idx
    on public.ct_notifications (created_at desc);
