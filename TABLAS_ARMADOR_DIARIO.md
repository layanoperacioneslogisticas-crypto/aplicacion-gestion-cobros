# 📊 Tablas del Proyecto "Armador Diario" en Supabase

Basado en el análisis de los archivos SQL del proyecto, aquí están todas las tablas definidas en el esquema de base de datos:

## 🏗️ **TABLAS PRINCIPALES**

### 1. **`ct_settings`** - Configuraciones del sistema
- `setting_key` (PK): Clave de configuración
- `setting_value`: Valor de configuración
- `description`: Descripción
- `updated_at`: Fecha de actualización

### 2. **`ct_users`** - Usuarios del sistema
- `email` (PK): Correo electrónico del usuario
- `nombre`: Nombre completo
- `rol`: Rol del usuario
- `password_hash`: Hash de contraseña
- `activo`: Estado activo/inactivo
- `area`: Área de trabajo
- `country_code`: Código de país (default: 'PE')
- `created_at/updated_at`: Timestamps

### 3. **`ct_providers`** - Proveedores
- `codigo` (PK): Código del proveedor
- `nombre`: Nombre del proveedor
- `correo`: Correo electrónico
- `created_at/updated_at`: Timestamps

### 4. **`ct_pilots`** - Pilotos/Conductores
- `dni` (PK): DNI del piloto
- `nombre_completo`: Nombre completo
- `created_at/updated_at`: Timestamps

### 5. **`ct_master_items`** - Catálogo de productos/items
- `codigo` (PK): Código del item
- `descripcion`: Descripción del item
- `uxc`: Unidades por caja
- `precio_con_igv/sin_igv`: Precios con/sin IGV
- `ean`: Código EAN
- `activo`: Estado activo
- `created_at/updated_at`: Timestamps

## 💰 **TABLAS DE COBROS**

### 6. **`ct_cobros`** - Cobros principales
Campos principales:
- `id` (PK): ID único del cobro
- `fecha_registro`: Fecha de registro
- `proveedor_nombre/codigo`: Información del proveedor
- `unidad/ruta/c9`: Información del servicio
- `factura_ref`: Referencia de factura
- `observaciones`: Notas adicionales
- `total_cobro`: Monto total
- `estado`: Estado del cobro ('Abierto', etc.)
- `responsable`: Usuario responsable
- `piloto_nombre`: Nombre del piloto
- `items_json`: Items en formato JSON
- `etapa`: Etapa del proceso
- `bodega/licencia`: Información logística
- `pdf_url`: URL del PDF generado
- `area_responsable_actual`: Área actual responsable
- `country_code/country_name`: País
- `process_folder_id/url/name`: Carpeta del proceso
- `fecha_limite_firma_boleta`: SLA para firma
- `firma_boleta_link/url`: Enlaces de firma
- `boleta_firmada_url`: URL de boleta firmada
- `inventario_status`: Estado del inventario ('OK', 'Ajuste', 'No hay')
- `comentario_inventario`: Comentarios del inventario
- `ov_numero`: Número de orden de venta
- `ruta_id/factura_numero/url`: Información de facturación
- `fecha_limite_firma_factura`: SLA para firma de factura
- `firma_factura_link/url`: Enlaces de firma de factura
- `liquidacion_ref`: Referencia de liquidación
- `constancia_pago_url`: URL de constancia de pago
- `rm_numero`: Número de remito
- `facturas_debitar/debito_ref`: Información de débitos
- `etapa_anterior/motivo_observacion`: Historial
- `fecha_ingreso_etapa_actual/limite_sla_actual`: Control de SLA
- `email_*`: Correos por área (proveedor, inventarios, transporte, cyc, facturacion, contabilidad)
- `sla_notif`: Notificaciones SLA en JSON
- `created_at/updated_at`: Timestamps

