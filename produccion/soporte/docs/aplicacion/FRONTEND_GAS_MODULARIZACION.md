# Propuesta de modularización de `Frontend_gas/Index.html`

## Objetivo

Dividir `produccion/Frontend_gas/Index.html` en piezas mantenibles sin romper:

- el deploy actual en Railway
- la ruta `/`
- el comportamiento legacy existente
- la integración con `rpc`, modales y utilidades globales

## Restricción más importante

Hoy `GET /` sirve directamente el contenido de `Frontend_gas/Index.html` desde:

- `api/src/routes/legacy.js`

Eso significa que cualquier modularización debe seguir funcionando con el backend actual o introducir cambios mínimos y compatibles.

## Diagnóstico actual

`Frontend_gas/Index.html` concentra en un solo archivo:

- estructura HTML
- estilos CSS
- creación de modales
- utilidades UI
- wrapper RPC/fetch
- caché local de datos
- lógica de login
- dashboard
- gestión de cobros
- gestión de pagos
- historial
- configuración
- maestro/proveedores/pilotos/usuarios
- timeline y flujo

Esto vuelve costoso:

- localizar errores
- revisar cambios
- probar regresiones
- repartir trabajo
- migrar gradualmente al frontend moderno

## Enfoque recomendado

La forma más segura no es “romper” el archivo de una sola vez, sino hacerlo por capas.

## Fase 1: extraer JavaScript sin tocar la UI

### Resultado esperado

Mantener `Index.html` como punto de entrada visual, pero mover la lógica JS a archivos externos.

### Cambio técnico mínimo necesario

Agregar una ruta estática para servir assets de `Frontend_gas/`, por ejemplo:

- `/legacy-assets/...`

Esto se haría en `api/src/server.js` o `api/src/routes/legacy.js`, sirviendo la carpeta:

- `produccion/Frontend_gas/`

### Estructura sugerida

- `Frontend_gas/Index.html`
- `Frontend_gas/assets/css/app.css`
- `Frontend_gas/assets/js/bootstrap.js`
- `Frontend_gas/assets/js/core/api.js`
- `Frontend_gas/assets/js/core/cache.js`
- `Frontend_gas/assets/js/core/loading.js`
- `Frontend_gas/assets/js/core/modals.js`
- `Frontend_gas/assets/js/core/utils.js`
- `Frontend_gas/assets/js/modules/login.js`
- `Frontend_gas/assets/js/modules/dashboard.js`
- `Frontend_gas/assets/js/modules/cobros.js`
- `Frontend_gas/assets/js/modules/pagos.js`
- `Frontend_gas/assets/js/modules/historial.js`
- `Frontend_gas/assets/js/modules/config.js`
- `Frontend_gas/assets/js/modules/admin.js`
- `Frontend_gas/assets/js/modules/flow.js`

### Regla clave de esta fase

No cambiar nombres públicos de funciones al inicio.

Ejemplos:

- `abrirPagos`
- `cargarPagos`
- `verDetallePago`
- `mostrarLoading`

Deben seguir existiendo en `window` mientras el HTML legacy los siga invocando con `onclick`.

### Ventajas

- riesgo bajo
- deploy compatible
- diffs mucho más pequeños
- no obliga a reescribir el HTML todavía

## Fase 2: extraer CSS

### Resultado esperado

Sacar el bloque `<style>` enorme de `Index.html` y moverlo a archivos temáticos.

### Estructura sugerida

- `Frontend_gas/assets/css/base.css`
- `Frontend_gas/assets/css/layout.css`
- `Frontend_gas/assets/css/login.css`
- `Frontend_gas/assets/css/dashboard.css`
- `Frontend_gas/assets/css/cobros.css`
- `Frontend_gas/assets/css/pagos.css`
- `Frontend_gas/assets/css/modals.css`

### Regla clave

No aprovechar esta fase para rediseñar todo.

Primero separar. Luego, si se quiere, optimizar estilos.

## Fase 3: encapsular estado global

### Problema actual

Hay muchas variables globales compartidas:

