# Script para configurar Supabase
# Uso: .\setup-supabase.ps1 -ProjectId "your_project_id" -AnonKey "your_anon_key" -ServiceRoleKey "your_service_role_key" -JwtSecret "your_jwt_secret"

param(
    [string]$ProjectId,
    [string]$AnonKey,
    [string]$ServiceRoleKey,
    [string]$JwtSecret,
    [string]$AwsRegion = "",
    [string]$SesFromEmail = "",
    [string]$SesReplyTo = ""
)

if (-not $ProjectId -or -not $AnonKey -or -not $ServiceRoleKey) {
    Write-Host "Error: ProjectId, AnonKey, y ServiceRoleKey son requeridos" -ForegroundColor Red
    Write-Host "Uso: .\setup-supabase.ps1 -ProjectId 'xxx' -AnonKey 'xxx' -ServiceRoleKey 'xxx' -JwtSecret 'xxx'"
    exit 1
}

$ProjectUrl = "https://$ProjectId.supabase.co"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Crear archivo .env para el frontend
$FrontendEnvPath = Join-Path $ScriptDir "web\.env.local"
$FrontendEnv = @"
VITE_SUPABASE_URL=$ProjectUrl
VITE_SUPABASE_ANON_KEY=$AnonKey
VITE_API_BASE_URL=http://localhost:3001
"@
Set-Content -Path $FrontendEnvPath -Value $FrontendEnv
Write-Host "✓ Creado: $FrontendEnvPath" -ForegroundColor Green

# Crear archivo .env para el backend
$BackendEnvPath = Join-Path $ScriptDir "api\.env.local"
$BackendEnv = @"
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=$ProjectUrl
SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey
SUPABASE_JWT_SECRET=$JwtSecret
SUPABASE_STORAGE_BUCKET=Cobros_pdf
AWS_REGION=$AwsRegion
SES_FROM_EMAIL=$SesFromEmail
SES_REPLY_TO=$SesReplyTo
"@
Set-Content -Path $BackendEnvPath -Value $BackendEnv
Write-Host "✓ Creado: $BackendEnvPath" -ForegroundColor Green

# Crear archivo .env para Supabase CLI
$SupabaseEnvPath = Join-Path $ScriptDir ".env.supabase"
$SupabaseEnv = @"
SUPABASE_PROJECT_ID=$ProjectId
SUPABASE_URL=$ProjectUrl
SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey
"@
Set-Content -Path $SupabaseEnvPath -Value $SupabaseEnv
Write-Host "✓ Creado: $SupabaseEnvPath" -ForegroundColor Green

Write-Host ""
Write-Host "Configuración completada:" -ForegroundColor Cyan
Write-Host "  - Frontend: web\.env.local"
Write-Host "  - Backend: api\.env.local"
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Ejecuta: .\.tools\supabase-cli\supabase.exe link --project-ref $ProjectId"
Write-Host "  2. Ejecuta: .\.tools\supabase-cli\supabase.exe db push"
Write-Host "  3. Inicia el desarrollo: npm run dev"
