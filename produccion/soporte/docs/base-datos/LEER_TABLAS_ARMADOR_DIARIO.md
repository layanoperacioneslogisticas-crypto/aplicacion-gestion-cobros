# Acceso a tablas del proyecto "Armadordiario"

## Estado actual

La autenticacion correcta para esta CLI se hace con:

- `supabase login --token TU_TOKEN`
- o `SUPABASE_ACCESS_TOKEN`

No uses `~/.supabase/profile`. Ese archivo legacy puede romper la CLI.

## Paso 1: autenticar

```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
.\.tools\supabase-cli\supabase.exe login --token TU_TOKEN --yes
```

Alternativa temporal:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "TU_TOKEN"
```

## Paso 2: verificar proyectos

```powershell
.\.tools\supabase-cli\supabase.exe projects list
```

## Paso 3: vincular el proyecto

```powershell
.\.tools\supabase-cli\supabase.exe link --project-ref apauqolrxddmpqtlbffx --yes
```

## Paso 4: inspeccionar tablas

La CLI incluida en este repo es `2.84.2`, por eso los comandos validos son `supabase inspect db ...`.

```powershell
.\.tools\supabase-cli\supabase.exe inspect db table-stats --linked
.\.tools\supabase-cli\supabase.exe inspect db db-stats --linked
```

## Exportar esquema

```powershell
.\.tools\supabase-cli\supabase.exe db dump --schema public > esquema_armador_diario.sql
```

## Ver tablas por SQL

Si necesitas algo mas especifico que estadisticas, usa `db query --linked` o el SQL Editor de Supabase Studio.

## Archivos SQL del repo

- `sql_supabase/20260409_cobro_transporte_schema.sql`
- `sql_supabase/20260410_add_country_to_catalogs.sql`
- `sql_supabase/20260411_add_cfg_stage_notify.sql`
- `sql_supabase/20260411_add_notifications.sql`
- `sql_supabase/20260411_remove_transport_module.sql`
- `sql_supabase/20260412_app_rls.sql`
- `sql_supabase/20260412_storage_and_rls.sql`
- `sql_supabase/20260412_storage_policies.sql`

## Si aparece el error `Unsupported Config Type ""`

Existe un archivo legacy en `C:\Users\Luis\.supabase\profile`.

Respaldalo o eliminelo y luego ejecuta:

```powershell
.\.tools\supabase-cli\supabase.exe login --token TU_TOKEN --yes
```
