# Base de Datos

## Motor principal

La aplicación usa Supabase Postgres como base transaccional y Supabase Storage para archivos.

## Archivos SQL

El orden lógico observado es:

1. `20260409_cobro_transporte_schema.sql`
2. `20260410_add_country_to_catalogs.sql`
3. `20260411_add_cfg_stage_notify.sql`
4. `20260411_add_notifications.sql`
5. `20260411_remove_transport_module.sql`
6. `20260412_app_rls.sql`
7. `20260412_storage_and_rls.sql`
8. `20260412_storage_policies.sql`

## Tablas principales

### Seguridad y configuración base

- `ct_settings`
- `ct_users`

### Catálogos

- `ct_providers`
- `ct_pilots`
- `ct_master_items`

### Núcleo del proceso de cobro

- `ct_cobros`
- `ct_cobro_items`

### Módulos auxiliares

- `ct_notification_templates`
- `ct_area_emails`
- `ct_critical_approvals`
- `ct_audit_log`

### Configuración avanzada

- `ct_cfg_countries`
- `ct_cfg_roles`
- `ct_cfg_user_role_scopes`
- `ct_cfg_flow_stages`
- `ct_cfg_stage_sla`
- `ct_cfg_stage_notify`
- `ct_cfg_rules`
- `ct_cfg_templates`
- `ct_cfg_auth_keys`

### Notificaciones

- `ct_notifications`

### Tablas de transporte no centrales en el flujo actual

- `ct_transport_requisitions`
- `ct_transport_billings`

## Tabla `ct_users`

Campos funcionales relevantes:

- `email`
- `nombre`
- `rol`
- `password_hash`
- `activo`
- `area`
- `country_code`

Uso:

- autenticación funcional
- permisos por rol
- segmentación por país

## Tabla `ct_cobros`

Es la entidad central del sistema.

Campos funcionales destacados:

- identificación: `id`
- proveedor: `proveedor_nombre`, `proveedor_codigo`
- operación: `unidad`, `ruta`, `c9`, `factura_ref`
- montos: `total_cobro`
- estado: `estado`, `etapa`, `etapa_anterior`
- trazabilidad: `fecha_registro`, `ultima_actualizacion`
- país: `country_code`, `country_name`
- archivos: `pdf_url`, `boleta_firmada_url`, `factura_url`, `firma_factura_url`, `constancia_pago_url`
- flujo: `area_responsable_actual`, `fecha_ingreso_etapa_actual`, `fecha_limite_sla_actual`
- observación: `motivo_observacion`, `observaciones`

## Tabla `ct_cobro_items`

Detalle de líneas del cobro:

- `cobro_id`
- `codigo`
- `descripcion`
- `cantidad`
- `precio`
- `subtotal`
- `incidencia`

## Tabla `ct_audit_log`

Se usa para trazabilidad operativa.

Campos relevantes:

- `fecha`
- `cobro_id`
- `usuario`
- `etapa`
- `accion`
- `resultado`
- `destinatario`
- `detalle`

## Multi-país

La base contempla segmentación por país mediante `country_code` en:

- usuarios
- proveedores
- pilotos
- maestro
- cobros
- tablas de configuración

## RLS

Hay scripts para habilitar Row Level Security sobre tablas `ct_*`.

Observaciones:

- el backend usa `service_role` para muchas operaciones server-to-server
- además existe una política explícita para lectura de notificaciones propias
- la autorización de negocio principal se termina aplicando en backend

## Storage

El sistema usa un bucket para PDFs y evidencias.

Nombre observado:

- `Cobros_pdf` en SQL de storage
- `cobros_pdf` como valor por defecto en `api/.env.example`

Recomendación:

- estandarizar el nombre final del bucket en todos los entornos para evitar errores por mayúsculas/minúsculas

## Observaciones importantes

- El esquema ya refleja una migración avanzada hacia Supabase.
- Parte de los datos legacy siguen siendo consumidos por código adaptado.
- Conviene mantener las migraciones como fuente de verdad para nuevos entornos.
