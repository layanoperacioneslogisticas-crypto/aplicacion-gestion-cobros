# Script para acceder remotamente a Supabase
# Uso: .\acceder-supabase-remoto.ps1 -Token "tu_token_aqui"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$ProjectName = "armador diario"
)

# Configurar token en el perfil
$profilePath = "$env:USERPROFILE\.supabase\profile"
$profileContent = @"
[supabase]
access_token = "$Token"
"@
Set-Content -Path $profilePath -Value $profileContent -Encoding UTF8
Write-Host "✓ Token configurado en perfil de Supabase" -ForegroundColor Green

# Listar proyectos disponibles
Write-Host "`n🔍 Buscando proyectos..." -ForegroundColor Cyan
try {
    $projects = supabase projects list 2>&1
    Write-Host "Proyectos encontrados:" -ForegroundColor Green
    Write-Host $projects
} catch {
    Write-Host "Error al listar proyectos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Buscar proyecto por nombre aproximado
$projectLines = $projects | Where-Object { $_ -match "layanoperacioneslogisticas" -or $_ -match "armador" -or $_ -match "diario" }
if ($projectLines) {
    Write-Host "`n🎯 Proyecto encontrado:" -ForegroundColor Green
    Write-Host $projectLines

    # Extraer Project ID (asumiendo formato típico)
    $projectId = ($projectLines | Select-String -Pattern "([a-z0-9]{20})" | ForEach-Object { $_.Matches[0].Value })[0]
    if ($projectId) {
        Write-Host "`n🔗 Vinculando proyecto: $projectId" -ForegroundColor Cyan
        try {
            supabase link --project-ref $projectId
            Write-Host "✓ Proyecto vinculado exitosamente" -ForegroundColor Green
        } catch {
            Write-Host "Error al vincular proyecto: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n⚠️ No se encontró automáticamente el proyecto '$ProjectName'" -ForegroundColor Yellow
    Write-Host "Por favor, ejecuta manualmente:" -ForegroundColor Cyan
    Write-Host "supabase link --project-ref TU_PROJECT_ID"
}

Write-Host "`n📊 Para explorar las tablas remotas:" -ForegroundColor Cyan
Write-Host "supabase db inspect --schema public"
Write-Host "supabase db inspect --schema public --table ct_cobros"
Write-Host "supabase db inspect --schema public --table ct_users"

Write-Host "`n🔍 Estado actual:" -ForegroundColor Cyan
supabase status