### 7. **`ct_cobro_items`** - Items de cada cobro
- `id` (PK, auto): ID único
- `cobro_id` (FK → ct_cobros): Referencia al cobro
- `codigo/descripcion`: Información del item
- `cantidad/precio/subtotal`: Valores económicos
- `incidencia`: Notas de incidencia
- `created_at/updated_at`: Timestamps

## 🚛 **TABLAS DE TRANSPORTE** (Removidas en actualización)

*Nota: Estas tablas fueron removidas en la actualización del 11/04/2026*

### ~~`ct_transport_requisitions`~~ - Solicitudes de transporte
### ~~`ct_transport_billings`~~ - Facturación de transporte

## 📧 **TABLAS DE NOTIFICACIONES**

### 8. **`ct_notifications`** - Notificaciones del sistema
- `id` (PK): ID único de notificación
- `created_at`: Fecha de creación
- `user_email`: Usuario destinatario
- `cobro_id`: Cobro relacionado (opcional)
- `etapa/accion`: Contexto de la notificación
- `message`: Mensaje de notificación
- `read_at`: Fecha de lectura (null si no leída)

### 9. **`ct_notification_templates`** - Plantillas de notificación
- `codigo` (PK): Código de plantilla
- `asunto/cuerpo`: Contenido de la plantilla
- `activo`: Estado activo
- `notas`: Notas adicionales
- `created_at/updated_at`: Timestamps

### 10. **`ct_area_emails`** - Configuración de emails por área
- `area` (PK): Nombre del área
- `email_to/cc`: Destinatarios
- `activo`: Estado activo
- `notas`: Notas adicionales
- `created_at/updated_at`: Timestamps

## ⚙️ **TABLAS DE CONFIGURACIÓN**

### 11. **`ct_cfg_countries`** - Configuración de países
- `country_code` (PK): Código del país
- `nombre`: Nombre del país
- `moneda`: Moneda (default: 'PEN')
- `timezone`: Zona horaria (default: 'America/Lima')
- `locale`: Configuración regional (default: 'es-PE')
- `activo`: Estado activo
- `updated_at`: Timestamp

### 12. **`ct_cfg_roles`** - Roles del sistema
- `role_id` (PK): ID del rol
- `role_key`: Clave única del rol
- `role_name`: Nombre del rol
- `activo`: Estado activo
- `updated_at`: Timestamp

### 13. **`ct_cfg_user_role_scopes`** - Ámbitos de roles por usuario
- `scope_id` (PK): ID del ámbito
- `user_email`: Email del usuario
- `role_key`: Clave del rol
- `country_code`: País (opcional)
- `business_unit`: Unidad de negocio (opcional)
- `activo`: Estado activo
- `updated_at`: Timestamp

### 14. **`ct_cfg_flow_stages`** - Etapas del flujo de proceso
- `process_key + stage_order` (PK compuesta): Proceso y orden
- `stage_code`: Código de etapa
- `stage_name`: Nombre de etapa
- `required_fields/docs`: Campos/documentos requeridos (JSON)
- `activo`: Estado activo
- `created_at/updated_at`: Timestamps

### 15. **`ct_cfg_stage_sla`** - SLA por etapa
- `process_key + stage_order` (PK compuesta): Proceso y orden
- `stage_name`: Nombre de etapa
- `sla_hours`: Horas de SLA
- `activo`: Estado activo
- `notas`: Notas adicionales
- `updated_at`: Timestamp

### 16. **`ct_cfg_rules`** - Reglas de negocio
- `rule_id` (PK): ID de regla
- `nombre`: Nombre de regla
- `process_key`: Proceso (default: 'cobro_transporte')
- `prioridad`: Prioridad de ejecución
- `country_scope`: Alcance por país
- `stage_from/to`: Rango de etapas
- `trigger_event`: Evento que dispara la regla
- `condition_json/action_json`: Condiciones y acciones (JSON)
- `stop_on_match`: Detener al encontrar match
- `activo`: Estado activo
- `valid_from/to`: Vigencia
- `updated_at`: Timestamp

