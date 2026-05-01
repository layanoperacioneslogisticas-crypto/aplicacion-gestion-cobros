# API

## Base URL

En local:

```text
http://localhost:3001
```

## Salud

### `GET /health`

Respuesta esperada:

```json
{
  "ok": true,
  "ts": "2026-04-30T00:00:00.000Z"
}
```

## Interfaz heredada

### `GET /`

Sirve `Frontend_gas/Index.html`.

### `GET /files/:id`

Descarga un archivo desde Storage usando un identificador codificado.

### `GET /storage-browser`

Explorador de archivos legacy.

## Autenticación

Las rutas de `/cobros` requieren:

```http
Authorization: Bearer <supabase_access_token>
```

El middleware resuelve:

- usuario autenticado
- rol
- área
- país
- permisos de admin o supervisor

## API moderna de cobros

### `GET /cobros`

Lista cobros con filtros.

Query params soportados:

- `limit`
- `offset`
- `estado`
- `etapa`
- `q`
- `desde`
- `hasta`

### `GET /cobros/:id`

Obtiene el detalle completo del cobro y sus items.

### `POST /cobros/:id/etapa`

Cambia la etapa de un cobro.

Body mínimo:

```json
{
  "etapa": "2. Firma boleta pendiente"
}
```

Valida:

- transición permitida por área/rol
- requisitos documentales o de datos para la etapa destino
- restricción por país

### `PATCH /cobros/:id/campos`

Actualiza campos operativos permitidos.

Campos observados:

- `boleta_firmada_url`
- `firma_boleta_url`
- `inventario_status`
- `comentario_inventario`
- `ov_numero`
- `ruta_id`
- `factura_numero`
- `factura_url`
- `firma_factura_url`
- `liquidacion_ref`
- `constancia_pago_url`
- `facturas_debitar`
- `debito_ref`
- `rm_numero`
- `motivo_observacion`
- `observaciones`
- `pdf_url`

## API principal de aplicación `/api`

Esta capa concentra lógica de negocio migrada o adaptada desde Apps Script.

## Sesión

### `POST /api/session/login`

Body:

```json
{
  "email": "usuario@dominio.com",
  "password": "secreto"
}
```

### `GET /api/session/restore`

Query:

- `email`

## Bootstrap y catálogos

### `GET /api/bootstrap`

Query:

- `actorEmail`

### `GET /api/catalog/responsables`

### `GET /api/catalog/etapas-cobro`

## Dashboard y reportes

### `GET /api/dashboard/stats`

### `GET /api/reports/advanced`

Query:

- `inicio`
- `fin`
- `actorEmail`

### `GET /api/history/cobros`

Query:

- `limit`
- `actorEmail`

## Storage

### `GET /api/storage/pdf-root`

### `GET /api/storage/pdf-root/meta`

## Notificaciones

### `GET /api/notifications`

Query:

- `actorEmail`
- `limit`
- `includeRead`
- `force`

### `POST /api/notifications/:id/read`

### `POST /api/notifications/read-all`

## Gestión de cobros

### `GET /api/gestion/snapshot`

### `GET /api/gestion/resumen`

### `POST /api/gestion/delete`

Body esperado:

- `ids`
- `authKey`
- `motivo`
- `actorEmail`
- `actorCtx`

### `POST /api/gestion/responsable/bulk`

### `POST /api/gestion/observado/bulk`

### `POST /api/gestion/pdfs/zip`

## Flujo de cobro

### `GET /api/cobros/:id/timeline`

### `GET /api/cobros/:id/flow`

### `POST /api/cobros`

Registra o procesa un cobro.

### `POST /api/cobros/:id/etapa`

### `PATCH /api/cobros/:id/campos`

### `POST /api/cobros/:id/observado`

### `POST /api/cobros/:id/observado/revertir`

### `POST /api/cobros/:id/anular`

### `POST /api/cobros/:id/files`

Sube archivos del flujo.

Body esperado:

- `fieldName`
- `fileName`
- `mimeType`
- `dataUrl`
- `actorEmail`
- `actorCtx`

## Aprobaciones críticas

### `GET /api/aprobaciones-criticas`

### `POST /api/aprobaciones-criticas/:solicitudId/resolve`

## Administración

### Usuarios

- `GET /api/admin/users`
- `POST /api/admin/users`
- `DELETE /api/admin/users/:row`

### Proveedores

- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `DELETE /api/admin/providers/:row`

### Pilotos

- `GET /api/admin/pilots`
- `POST /api/admin/pilots`
- `DELETE /api/admin/pilots/:row`

### Maestro

- `GET /api/admin/maestro`
- `GET /api/admin/maestro.json`
- `GET /api/admin/maestro/debug`
- `POST /api/admin/maestro/import`
- `POST /api/admin/maestro/:row/toggle-active`
- `POST /api/admin/maestro`
- `DELETE /api/admin/maestro/:row`

### Notificaciones automáticas

- `POST /api/admin/notifications/daily-overdue/run`

## Configuración

### Reglas y catálogos

- `GET /api/config/rules`
- `POST /api/config/countries`
- `DELETE /api/config/countries/:row`
- `POST /api/config/roles`
- `DELETE /api/config/roles/:row`
- `POST /api/config/stage-sla`
- `POST /api/config/stage-notify`
- `POST /api/config/rules`
- `DELETE /api/config/rules/:row`
- `POST /api/config/auth-keys`
- `DELETE /api/config/auth-keys/:row`
- `POST /api/config/correos`
- `DELETE /api/config/correos/:row`

### Transporte de correo

- `POST /api/config/mail-transport`
- `GET /api/config/mail-transport/validate`
- `POST /api/config/mail-transport/test`

### Triggers

- `POST /api/config/triggers/daily-sla-digest/install`

## Manejo de errores

Convenciones observadas:

- errores funcionales: `400`
- no encontrado: `404`
- sin permiso o acceso restringido: `403`
- errores internos: `500`

En modo no productivo, varias rutas devuelven `stack`.
