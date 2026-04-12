# Autenticación de Supabase CLI

El login interactivo de Supabase CLI necesita completarse con credenciales. 

## Opción 1: Usar Token de Acceso (Recomendado)

### Obtener tu token:
1. Ve a: https://supabase.com/dashboard/account/tokens
2. Crea un nuevo token personal con acceso completo
3. Copia el token

### Autenticarse con el token:
```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
supabase login --token YOUR_TOKEN_HERE
```

Reemplaza `YOUR_TOKEN_HERE` con tu token real.

### Verificar que funcionó:
```powershell
supabase link --project-ref YOUR_PROJECT_ID
```

Reemplaza `YOUR_PROJECT_ID` con el ID de tu proyecto Supabase.

## Opción 2: Usar Variable de Entorno

Si prefieres no pasar el token en el comando:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "YOUR_TOKEN_HERE"
supabase link --project-ref YOUR_PROJECT_ID
```

Or set it permanently in your profile:
```powershell
[System.Environment]::SetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', 'YOUR_TOKEN_HERE', [System.EnvironmentVariableTarget]::User)
```

## Opción 3: Login Manual en navegador

Si el login interactivo no funciona, puedes:

1. Abre en navegador: https://app.supabase.com
2. Inicia sesión con tu cuenta
3. Ve a Settings → Account → Access Tokens
4. Crea un nuevo token
5. Usa el comando de la Opción 1

## Lo que necesitas después de autenticarte:

1. **Project ID**: [Settings → General](https://supabase.com/dashboard/project/_/settings/general) - `Project ID`
2. **Project URL**: `https://YOUR_PROJECT_ID.supabase.co`
3. **Anon Key**: [Settings → API Keys](https://supabase.com/dashboard/project/_/settings/api) - `anon key`
4. **Service Role Key**: [Settings → API Keys](https://supabase.com/dashboard/project/_/settings/api) - `service_role key`
5. **JWT Secret**: [Settings → API Keys](https://supabase.com/dashboard/project/_/settings/api) - `JWT Secret`

## Próximos pasos (después de autenticarte):

### 1. Vincular proyecto remoto al local:
```powershell
supabase link --project-ref YOUR_PROJECT_ID
```

### 2. Descargar esquema remoto:
```powershell
supabase local pull
```

### 3. Aplicar migraciones locales a remoto:
```powershell
supabase db push
```

### 4. Iniciar desarrollo local (requiere Docker):
```powershell
docker run -d --name supabase -p 54321:54321 supabase/postgres
supabase start
```

## Troubleshooting

### Error: "failed to scan line"
- Esto ocurre cuando hay problemas con entrada/salida en modo interactivo
- **Solución**: Usa `supabase login --token YOUR_TOKEN` en su lugar

### Error: "Access token not provided"
- **Solución**: Asegúrate de pasar el token o la variable de entorno SUPABASE_ACCESS_TOKEN

### Error: "Directory '.supabase' not found"
- **Solución ejecutada**: Ya se creó el directorio en `~/.supabase`

## Archivos de configuración generados:

- `.supabase/profile` - Perfil de Supabase CLI (se crea después de login)
- `supabase/.env` - Variables de entorno locales (se crea después de vincular)
- `supabase/config.toml` - Configuración del proyecto local (ya existe)