### 17. **`ct_cfg_templates`** - Plantillas de comunicación
- `template_id` (PK): ID de plantilla
- `event_key`: Clave del evento
- `country_code`: País (default: '*')
- `language`: Idioma (default: 'es')
- `channel`: Canal (default: 'email')
- `subject/body`: Asunto y cuerpo
- `activo`: Estado activo
- `updated_at`: Timestamp

### 18. **`ct_cfg_auth_keys`** - Claves de autorización
- `key_id` (PK): ID de clave
- `nombre`: Nombre de la clave
- `clave_hash`: Hash de la clave
- `scope`: Alcance de permisos
- `activo`: Estado activo
- `max_usos/usos_actuales`: Control de uso
- `ultimo_uso_at`: Último uso
- `notas`: Notas adicionales
- `updated_at`: Timestamp

## 🔐 **TABLAS DE SEGURIDAD Y AUDITORÍA**

### 19. **`ct_critical_approvals`** - Aprobaciones críticas
- `solicitud_id` (PK): ID de solicitud
- `fecha_solicitud`: Fecha de solicitud
- `tipo`: Tipo de aprobación
- `cobro_id`: Cobro relacionado
- `solicitado_por`: Usuario solicitante
- `motivo`: Motivo de la solicitud
- `payload`: Datos adicionales (JSON)
- `estado`: Estado ('Pendiente', etc.)
- `aprobado_por`: Usuario aprobador
- `fecha_resolucion`: Fecha de resolución
- `comentario`: Comentarios (JSON)
- `usado`: Si fue utilizado
- `created_at/updated_at`: Timestamps

### 20. **`ct_audit_log`** - Log de auditoría
- `id` (PK, auto): ID único
- `fecha`: Fecha del evento
- `cobro_id`: Cobro relacionado (opcional)
- `usuario`: Usuario que realizó la acción
- `etapa/accion`: Contexto de la acción
- `resultado`: Resultado de la acción
- `destinatario`: Destinatario (opcional)
- `detalle`: Detalles adicionales
- `created_at`: Timestamp

## 📊 **RESUMEN DE TABLAS**

**Total de tablas:** 20

**Por categoría:**
- Principales: 5 tablas
- Cobros: 2 tablas
- Transporte: 2 tablas (removidas)
- Notificaciones: 3 tablas
- Configuración: 8 tablas
- Seguridad/Auditoría: 2 tablas

**Principales índices creados:**
- `ct_users_email_ci_uidx`: Email de usuarios (case insensitive)
- `ct_users_country_code_idx`: País de usuarios
- `ct_providers_nombre_idx`: Nombre de proveedores
- `ct_master_items_activo_idx`: Items activos
- `ct_cobros_*_idx`: Múltiples índices en tabla de cobros
- `ct_notifications_*_idx`: Índices en notificaciones

## 🔗 **RELACIONES PRINCIPALES**

- `ct_cobro_items.cobro_id` → `ct_cobros.id` (Cascade delete)
- `ct_transport_billings.req_id` → `ct_transport_requisitions.req_id` (Set null)
- `ct_cfg_user_role_scopes` referencia roles y países
- `ct_cfg_flow_stages` y `ct_cfg_stage_sla` usan claves compuestas

## 📝 **Notas Importantes**

1. **País por defecto**: Perú ('PE') en múltiples tablas
2. **Moneda por defecto**: PEN (Soles peruanos)
3. **Idioma por defecto**: Español ('es')
4. **Timezone por defecto**: America/Lima
5. **Proceso principal**: 'cobro_transporte'
6. **RLS**: Políticas de seguridad activas (ver archivos RLS)
7. **Storage**: Bucket 'Cobros_pdf' configurado

Esta estructura soporta un sistema completo de gestión de cobros de transporte con flujos de trabajo, SLA, notificaciones, auditoría y configuraciones multi-país.