# Estructura del proyecto

## Carpetas principales

- `api/`: backend Node/Express que ejecuta la API principal.
- `web/`: frontend React/Vite.
- `Backend_gas/`: scripts de Google Apps Script del backend legado o de integración.
- `Frontend_gas/`: frontend legado en Google Apps Script.
- `supabase/`: configuración y recursos de Supabase.
- `sql_supabase/`: consultas y scripts SQL del proyecto.

## Soporte y documentación

- `docs/base-datos/`: documentación operativa y técnica de Supabase.
- `docs/despliegue/`: documentación de despliegue y migraciones.
- `scripts/supabase/`: scripts auxiliares para acceso y configuración remota.

## Archivos que permanecen en la raíz

- `package.json`: configuración de arranque para Railway.
- `package-lock.json`: lockfile del paquete raíz.
- `railway.toml`: configuración de despliegue en Railway.
- `.gitignore`: reglas de exclusión de Git.
