-- Remove transport requisitions & billing module
-- 2026-04-11

drop table if exists public.ct_transport_billings cascade;
drop table if exists public.ct_transport_requisitions cascade;