- `usuarioSesion`
- `pagosRowsCache`
- `gestionRowsCache`
- `loadingUiCount`
- `cfgRulesDataCache`
- etc.

### Propuesta

Crear un único contenedor global controlado, por ejemplo:

```js
window.AppState = {
  session: {},
  cache: {},
  ui: {},
  pagos: {},
  gestion: {},
  flow: {},
  config: {}
};
```

Luego migrar variables sueltas hacia ese contenedor, de forma progresiva.

### Beneficio

Reduce choques entre módulos y facilita depuración.

## Fase 4: reemplazar `onclick` inline por eventos registrados

### Problema actual

Mucho HTML usa:

- `onclick="..."`

Eso obliga a que demasiadas funciones sigan siendo globales.

### Propuesta

Migrar gradualmente a:

- `data-action="ver-pago"`
- `data-id="..."`

y usar delegación de eventos.

### Ejemplo

En vez de:

```html
<button onclick="verDetallePago('ID')">...</button>
```

usar:

```html
<button data-action="ver-pago" data-id="ID">...</button>
```

y resolverlo desde `modules/pagos.js`.

### Beneficio

Permite una modularización real, con menos dependencia de `window`.

## Fase 5: separar plantillas HTML repetidas

### Problema actual

Hay muchos fragmentos construidos con template strings dentro del JS.

### Propuesta

Extraer renderizadores por dominio:

- `renderPagoRow`
- `renderPagoDetalle`
- `renderGestionRow`
- `renderTimelineItem`

Incluso se puede crear una carpeta:

- `Frontend_gas/assets/js/renderers/`

### Beneficio

Hace más fácil revisar UI sin mezclar lógica de fetch, caché y markup.

## Orden recomendado de extracción

El orden más seguro sería:

1. `core/utils.js`
2. `core/loading.js`
3. `core/api.js`
4. `modules/pagos.js`
5. `modules/flow.js`
6. `modules/gestion.js`
7. `modules/login.js`
8. `modules/admin.js`
9. CSS temático

Esto permite empezar por piezas reutilizables y luego mover módulos funcionales.

## Primer corte concreto recomendado

Si solo se hace una primera iteración, propongo este alcance:

### Backend

Agregar soporte estático para assets legacy:

- servir `Frontend_gas/assets/`

### Frontend

Crear:

- `Frontend_gas/assets/js/core/utils.js`
- `Frontend_gas/assets/js/core/loading.js`
- `Frontend_gas/assets/js/core/api.js`
- `Frontend_gas/assets/js/modules/pagos.js`

Y dejar en `Index.html` solo:

- HTML
- CSS temporal
- inicialización mínima
- imports `<script src="...">`

### Qué incluiría `modules/pagos.js`

- `getPagosSearchQuery_`
- `filterPagosRows_`
- `renderPagos`
- `cargarPagos`
- `abrirNuevoPagoAgrupado`
- `cargarCobrosElegiblesPago`
- `guardarPagoAgrupado`
- `verDetallePago`
- `abrirEditarPagoAgrupado`
- `confirmarEliminarPago`

Este módulo es buen candidato porque ya tiene límites funcionales bastante claros.

## Qué no haría en la primera fase

- reescribir todo a React
- cambiar la API actual
- renombrar funciones masivamente
- mezclar la modularización con rediseño visual
- mover en una sola tanda todos los módulos

## Riesgos a vigilar

- funciones inline que dejen de existir en `window`
- dependencias implícitas entre bloques JS
- orden de carga de scripts
- referencias cruzadas entre modales y variables globales
- diferencias entre local y Railway al servir archivos estáticos

## Criterio de éxito

La modularización va bien si:

- `/` sigue cargando sin cambios visibles para el usuario
- Railway despliega sin ajustes manuales raros
- los módulos de pagos, gestión y flujo siguen funcionando igual
- los cambios futuros ya no requieren editar miles de líneas en un solo archivo

## Recomendación final

La mejor ruta es:

1. habilitar assets estáticos legacy
2. extraer primero JS de infraestructura
3. extraer el módulo de pagos
4. validar deploy
5. continuar por módulos

Ese camino da el mayor beneficio con el menor riesgo.
