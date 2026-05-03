# Papelera

Esta carpeta contiene archivos movidos fuera de `produccion/` por considerarse prescindibles para la operación actual del proyecto.

## Criterio

Se movieron aquí elementos que no forman parte del runtime activo, que no estaban conectados al flujo principal o que eran artefactos generados localmente.

## Contenido movido

- `produccion/api/node_modules/`
  Motivo: dependencias instaladas localmente; son artefactos generados.

- `produccion/web/node_modules/`
  Motivo: dependencias instaladas localmente; son artefactos generados.

- `produccion/web/test.js`
  Motivo: script de prueba aislado con Selenium, no conectado a los scripts activos del proyecto.

- `produccion/api/src/services/drive.js`
  Motivo: no se encontraron referencias activas desde la aplicación actual.

## Nota

Nada de esta carpeta se eliminó; solo se movió para limpiar el árbol activo y mantener recuperación sencilla si hiciera falta revisar algo después.
