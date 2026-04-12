# Configuración de Supabase

Este proyecto está preparado para usar Supabase como base de datos y autenticación.

## Requisitos
- [Supabase CLI](https://supabase.com/docs/guides/cli) (ya disponible en `.tools/supabase-cli/`)
- Un proyecto de Supabase activo en [supabase.com](https://supabase.com)

## Pasos para vincular Supabase

### 1. Crear un proyecto en Supabase
1. Accede a [supabase.com](https://supabase.com)
2. Crea una nueva organización y proyecto
3. Anota tu **Project ID** y **Project URL**

### 2. Autenticar Supabase CLI
```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
.\.tools\supabase-cli\supabase.exe login
```

Ingresa tu token de acceso de Supabase (disponible en tu panel de control).

### 3. Vincular el proyecto local a Supabase
```powershell
.\.tools\supabase-cli\supabase.exe link --project-ref YOUR_PROJECT_ID
```

Reemplaza `YOUR_PROJECT_ID` con el ID real de tu proyecto.

### 4. Configurar variables de entorno

#### Para el Frontend (`web/.env.local`):
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_API_BASE_URL=http://localhost:3001
```

#### Para el Backend (`api/.env.local`):
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET=YOUR_JWT_SECRET
SUPABASE_STORAGE_BUCKET=Cobros_pdf
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM=YOUR_RESEND_EMAIL
RESEND_REPLY_TO=YOUR_REPLY_TO_EMAIL
```

### 5. Obtener las credenciales
Las credenciales están disponibles en la consola de Supabase:
- **ANON_KEY**: Settings → API → `anon` key
- **SERVICE_ROLE_KEY**: Settings → API → `service_role` key  
- **JWT_SECRET**: Settings → API → JWT Secret
- **Project URL**: Settings → API → Project URL

### 6. Aplicar migraciones de base de datos
```powershell
.\.tools\supabase-cli\supabase.exe db push
```

Esto ejecutará todos los archivos SQL en `sql_supabase/` que creen el esquema necesario.

### 7. Iniciar el desarrollo
```powershell
# Terminal 1: Frontend
cd web
npm install
npm run dev

# Terminal 2: Backend
cd api
npm install
npm run dev
```

## Estructura de la Base de Datos
El esquema se define en los archivos SQL bajo `sql_supabase/`:
- `20260409_cobro_transporte_schema.sql` - Esquema principal
- `20260410_add_country_to_catalogs.sql` - Catálogos
- `20260411_*.sql` - Configuraciones y notificaciones
- `20260412_*.sql` - RLS y Políticas de seguridad

## Almacenamiento
- **Bucket**: `Cobros_pdf` 
- Ubicación: Supabase Storage (configurado en `api/.env`)
