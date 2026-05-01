# Despliegue

## Entorno objetivo

El proyecto está preparado para desplegarse en Railway con Node.js 20+.

## Archivos de despliegue

- `package.json` raíz
- `package-lock.json`
- `railway.toml`

## Comportamiento en Railway

`package.json` raíz:

- ejecuta `npm --prefix api install --omit=dev` en `postinstall`
- inicia la API con `npm --prefix api start`

`railway.toml`:

- builder: `RAILPACK`
- start command: `npm start`
- healthcheck: `/health`

## Variables requeridas

### Backend

- `PORT`
- `CORS_ORIGIN`
- `APP_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_STORAGE_BUCKET`
- `AWS_REGION`
- `SES_FROM_EMAIL`
- `SES_REPLY_TO`

### Frontend React

Si el frontend React se despliega aparte o se construye para otro hosting:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

## Secuencia sugerida de despliegue

1. Crear o preparar el proyecto Supabase.
2. Ejecutar las migraciones SQL.
3. Crear/configurar el bucket de Storage.
4. Cargar variables de entorno en Railway.
5. Desplegar el backend.
6. Verificar `GET /health`.
7. Probar autenticación, creación de cobros y subida de archivos.

## Verificaciones posteriores

- la ruta `/health` responde OK
- la ruta `/` sirve la interfaz legacy
- el login contra Supabase funciona
- las rutas autenticadas responden con JWT válido
- el bucket de Storage permite subir y leer PDFs
- el envío de correo funciona si Amazon SES está configurado

## Riesgos a vigilar

- diferencia entre `Cobros_pdf` y `cobros_pdf`
- dependencia residual de bootstrap legacy para credenciales Supabase
- divergencia entre frontend React y frontend legado
- lógicas críticas todavía centralizadas en el runtime heredado
