# Gestión de Cobros Transporte

Aplicación para registrar, gestionar y auditar cobros de transporte con soporte para flujo por etapas, catálogos por país, almacenamiento de PDFs en Supabase Storage, autenticación con Supabase Auth y compatibilidad con lógica heredada de Google Apps Script.

## Qué incluye este proyecto

- `api/`: backend Node.js + Express que expone la API y ejecuta parte de la lógica migrada desde Google Apps Script.
- `web/`: frontend React/Vite con autenticación por Supabase.
- `Backend_gas/`: código heredado de Apps Script reutilizado por el runtime del backend.
- `Frontend_gas/`: HTML legado servido por la ruta raíz del backend.
- `sql_supabase/`: esquema y migraciones SQL.
- `supabase/`: configuración local de Supabase.
- `soporte/`: documentación operativa y scripts auxiliares.

## Estado funcional actual

El proyecto tiene dos capas de interfaz:

- `Frontend_gas/Index.html`: interfaz heredada principal, servida por `GET /`.
- `web/`: frontend moderno base. Hoy incluye autenticación y el esqueleto inicial para crecer sobre la API.

El backend también tiene dos enfoques:

- rutas modernas sobre Supabase, como `/cobros`.
- rutas de compatibilidad que ejecutan lógica heredada, principalmente bajo `/api`.

## Arquitectura resumida

1. El usuario inicia sesión con Supabase Auth.
2. El frontend obtiene un JWT de Supabase.
3. El backend valida ese JWT y recupera el perfil del usuario desde `ct_users`.
4. La API opera sobre tablas `ct_*` en Supabase.
5. Para varios flujos administrativos y de proceso, el backend reutiliza lógica heredada de Apps Script mediante un runtime Node.
6. Los PDFs y evidencias se guardan en Supabase Storage.

## Variables de entorno

### Backend `api/.env`

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
APP_BASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=cobros_pdf
AWS_REGION=
SES_FROM_EMAIL=
SES_REPLY_TO=
```

Notas:

- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` pueden inferirse desde `Backend_gas/supabase_adapter.gs` si ese bootstrap legacy existe.
- `SUPABASE_STORAGE_BUCKET` se usa para PDFs y archivos del proceso.
- `AWS_REGION`, `SES_FROM_EMAIL` y `SES_REPLY_TO` habilitan envío de correos con Amazon SES desde Railway/Node.

### Frontend `web/.env`

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:3001
```

## Ejecución local

### 1. Instalar dependencias

Desde `produccion`:

```powershell
npm install
npm --prefix api install
npm --prefix web install
```

### 2. Configurar variables

- copiar `api/.env.example` a `api/.env`
- copiar `web/.env.example` a `web/.env`
- completar credenciales de Supabase y, si aplica, Amazon SES

### 3. Levantar backend

```powershell
npm --prefix api run dev
```

### 4. Levantar frontend React

```powershell
npm --prefix web run dev
```

### 5. Probar frontend legado

Con el backend encendido:

```text
http://localhost:3001/
```

## Despliegue en Railway

La raíz de despliegue es `produccion/`.

- `package.json` raíz instala dependencias de `api` en `postinstall`
- `npm start` ejecuta `api/src/server.js`
- `railway.toml` usa `/health` como healthcheck

## Documentación técnica

- [Arquitectura](./soporte/docs/aplicacion/ARQUITECTURA.md)
- [API](./soporte/docs/aplicacion/API.md)
- [Base de Datos](./soporte/docs/aplicacion/BASE_DE_DATOS.md)
- [Operación](./soporte/docs/aplicacion/OPERACION.md)
- [Despliegue](./soporte/docs/aplicacion/DESPLIEGUE.md)

## Documentación operativa existente

- `soporte/docs/base-datos/`: guías previas de Supabase y tablas
- `soporte/docs/despliegue/`: notas previas de migración
- `soporte/scripts/`: scripts auxiliares

## Puntos importantes del sistema

- El backend expone `GET /health` para monitoreo.
- `GET /` sirve el frontend legado.
- `/api` concentra gran parte de la lógica migrada/compatible con Apps Script.
- `/cobros` concentra operaciones modernas autenticadas sobre `ct_cobros`.
- La autorización depende de `ct_users`, `rol`, `area` y `country_code`.
- Hay separación por país en catálogos y cobros.
- Existe trazabilidad en `ct_audit_log`.

## Limitaciones conocidas

- El frontend React actual todavía es básico y no reemplaza por completo al frontend legado.
- Parte de la lógica de negocio crítica sigue encapsulada en el runtime que interpreta código heredado.
- La codificación de algunos textos heredados muestra tildes dañadas en ciertos archivos históricos.
