# Autenticacion de Supabase CLI

## Metodo recomendado

Para esta version de la CLI, autentica usando:

```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
.\.tools\supabase-cli\supabase.exe login --token TU_TOKEN --yes
```

Alternativa temporal:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "TU_TOKEN"
.\.tools\supabase-cli\supabase.exe projects list
```

No edites `~/.supabase/profile`. Ese archivo legacy puede hacer que la CLI falle con `Unsupported Config Type ""`.

## Verificar que funciono

```powershell
.\.tools\supabase-cli\supabase.exe projects list
.\.tools\supabase-cli\supabase.exe link --project-ref YOUR_PROJECT_ID --yes
```

## Datos que necesitas despues de autenticarte

1. Project ID: Settings -> General -> `Project ID`
2. Project URL: `https://YOUR_PROJECT_ID.supabase.co`
3. Anon Key: Settings -> API Keys -> `anon`
4. Service Role Key: Settings -> API Keys -> `service_role`
5. JWT Secret: Settings -> API Keys -> `JWT Secret`

## Proximos pasos

```powershell
.\.tools\supabase-cli\supabase.exe link --project-ref YOUR_PROJECT_ID --yes
.\.tools\supabase-cli\supabase.exe db push
```

## Troubleshooting

### Error: `Access token not provided`

Vuelve a autenticar con `login --token` o define `SUPABASE_ACCESS_TOKEN`.

### Error: `Unsupported Config Type ""`

Hay un archivo legacy en `C:\Users\Luis\.supabase\profile`.

Respaldalo o eliminelo y autentica otra vez:

```powershell
.\.tools\supabase-cli\supabase.exe login --token TU_TOKEN --yes
```

## Archivos relevantes

- `supabase/config.toml` - configuracion del proyecto local
- `supabase/.env` - variables locales despues de vincular
- credencial del token en el administrador del sistema o fallback interno de la CLI
