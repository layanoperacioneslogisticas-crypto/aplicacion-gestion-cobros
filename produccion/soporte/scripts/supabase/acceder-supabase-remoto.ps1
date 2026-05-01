# Script para acceder remotamente a Supabase
# Uso:
#   .\acceder-supabase-remoto.ps1 -Token "tu_token_aqui"
#   .\acceder-supabase-remoto.ps1 -Token "tu_token_aqui" -ProjectRef "apauqolrxddmpqtlbffx"

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$ProjectName = "armador diario",

    [string]$ProjectRef = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$bundledCli = Join-Path $scriptDir ".tools\supabase-cli\supabase.exe"
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue

if (Test-Path $bundledCli) {
    $cliPath = $bundledCli
} elseif ($supabaseCmd) {
    $cliPath = $supabaseCmd.Source
} else {
    throw "No se encontro Supabase CLI. Usa la copia local en .tools\\supabase-cli o instala la CLI globalmente."
}

$legacyProfilePath = Join-Path $env:USERPROFILE ".supabase\profile"
if (Test-Path $legacyProfilePath) {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $backupPath = Join-Path $env:USERPROFILE ".supabase\profile.legacy.$timestamp.bak"
    Move-Item -LiteralPath $legacyProfilePath -Destination $backupPath -Force
    Write-Host "Se respaldo el perfil legacy en: $backupPath" -ForegroundColor Yellow
}

Write-Host "Autenticando Supabase CLI..." -ForegroundColor Cyan
& $cliPath login --token $Token --yes
if ($LASTEXITCODE -ne 0) {
    throw "No fue posible autenticar la CLI de Supabase."
}

Write-Host "`nListando proyectos..." -ForegroundColor Cyan
$projectsJson = & $cliPath projects list --output json
if ($LASTEXITCODE -ne 0) {
    throw "No fue posible listar proyectos remotos."
}

$projects = $projectsJson | ConvertFrom-Json
if (-not $projects) {
    throw "La CLI autentico correctamente, pero no devolvio proyectos."
}

Write-Host "Proyectos encontrados:" -ForegroundColor Green
$projects | Select-Object name, id | Format-Table -AutoSize

if (-not $ProjectRef) {
    $needle = $ProjectName.ToLowerInvariant()
    $match = $projects | Where-Object {
        $_.name -and $_.name.ToLowerInvariant().Contains($needle)
    } | Select-Object -First 1

    if ($match) {
        $ProjectRef = $match.id
    }
}

if ($ProjectRef) {
    Write-Host "`nVinculando proyecto: $ProjectRef" -ForegroundColor Cyan
    & $cliPath link --project-ref $ProjectRef --yes
    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible vincular el proyecto remoto."
    }

    Write-Host "Proyecto vinculado exitosamente." -ForegroundColor Green
} else {
    Write-Host "`nNo se encontro automaticamente el proyecto '$ProjectName'." -ForegroundColor Yellow
    Write-Host "Vinculalo manualmente con:" -ForegroundColor Yellow
    Write-Host "  `"$cliPath`" link --project-ref TU_PROJECT_ID --yes"
}

Write-Host "`nComandos utiles:" -ForegroundColor Cyan
Write-Host "  `"$cliPath`" projects list"
Write-Host "  `"$cliPath`" inspect db table-stats --linked"
Write-Host "  `"$cliPath`" inspect db db-stats --linked"
Write-Host "  `"$cliPath`" db dump --schema public > esquema_public.sql"
