# Archivado

Esta carpeta contiene archivos movidos fuera de `produccion/` por ser históricos, auxiliares o de contexto local, pero no necesariamente descartables.

## Criterio

Se movieron aquí elementos que podrían servir como referencia futura, respaldo o compatibilidad histórica, aunque ya no deban vivir dentro del árbol operativo principal.

## Contenido movido

- `produccion/api/.env.local`
  Motivo: archivo de entorno local de máquina; ya no forma parte del flujo documentado principal.

- `produccion/web/.env.local`
  Motivo: archivo de entorno local de máquina; ya no forma parte del flujo documentado principal.

- `produccion/Backend_gas/migracion_legacy_supabase.gs`
  Motivo: utilitario de migración legacy; no parece ser parte del runtime normal de la aplicación.

- `produccion/Backend_gas/appsscript.json`
  Motivo: manifiesto de Apps Script conservado como referencia histórica de la capa legacy.

## Nota

El contenido archivado no se considera basura. Se movió para reducir ruido en `produccion/` sin perder trazabilidad ni contexto técnico.
