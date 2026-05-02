alter table public.ct_cobros
add column if not exists monto_pago numeric(12,2);
