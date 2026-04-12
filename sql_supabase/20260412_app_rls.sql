-- App tables RLS (run in SQL Editor as postgres)
begin;

alter table public.ct_settings enable row level security;
alter table public.ct_users enable row level security;
alter table public.ct_providers enable row level security;
alter table public.ct_pilots enable row level security;
alter table public.ct_master_items enable row level security;
alter table public.ct_cobros enable row level security;
alter table public.ct_cobro_items enable row level security;
alter table public.ct_notification_templates enable row level security;
alter table public.ct_area_emails enable row level security;
alter table public.ct_critical_approvals enable row level security;
alter table public.ct_audit_log enable row level security;
alter table public.ct_cfg_countries enable row level security;
alter table public.ct_cfg_roles enable row level security;
alter table public.ct_cfg_user_role_scopes enable row level security;
alter table public.ct_cfg_flow_stages enable row level security;
alter table public.ct_cfg_stage_sla enable row level security;
alter table public.ct_cfg_stage_notify enable row level security;
alter table public.ct_cfg_rules enable row level security;
alter table public.ct_cfg_templates enable row level security;
alter table public.ct_cfg_auth_keys enable row level security;
alter table public.ct_notifications enable row level security;

create policy "service role ct_settings" on public.ct_settings for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_users" on public.ct_users for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_providers" on public.ct_providers for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_pilots" on public.ct_pilots for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_master_items" on public.ct_master_items for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cobros" on public.ct_cobros for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cobro_items" on public.ct_cobro_items for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_notification_templates" on public.ct_notification_templates for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_area_emails" on public.ct_area_emails for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_critical_approvals" on public.ct_critical_approvals for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_audit_log" on public.ct_audit_log for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_countries" on public.ct_cfg_countries for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_roles" on public.ct_cfg_roles for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_user_role_scopes" on public.ct_cfg_user_role_scopes for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_flow_stages" on public.ct_cfg_flow_stages for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_stage_sla" on public.ct_cfg_stage_sla for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_stage_notify" on public.ct_cfg_stage_notify for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_rules" on public.ct_cfg_rules for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_templates" on public.ct_cfg_templates for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_cfg_auth_keys" on public.ct_cfg_auth_keys for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role ct_notifications" on public.ct_notifications for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "ct_notifications read own" on public.ct_notifications
for select
using (auth.role() = 'authenticated' and (auth.jwt() ->> 'email') = user_email);

commit;
