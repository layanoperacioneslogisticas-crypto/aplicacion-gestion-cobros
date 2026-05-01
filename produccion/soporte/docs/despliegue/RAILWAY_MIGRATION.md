# Migracion de GAS a Railway

## Estado actual

La app legacy de `Frontend_gas/Index.html` ahora se sirve desde `api` en Railway.

El backend Express:

- sirve la UI legacy en `/`
- expone RPC HTTP en `/rpc/:metodo` consumido por un cliente `fetch` nativo en el frontend
- ejecuta gran parte de la logica original de `Backend_gas/code.gs` desde Node
- usa Supabase como datastore
- usa Supabase Storage para archivos nuevos servidos por `/files/:id`

## Despliegue activo

- Proyecto Railway: `secure-mindfulness`
- Servicio Railway: `aplicacion-gestion-cobros`
- URL publica: `https://aplicacion-gestion-cobros-production.up.railway.app`
- Healthcheck: `/health`

## Variables recomendadas en Railway

- `APP_BASE_URL`
- `PORT`
- `CORS_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_STORAGE_BUCKET`
- `AWS_REGION`
- `SES_FROM_EMAIL`
- `SES_REPLY_TO`
- `TZ`

## Valor de bucket

El bucket detectado en remoto es:

```text
cobros_pdf
```

## Arranque

Desde la raiz del repo:

```bash
npm start
```

Eso ejecuta:

```bash
npm --prefix api start
```

## Endpoints importantes

- `/` - app legacy migrada
- `/health` - healthcheck
- `/rpc/:metodo` - endpoint RPC HTTP para la UI legacy
- `/files/:id` - proxy de archivos desde Supabase Storage
- `/storage-browser` - vista simple del arbol de archivos migrados

## Notas

- La lectura de catalogos, gestion, historial, flujo, reportes, configuracion y varios modulos legacy ya corre desde Node usando el runtime GAS.
- Los archivos nuevos ya salen a Supabase Storage en vez de Google Drive.
- La eliminacion de cobros ya limpia archivos migrados en Supabase Storage.
- La app mantiene compatibilidad con URLs legacy que ya existian en registros anteriores.
