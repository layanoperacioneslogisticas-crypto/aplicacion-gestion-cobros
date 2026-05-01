# Acceso Remoto a Supabase

## Estado correcto para esta CLI

La forma soportada de autenticar la CLI es:

- `supabase login --token TU_TOKEN`
- o la variable de entorno `SUPABASE_ACCESS_TOKEN`

No edites `~/.supabase/profile`. Ese archivo legacy puede romper la CLI con el error `Unsupported Config Type ""`.

## Paso 1: obtener tu token

1. Ve a https://supabase.com/dashboard/account/tokens
2. Crea un token personal.
3. Guardalo en un lugar seguro.

## Paso 2: autenticar la CLI

Con la CLI incluida en este repo:

```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
.\.tools\supabase-cli\supabase.exe login --token TU_TOKEN --yes
```

Alternativa temporal:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "TU_TOKEN"
.\.tools\supabase-cli\supabase.exe projects list
```

## Paso 3: verificar acceso remoto

```powershell
.\.tools\supabase-cli\supabase.exe projects list
```

Debes ver tus proyectos remotos.

## Paso 4: vincular el proyecto local

```powershell
.\.tools\supabase-cli\supabase.exe link --project-ref TU_PROJECT_ID --yes
```

En este repo, el proyecto remoto esperado es:

```text
apauqolrxddmpqtlbffx
```

## Paso 5: explorar la base remota

La CLI incluida en este repo es `2.84.2`, asi que usa `supabase inspect db ...`.
No existe `supabase db inspect --schema ...` en esta version.

```powershell
.\.tools\supabase-cli\supabase.exe inspect db table-stats --linked
.\.tools\supabase-cli\supabase.exe inspect db db-stats --linked
.\.tools\supabase-cli\supabase.exe db dump --schema public > esquema_public.sql
```

## Script incluido

Tambien puedes usar el script del repo:

```powershell
.\acceder-supabase-remoto.ps1 -Token "TU_TOKEN" -ProjectRef "apauqolrxddmpqtlbffx"
```

El script:

- autentica la CLI correctamente
- respalda un `~/.supabase/profile` legacy si existe
- lista proyectos
- vincula el proyecto remoto

## Nota sobre comandos de base

Algunos comandos de base pueden requerir conectividad directa adicional o reintento si el pooler remoto responde con limites temporales.
Para validacion rapida, `inspect db table-stats --linked` es un buen primer comando.

## Solucion de problemas

### Error: `Unsupported Config Type ""`

Hay un archivo legacy en `C:\Users\Luis\.supabase\profile`.

Solucion:

1. respalda o elimina ese archivo
2. vuelve a ejecutar `supabase login --token TU_TOKEN --yes`

### Error: `Access token not provided`

Vuelve a autenticar:

```powershell
.\.tools\supabase-cli\supabase.exe login --token TU_TOKEN --yes
```

O exporta temporalmente la variable:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "TU_TOKEN"
```
