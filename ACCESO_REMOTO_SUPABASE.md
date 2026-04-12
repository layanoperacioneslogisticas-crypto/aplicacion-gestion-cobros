# 🚀 Acceso Remoto a Supabase - Proyecto "Armador Diario"

## 📋 **Pasos para Acceder Remotamente**

### **Paso 1: Obtener Token de Acceso**
1. Ve a: https://supabase.com/dashboard/account/tokens
2. Haz clic en "New access token"
3. Dale un nombre descriptivo (ej: "Armador Diario Access")
4. Selecciona permisos: `repo` (suficiente para leer)
5. Copia el token generado ⚠️ **Guárdalo seguro, no se muestra nuevamente**

### **Paso 2: Configurar Token**
**Opción A: Script Automático (Recomendado)**
```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
.\acceder-supabase-remoto.ps1 -Token "tu_token_aqui"
```

**Opción B: Configuración Manual**
Edita el archivo `C:\Users\Luis\.supabase\profile`:
```ini
[supabase]
access_token = "tu_token_real_aqui"
```

### **Paso 3: Verificar Conexión**
```powershell
supabase projects list
```
Deberías ver una lista como:
```
NAME                    ID                                      ORGANIZATION
armador-diario          abc123def456ghi789jkl012              layanoperacioneslogisticas-crypto
```

### **Paso 4: Vincular Proyecto**
```powershell
supabase link --project-ref TU_PROJECT_ID_AQUI
```
Reemplaza `TU_PROJECT_ID_AQUI` con el ID real del proyecto.

### **Paso 5: Explorar Base de Datos**
```powershell
# Ver todas las tablas
supabase db inspect --schema public

# Ver estructura de tabla específica
supabase db inspect --schema public --table ct_cobros
supabase db inspect --schema public --table ct_users

# Ver relaciones (foreign keys)
supabase db inspect --schema public --fk

# Ver índices
supabase db inspect --schema public --index

# Ver políticas RLS
supabase db inspect --schema public --policy
```

## 🔍 **Comandos Útiles para Explorar**

### **Ver Estructura General**
```bash
supabase db inspect --schema public
```

### **Ver Tabla Específica**
```bash
supabase db inspect --schema public --table ct_cobros
```

### **Ver Datos de Tabla (Cuidado!)**
```bash
# Solo primeras filas, no usar en producción
supabase db inspect --schema public --table ct_users --data
```

### **Ver Relaciones**
```bash
supabase db inspect --schema public --fk
```

### **Ver Políticas de Seguridad**
```bash
supabase db inspect --schema public --policy
```

### **Exportar Esquema Completo**
```bash
supabase db dump --schema public > esquema_remoto.sql
```

## 📊 **Tablas Principales a Explorar**

Basado en el análisis del esquema local:

1. **`ct_cobros`** - Cobros principales (la más importante)
2. **`ct_users`** - Usuarios del sistema
3. **`ct_providers`** - Proveedores
4. **`ct_master_items`** - Catálogo de productos
5. **`ct_cobro_items`** - Items detallados de cobros
6. **`ct_notifications`** - Notificaciones
7. **`ct_audit_log`** - Log de auditoría

## 🔧 **Solución de Problemas**

### **Error: "Access token not provided"**
```bash
# Verifica que el token esté configurado
cat ~/.supabase/profile

# Si no está, configura nuevamente
supabase login --token TU_TOKEN
```

### **Error: "Project not found"**
```bash
# Lista proyectos disponibles
supabase projects list

# Asegúrate de usar el ID correcto
supabase link --project-ref CORRECT_PROJECT_ID
```

### **Error: "Permission denied"**
- Verifica que tu token tenga permisos `repo`
- Crea un nuevo token si es necesario

### **Error: "Connection refused"**
- Verifica tu conexión a internet
- Intenta nuevamente en unos minutos

## 🔒 **Seguridad**

- **Nunca compartas** tu token de acceso
- **No commits** tokens en código
- **Revoca tokens** que ya no uses desde el dashboard
- **Usa tokens específicos** con permisos mínimos necesarios

## 📝 **Notas Importantes**

- El proyecto "armador diario" debe estar en tu cuenta de Supabase
- Asegúrate de que el proyecto esté activo y no pausado
- Los comandos de inspección no modifican datos, solo los leen
- Para operaciones de escritura, necesitarías permisos adicionales

## 🎯 **Próximos Pasos Después de Conectar**

Una vez conectado exitosamente:

1. **Explora la estructura**: `supabase db inspect --schema public`
2. **Verifica datos**: Inspecciona tablas clave
3. **Compara con local**: Compara con tu esquema local
4. **Sincroniza cambios**: Si es necesario, actualiza el esquema local

¿Necesitas ayuda con algún paso específico?