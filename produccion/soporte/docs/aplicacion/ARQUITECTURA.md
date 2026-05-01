# Arquitectura

## Visión general

La aplicación combina una arquitectura moderna basada en Supabase con una capa de compatibilidad para conservar lógica histórica escrita en Google Apps Script.

## Componentes

### Backend `api`

Responsabilidades:

- exponer endpoints HTTP
- validar JWT de Supabase
- recuperar el perfil funcional del usuario
- operar sobre tablas `ct_*`
- generar y subir PDFs
- servir la interfaz heredada
- ejecutar lógica legacy desde Node

Archivos clave:

- `api/src/server.js`: arranque del servidor y montaje de rutas
- `api/src/middleware/auth.js`: autenticación y perfil de usuario
- `api/src/routes/appApi.js`: API principal compatible con lógica heredada
- `api/src/routes/cobros.js`: endpoints modernos de cobros
- `api/src/routes/legacy.js`: frontend legado y navegación de archivos
- `api/src/services/supabase.js`: cliente admin y utilidades de usuario
- `api/src/services/legacySpecial.js`: operaciones especiales migradas
- `api/src/gas/runtime.js`: runtime para ejecutar código Apps Script

### Frontend React `web`

Hoy cumple una función base:

- iniciar sesión con Supabase
- mantener la sesión del usuario
- servir de punto de partida para un frontend moderno

Archivos clave:

- `web/src/App.jsx`
- `web/src/auth/AuthGate.jsx`
- `web/src/api.js`
- `web/src/supabaseClient.js`

### Frontend heredado `Frontend_gas`

La ruta `/` del backend responde el HTML de `Frontend_gas/Index.html`. Esto permite mantener operativa la interfaz histórica aun después de la migración del backend.

### Código legado `Backend_gas`

El backend Node reutiliza parte del código histórico leyendo y ejecutando funciones desde archivos `.gs`, especialmente:

- `Backend_gas/code.gs`
- `Backend_gas/supabase_adapter.gs`

## Flujo de autenticación

1. El usuario inicia sesión con `supabase.auth.signInWithPassword`.
2. Supabase entrega una sesión con access token.
3. El frontend envía `Authorization: Bearer <token>` a rutas protegidas.
4. `requireAuth` valida el token con Supabase.
5. El backend consulta `ct_users` para enriquecer el perfil con:
- `rol`
- `area`
- `country_code`
- privilegios de admin/supervisor

## Flujo funcional de cobros

1. Se registra un cobro.
2. El cobro avanza por etapas operativas.
3. Cada etapa exige ciertos datos o documentos.
4. Se guardan evidencias PDF y archivos en Storage.
5. Los cambios relevantes se auditan.
6. El estado y el área responsable cambian conforme al avance.

Etapas observadas en el código:

1. `1. Boleta generada`
2. `2. Firma boleta pendiente`
3. `3. Inventario pendiente`
4. `4. OV / Pedido pendiente`
5. `5. Ruta generada`
6. `6. Ruta facturada (Factura emitida)`
7. `7. Firma factura pendiente`
8. `8. Ruta liquidada`
9. `9. Gestionar pago`
10. `10. Aplicación de pago`

## Capas de API

### Capa moderna

`/cobros` usa consultas directas a Supabase y reglas de autorización en Node.

### Capa de compatibilidad

`/api` delega muchos casos de uso a:

- funciones heredadas del runtime GAS
- adaptadores especiales en `legacySpecial.js`

Esto reduce riesgo funcional durante la migración.

## Archivos y PDFs

La app usa Supabase Storage para:

- PDF generado de cobro
- boleta firmada
- factura
- firma de factura
- constancia de pago
- ZIPs de gestión

El backend incluye helpers para:

- construir URLs de archivos
- subir objetos
- descargar objetos
- borrar objetos
- explorar prefijos legacy

## Notificaciones y correo

La solución contempla:

- plantillas de notificación
- notificaciones internas por usuario
- envíos por correo
- reglas SLA por etapa

En Railway, el envío de correo se soporta con Amazon SES mediante:

- `AWS_REGION`
- `SES_FROM_EMAIL`
- `SES_REPLY_TO`

## Multi-país

La solución está preparada para operar por país con:

- `country_code`
- `country_name`
- catálogos filtrados por país
- restricciones de acceso por país en backend

## Observaciones de arquitectura

- La app está en transición desde Apps Script hacia Node/Supabase.
- La interfaz moderna todavía no cubre todo el negocio.
- El backend es la pieza central de integración entre legado y migración.
