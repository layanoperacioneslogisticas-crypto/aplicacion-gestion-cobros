# Acceso a Tablas del Proyecto "Armador Diario"

## Estado Actual
❌ **Autenticación pendiente**: Necesitas configurar tu token de acceso de Supabase

## Configuración del Token de Acceso

### Paso 1: Obtener tu token
1. Ve a: https://supabase.com/dashboard/account/tokens
2. Crea un nuevo token personal (si no tienes uno)
3. Copia el token

### Paso 2: Configurar el token
Edita el archivo `C:\Users\Luis\.supabase\profile` y agrega tu token:

```ini
[supabase]
access_token = "tu_token_aqui_sin_comillas"
```

O configura la variable de entorno:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "tu_token_aqui"
```

### Paso 3: Verificar autenticación
```powershell
supabase projects list
```

Deberías ver una lista de tus proyectos, incluyendo "armador diario".

## Una vez autenticado

### Vincular al proyecto "armador diario"
```powershell
# Primero encuentra el ID del proyecto
supabase projects list

# Luego vincula (reemplaza PROJECT_ID con el ID real)
supabase link --project-ref PROJECT_ID
```

### Leer las tablas del esquema
```powershell
# Ver todas las tablas
supabase db inspect --schema public

# Ver estructura de una tabla específica
supabase db inspect --schema public --table nombre_de_tabla

# Ver relaciones/foreign keys
supabase db inspect --schema public --fk

# Ver índices
supabase db inspect --schema public --index

# Ver políticas RLS
supabase db inspect --schema public --policy
```

### Exportar esquema completo
```powershell
supabase db dump --schema public > esquema_armador_diario.sql
```

### Ver datos de tablas (con precaución)
```powershell
# Solo para tablas pequeñas - NO usar en producción
supabase db inspect --schema public --table nombre_tabla --data
```

## Comandos útiles para explorar

### Listar proyectos
```powershell
supabase projects list
```

### Ver estado del proyecto vinculado
```powershell
supabase status
```

### Ver configuración del proyecto
```powershell
supabase config show
```

### Inspeccionar base de datos remota
```powershell
# Requiere proyecto vinculado
supabase db inspect --schema public
supabase db inspect --schema public --table users
supabase db inspect --schema public --fk
```

## Archivos SQL existentes en el proyecto

Tu proyecto ya tiene archivos SQL que definen el esquema:

- `sql_supabase/20260409_cobro_transporte_schema.sql` - Esquema principal
- `sql_supabase/20260410_add_country_to_catalogs.sql` - Catálogos
- `sql_supabase/20260411_add_cfg_stage_notify.sql` - Configuración de notificaciones
- `sql_supabase/20260411_add_notifications.sql` - Tablas de notificaciones
- `sql_supabase/20260411_remove_transport_module.sql` - Remoción de módulo
- `sql_supabase/20260412_app_rls.sql` - Políticas RLS
- `sql_supabase/20260412_storage_and_rls.sql` - Configuración de storage
- `sql_supabase/20260412_storage_policies.sql` - Políticas de storage

## Próximos pasos

1. **Configura tu token** en `~/.supabase/profile`
2. **Ejecuta**: `supabase projects list` para verificar
3. **Encuéntra el ID** del proyecto "armador diario"
4. **Vincula el proyecto**: `supabase link --project-ref PROJECT_ID`
5. **Explora las tablas**: `supabase db inspect --schema public`

## Si tienes problemas

### Error: "Access token not provided"
- Asegúrate de que el token esté correctamente configurado en el perfil

### Error: "Project not found"
- Verifica que el nombre del proyecto sea exactamente "armador diario"
- Lista todos tus proyectos con `supabase projects list`

### Error: "Permission denied"
- Asegúrate de que tu token tenga permisos para acceder al proyecto

## Información adicional

Una vez vinculado el proyecto, podrás:
- Sincronizar cambios entre local y remoto
- Aplicar migraciones
- Gestionar el esquema de la base de datos
- Ver y modificar políticas de seguridad
- Gestionar storage y archivos