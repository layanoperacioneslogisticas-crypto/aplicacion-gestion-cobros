# Operación

## Carpetas importantes para el equipo

- `api/`: backend operativo
- `web/`: frontend React base
- `Frontend_gas/`: interfaz histórica
- `Backend_gas/`: lógica heredada utilizada por el runtime
- `sql_supabase/`: scripts de esquema y políticas
- `soporte/scripts/`: utilitarios

## Arranque rápido local

### Backend

```powershell
npm --prefix api run dev
```

### Frontend React

```powershell
npm --prefix web run dev
```

### Frontend legado

Abrir:

```text
http://localhost:3001/
```

## Qué revisar cuando algo falla

### Error de autenticación

Revisar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- validez del access token
- existencia del usuario en `ct_users`

### Error 401 o 403 en `/cobros`

Revisar:

- encabezado `Authorization`
- correo del usuario autenticado
- `rol`
- `area`
- `country_code`
- si el cobro pertenece al país permitido

### Error al subir o leer PDFs

Revisar:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- políticas del bucket
- nombre real del bucket en Supabase

### Error en correo

Revisar:

- `AWS_REGION`
- `SES_FROM_EMAIL`
- `SES_REPLY_TO`
- configuración de plantillas y destinatarios

### Error en lógica legacy

Revisar:

- `Backend_gas/code.gs`
- `Backend_gas/supabase_adapter.gs`
- `api/src/gas/runtime.js`
- `api/src/services/legacySpecial.js`

## Flujo operativo típico

1. El usuario inicia sesión.
2. Crea o consulta un cobro.
3. Adjunta documentos del flujo.
4. Avanza etapas según permisos y requisitos.
5. El sistema audita cambios y puede emitir notificaciones.

## Mantenimiento recomendado

- mantener sincronizadas las migraciones SQL con producción
- documentar cualquier cambio de etapas o reglas
- revisar periódicamente `ct_audit_log`
- validar bucket y políticas tras cambios de entorno
- reducir gradualmente dependencia del runtime legacy

## Próximos trabajos sugeridos

- ampliar el frontend React para reemplazar el frontend legado
- estandarizar naming del bucket Storage
- centralizar la documentación funcional por módulo
- agregar pruebas automáticas para rutas críticas
