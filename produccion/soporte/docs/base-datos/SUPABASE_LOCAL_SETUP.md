# Instalación de Supabase Local

## Estado Actual
✅ Supabase CLI inicializado: `supabase/config.toml` creado
⚠️ Docker Desktop: Necesario instalar

## Requisito: Docker Desktop

Para ejecutar Supabase localmente, necesitas **Docker Desktop**.

### Opción 1: Instalar Docker Desktop Manualmente
1. Descarga Docker Desktop desde: https://www.docker.com/products/docker-desktop
2. Ejecuta el instalador (Docker Desktop Installer.exe)
3. Sigue las instrucciones de instalación
4. Reinicia tu computadora si se solicita
5. Abre Docker Desktop para iniciar el servicio

### Opción 2: Completar la Instalación con Winget
Si la descarga ya comenzó con winget, ejecuta este comando nuevamente:
```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
winget install --id Docker.DockerDesktop -e --source winget
```

## Una vez Docker esté listo

### 1. Iniciar Supabase localmente
```powershell
cd "c:\Users\Luis\Desktop\Proyectos\Proyectos\Aplicación de gestión de cobro a transporte"
.\.tools\supabase-cli\supabase.exe start
```

Esto iniciará:
- 🐘 PostgreSQL en puerto `54322`
- 🔌 API REST en puerto `54321`
- 🎨 Studio (GUI) en `http://localhost:54323`
- 🔐 Auth service
- 📦 Storage service
- Y más...

### 2. Verificar que está corriendo
```powershell
.\.tools\supabase-cli\supabase.exe status
```

### 3. Ver credenciales locales
```powershell
.\.tools\supabase-cli\supabase.exe status --show-secrets
```

### 4. Acceder a Supabase Studio (GUI)
Abre en el navegador: `http://localhost:54323`

## Configuración Local vs Remoto

### Local (Desarrollo)
- API: `http://localhost:54321`
- Studio: `http://localhost:54323`
- Database: `postgres://[user]:[password]@localhost:54322/postgres`
- No requiere internet

### Remoto (Producción)
- Usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto en supabase.com
- Requiere autenticación con token de Supabase

## Detener Supabase
```powershell
.\.tools\supabase-cli\supabase.exe stop
```

## Resetear Base de Datos Local
```powershell
.\.tools\supabase-cli\supabase.exe reset
```

## Troubleshooting

### Error: "Docker is not available"
- Instala Docker Desktop desde https://www.docker.com/products/docker-desktop
- Asegúrate de que Docker Desktop esté ejecutándose
- En Windows, puede ser necesario habilitar WSL 2

### Error: "Cannot connect to Docker daemon"
- Abre Docker Desktop (debería estar en el menú de Inicio)
- Espera a que se inicie completamente (puede tomar 1-2 minutos)
- Intenta nuevamente

### Los puertos 54320-54323 ya están en uso
- Detén cualquier instancia de Supabase anterior: `.\.tools\supabase-cli\supabase.exe stop`
- O cambia los puertos en `supabase/config.toml`
