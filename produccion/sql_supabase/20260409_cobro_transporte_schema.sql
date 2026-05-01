begin;

create extension if not exists pgcrypto;

create table if not exists public.ct_settings (
    setting_key text primary key,
    setting_value text not null default '',
    description text,
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_users (
    email text primary key,
    nombre text not null,
    rol text not null,
    password_hash text not null,
    activo boolean not null default true,
    area text,
    country_code text not null default 'PE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.ct_users
    add column if not exists country_code text not null default 'PE';

create table if not exists public.ct_providers (
    codigo text primary key,
    nombre text not null,
    correo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_pilots (
    dni text primary key,
    nombre_completo text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_master_items (
    codigo text primary key,
    descripcion text not null,
    uxc integer not null default 0 check (uxc >= 0),
    precio_con_igv numeric(14,2) not null default 0 check (precio_con_igv >= 0),
    precio_sin_igv numeric(14,2) not null default 0 check (precio_sin_igv >= 0),
    ean text,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_cobros (
    id text primary key,
    fecha_registro timestamptz not null default now(),
    proveedor_nombre text not null,
    proveedor_codigo text,
    unidad text,
    ruta text,
    c9 text,
    factura_ref text,
    observaciones text,
    total_cobro numeric(14,2) not null default 0 check (total_cobro >= 0),
    estado text not null default 'Abierto',
    responsable text,
    piloto_nombre text,
    items_json jsonb not null default '[]'::jsonb,
    etapa text not null default '1. Boleta generada',
    ultima_actualizacion timestamptz not null default now(),
    bodega text,
    licencia text,
    pdf_url text,
    area_responsable_actual text,
    country_code text,
    country_name text,
    process_folder_id text,
    process_folder_url text,
    process_folder_name text,
    fecha_limite_firma_boleta timestamptz,
    firma_boleta_link text,
    boleta_firmada_url text,
    firma_boleta_url text,
    inventario_status text,
    comentario_inventario text,
    ov_numero text,
    ruta_id text,
    factura_numero text,
    factura_url text,
    fecha_limite_firma_factura timestamptz,
    firma_factura_link text,
    firma_factura_url text,
    liquidacion_ref text,
    constancia_pago_url text,
    rm_numero text,
    facturas_debitar text,
    debito_ref text,
    etapa_anterior text,
    motivo_observacion text,
    fecha_ingreso_etapa_actual timestamptz,
    fecha_limite_sla_actual timestamptz,
    email_proveedor text,
    email_inventarios text,
    email_transporte text,
    email_cyc text,
    email_facturacion text,
    email_contabilidad text,
    sla_notif jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (inventario_status is null or inventario_status in ('', 'OK', 'Ajuste', 'No hay'))
);

create table if not exists public.ct_cobro_items (
    id bigint generated always as identity primary key,
    cobro_id text not null references public.ct_cobros(id) on delete cascade,
    codigo text not null,
    descripcion text not null,
    cantidad numeric(14,2) not null default 0 check (cantidad >= 0),
    precio numeric(14,2) not null default 0 check (precio >= 0),
    subtotal numeric(14,2) not null default 0,
    incidencia text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.ct_cobros
    add column if not exists country_code text;

alter table public.ct_cobros
    add column if not exists country_name text;

alter table public.ct_cobros
    add column if not exists process_folder_id text;

alter table public.ct_cobros
    add column if not exists process_folder_url text;

alter table public.ct_cobros
    add column if not exists process_folder_name text;

create table if not exists public.ct_transport_requisitions (
    req_id text primary key,
    fecha_registro timestamptz not null default now(),
    fecha_servicio date,
    area_solicitante text not null,
    tipo_servicio text not null,
    ruta text,
    proveedor_codigo text,
    proveedor_nombre text,
    costo_estimado numeric(14,2) not null default 0 check (costo_estimado >= 0),
    moneda text not null default 'PEN',
    estado text not null default 'Solicitada',
    observaciones text,
    usuario_registro text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_transport_billings (
    fac_id text primary key,
    fecha_registro timestamptz not null default now(),
    fecha_factura date,
    numero_factura text not null,
    req_id text references public.ct_transport_requisitions(req_id) on delete set null,
    proveedor_codigo text,
    proveedor_nombre text,
    servicio text,
    monto numeric(14,2) not null default 0 check (monto >= 0),
    moneda text not null default 'PEN',
    estado text not null default 'Registrada',
    observaciones text,
    usuario_registro text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_notification_templates (
    codigo text primary key,
    asunto text not null,
    cuerpo text not null,
    activo boolean not null default true,
    notas text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_area_emails (
    area text primary key,
    email_to text,
    email_cc text,
    activo boolean not null default true,
    notas text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_critical_approvals (
    solicitud_id text primary key,
    fecha_solicitud timestamptz not null default now(),
    tipo text not null,
    cobro_id text,
    solicitado_por text,
    motivo text not null,
    payload jsonb not null default '{}'::jsonb,
    estado text not null default 'Pendiente',
    aprobado_por text,
    fecha_resolucion timestamptz,
    comentario jsonb not null default '{}'::jsonb,
    usado boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_audit_log (
    id bigint generated always as identity primary key,
    fecha timestamptz not null default now(),
    cobro_id text,
    usuario text,
    etapa text,
    accion text,
    resultado text,
    destinatario text,
    detalle text,
    created_at timestamptz not null default now()
);

create table if not exists public.ct_cfg_countries (
    country_code text primary key,
    nombre text not null,
    moneda text not null default 'PEN',
    timezone text not null default 'America/Lima',
    locale text not null default 'es-PE',
    activo boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_cfg_roles (
    role_id text primary key,
    role_key text not null unique,
    role_name text not null,
    activo boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_cfg_user_role_scopes (
    scope_id text primary key,
    user_email text not null,
    role_key text not null,
    country_code text,
    business_unit text,
    activo boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_cfg_flow_stages (
    process_key text not null,
    stage_order integer not null check (stage_order > 0),
    stage_code text,
    stage_name text not null,
    required_fields jsonb not null default '[]'::jsonb,
    required_docs jsonb not null default '[]'::jsonb,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (process_key, stage_order)
);

create table if not exists public.ct_cfg_stage_sla (
    process_key text not null,
    stage_order integer not null check (stage_order > 0),
    stage_name text not null,
    sla_hours integer not null default 0 check (sla_hours >= 0),
    activo boolean not null default false,
    notas text,
    updated_at timestamptz not null default now(),
    primary key (process_key, stage_order)
);

create table if not exists public.ct_cfg_rules (
    rule_id text primary key,
    nombre text not null,
    process_key text not null default 'cobro_transporte',
    prioridad integer not null default 100,
    country_scope text not null default '*',
    stage_from integer not null default 1,
    stage_to integer not null default 10,
    trigger_event text not null default 'STAGE_ENTER',
    condition_json jsonb not null default '{}'::jsonb,
    action_json jsonb not null default '{}'::jsonb,
    stop_on_match boolean not null default true,
    activo boolean not null default true,
    valid_from date,
    valid_to date,
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_cfg_templates (
    template_id text primary key,
    event_key text not null,
    country_code text not null default '*',
    language text not null default 'es',
    channel text not null default 'email',
    subject text not null,
    body text not null,
    activo boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.ct_cfg_auth_keys (
    key_id text primary key,
    nombre text not null,
    clave_hash text not null,
    scope text not null default 'GESTION_DELETE_ANY',
    activo boolean not null default true,
    max_usos integer not null default 0 check (max_usos >= 0),
    usos_actuales integer not null default 0 check (usos_actuales >= 0),
    ultimo_uso_at timestamptz,
    notas text,
    updated_at timestamptz not null default now()
);

create index if not exists ct_users_email_ci_uidx
    on public.ct_users (lower(email));

create index if not exists ct_users_country_code_idx
    on public.ct_users (country_code);

create index if not exists ct_providers_nombre_idx
    on public.ct_providers (nombre);

create index if not exists ct_master_items_activo_idx
    on public.ct_master_items (activo);

create index if not exists ct_cobros_fecha_registro_idx
    on public.ct_cobros (fecha_registro desc);

create index if not exists ct_cobros_estado_idx
    on public.ct_cobros (estado);

create index if not exists ct_cobros_etapa_idx
    on public.ct_cobros (etapa);

create index if not exists ct_cobros_responsable_idx
    on public.ct_cobros (responsable);

create index if not exists ct_cobros_area_responsable_idx
    on public.ct_cobros (area_responsable_actual);

create index if not exists ct_cobros_proveedor_codigo_idx
    on public.ct_cobros (proveedor_codigo);

create index if not exists ct_cobros_country_code_idx
    on public.ct_cobros (country_code);

create index if not exists ct_cobros_ultima_actualizacion_idx
    on public.ct_cobros (ultima_actualizacion desc);

create index if not exists ct_cobro_items_cobro_id_idx
    on public.ct_cobro_items (cobro_id);

create index if not exists ct_cobro_items_codigo_idx
    on public.ct_cobro_items (codigo);

create index if not exists ct_transport_requisitions_fecha_servicio_idx
    on public.ct_transport_requisitions (fecha_servicio);

create index if not exists ct_transport_requisitions_estado_idx
    on public.ct_transport_requisitions (estado);

create index if not exists ct_transport_billings_req_id_idx
    on public.ct_transport_billings (req_id);

create index if not exists ct_transport_billings_numero_factura_idx
    on public.ct_transport_billings (numero_factura);

create index if not exists ct_transport_billings_estado_idx
    on public.ct_transport_billings (estado);

create index if not exists ct_critical_approvals_estado_fecha_idx
    on public.ct_critical_approvals (estado, fecha_solicitud desc);

create index if not exists ct_critical_approvals_cobro_id_idx
    on public.ct_critical_approvals (cobro_id);

create index if not exists ct_audit_log_cobro_fecha_idx
    on public.ct_audit_log (cobro_id, fecha desc);

create index if not exists ct_audit_log_usuario_fecha_idx
    on public.ct_audit_log (usuario, fecha desc);

create index if not exists ct_cfg_rules_process_priority_idx
    on public.ct_cfg_rules (process_key, prioridad, activo);

create unique index if not exists ct_cfg_templates_event_scope_uidx
    on public.ct_cfg_templates (event_key, country_code, language, channel);

insert into public.ct_area_emails (area, email_to, email_cc, activo, notas)
values
    ('Logistica Inversa', '', '', true, 'Logistica Inversa'),
    ('Transporte', '', '', true, 'Transporte'),
    ('Inventario', '', '', true, 'Inventario'),
    ('Creditos y Cobros', '', '', true, 'Creditos y Cobros'),
    ('Facturacion', '', '', true, 'Facturacion'),
    ('Contabilidad', '', '', true, 'Contabilidad'),
    ('Proveedor (seguimiento Transporte)', '', '', true, 'Proveedor seguimiento Transporte'),
    ('Supervisor', '', '', true, 'Supervisor'),
    ('Administrador', '', '', true, 'Admin')
on conflict (area) do nothing;

insert into public.ct_notification_templates (codigo, asunto, cuerpo, activo, notas)
values
    (
        'ETAPA_FIRMA_BOLETA',
        '[COBRO TRANSPORTE] {{id}} | Firma boleta requerida',
        $$Actualizacion de cobro.
ID: {{id}}
Etapa: {{etapa}}
Proveedor: {{proveedor}}
Ruta: {{ruta}}
Monto: S/ {{monto}}
Link firma boleta: {{firmaBoletaLink}}
PDF: {{pdfUrl}}$$,
        true,
        'Etapa 2 (inicio flujo)'
    ),
    (
        'ETAPA_FIRMA_FACTURA',
        '[COBRO TRANSPORTE] {{id}} | Firma factura requerida',
        $$Actualizacion de cobro.
ID: {{id}}
Etapa: {{etapa}}
Proveedor: {{proveedor}}
Ruta: {{ruta}}
Monto: S/ {{monto}}
Link firma factura: {{firmaFacturaLink}}
PDF: {{pdfUrl}}$$,
        true,
        'Etapa 6'
    ),
    (
        'ETAPA_GENERAL',
        '[COBRO TRANSPORTE] {{id}} | {{accion}}',
        $$Actualizacion de cobro.
ID: {{id}}
Accion: {{accion}}
Etapa: {{etapa}}
Proveedor: {{proveedor}}
Ruta: {{ruta}}
Monto: S/ {{monto}}
PDF: {{pdfUrl}}$$,
        true,
        'Resto de etapas'
    ),
    (
        'ETAPA_OBSERVADA_RETORNO',
        '[COBRO TRANSPORTE] {{id}} | Observado - volver a {{etapa}}',
        $$Caso observado y regresado para correccion.
ID: {{id}}
Estado: Observado
Area reportada: {{areaReportada}}
Etapa actual para correccion: {{etapa}}
Area que reporta observacion: {{areaReporta}}
Etapa reportada: {{etapaReportada}}
Motivo: {{motivoObservacion}}
Proveedor: {{proveedor}}
Ruta: {{ruta}}
Monto: S/ {{monto}}
PDF: {{pdfUrl}}$$,
        true,
        'Aviso al area reportada cuando el caso regresa por observacion'
    ),
    (
        'SLA_REMINDER',
        '[COBRO TRANSPORTE] {{id}} | Recordatorio SLA {{marca}}',
        $$Recordatorio SLA.
ID: {{id}}
Etapa: {{etapa}}
Vence: {{vence}}
PDF: {{pdfUrl}}$$,
        true,
        'SLA 24/44/...'
    ),
    (
        'SLA_ESCALADO',
        '[COBRO TRANSPORTE] {{id}} | SLA vencido',
        $$SLA vencido.
ID: {{id}}
Etapa: {{etapa}}
Vence: {{vence}}
PDF: {{pdfUrl}}$$,
        true,
        'Escalado SLA'
    )
on conflict (codigo) do nothing;

insert into public.ct_cfg_countries (country_code, nombre, moneda, timezone, locale, activo)
values
    ('SV', 'El Salvador', 'USD', 'America/El_Salvador', 'es-SV', true),
    ('PE', 'Peru', 'PEN', 'America/Lima', 'es-PE', true),
    ('GT', 'Guatemala', 'GTQ', 'America/Guatemala', 'es-GT', true)
on conflict (country_code) do update set
    nombre = excluded.nombre,
    moneda = excluded.moneda,
    timezone = excluded.timezone,
    locale = excluded.locale,
    activo = excluded.activo;

insert into public.ct_cfg_roles (role_id, role_key, role_name, activo)
values
    ('ROL-ADMIN', 'admin', 'Administrador', true),
    ('ROL-SUPERV', 'supervisor', 'Supervisor', true),
    ('ROL-LI', 'logistica_inversa', 'Logistica Inversa', true),
    ('ROL-TRANS', 'transporte', 'Transporte', true),
    ('ROL-INV', 'inventario', 'Inventario', true),
    ('ROL-CYC', 'creditos_cobros', 'Creditos y Cobros', true),
    ('ROL-FACT', 'facturacion', 'Facturacion', true),
    ('ROL-CONTA', 'contabilidad', 'Contabilidad', true)
on conflict (role_id) do nothing;

insert into public.ct_cfg_flow_stages (
    process_key,
    stage_order,
    stage_code,
    stage_name,
    required_fields,
    required_docs,
    activo
)
values
    ('cobro_transporte', 1, 'BOLETA_GENERADA', '1. Boleta generada', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 2, 'FIRMA_BOLETA_PENDIENTE', '2. Firma boleta pendiente', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 3, 'INVENTARIO_PENDIENTE', '3. Inventario pendiente', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 4, 'OV_PEDIDO_PENDIENTE', '4. OV / Pedido pendiente', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 5, 'RUTA_GENERADA', '5. Ruta generada', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 6, 'RUTA_FACTURADA', '6. Ruta facturada (Factura emitida)', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 7, 'FIRMA_FACTURA_PENDIENTE', '7. Firma factura pendiente', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 8, 'RUTA_LIQUIDADA', '8. Ruta liquidada', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 9, 'GESTIONAR_PAGO', '9. Gestionar pago', '[]'::jsonb, '[]'::jsonb, true),
    ('cobro_transporte', 10, 'APLICACION_PAGO', '10. Aplicacion de pago', '[]'::jsonb, '[]'::jsonb, true)
on conflict (process_key, stage_order) do nothing;

insert into public.ct_cfg_stage_sla (
    process_key,
    stage_order,
    stage_name,
    sla_hours,
    activo,
    notas
)
values
    ('cobro_transporte', 1, '1. Boleta generada', 0, false, ''),
    ('cobro_transporte', 2, '2. Firma boleta pendiente', 48, true, 'Default heredado del flujo actual.'),
    ('cobro_transporte', 3, '3. Inventario pendiente', 0, false, ''),
    ('cobro_transporte', 4, '4. OV / Pedido pendiente', 0, false, ''),
    ('cobro_transporte', 5, '5. Ruta generada', 0, false, ''),
    ('cobro_transporte', 6, '6. Ruta facturada (Factura emitida)', 0, false, ''),
    ('cobro_transporte', 7, '7. Firma factura pendiente', 48, true, 'Default heredado del flujo actual.'),
    ('cobro_transporte', 8, '8. Ruta liquidada', 0, false, ''),
    ('cobro_transporte', 9, '9. Gestionar pago', 0, false, ''),
    ('cobro_transporte', 10, '10. Aplicacion de pago', 0, false, '')
on conflict (process_key, stage_order) do nothing;

commit;
