# Manual técnico · Frontend

## Estructura general

El frontend se distribuye principalmente en:

- `src/`: aplicación principal (pages, services, hooks, components, utils, data).
- `components/`: componentes adicionales/legacy compartidos.

## `services` y consumo API

Patrón observado en `src/services/`:

- Encapsular llamadas HTTP por módulo.
- Tipar payloads (TypeScript) cuando aplica.
- Mantener contrato de listados `{ data, total }` para tablas.

## Paginación estándar

En vistas administrativas/reportes se usa flujo típico:

1. Estado local de `page`, `rowsPerPage`, `total`.
2. Request con parámetros de paginación/filtros.
3. Render de tabla + controles de navegación.
4. Sincronización de `total` devuelto por backend.

## Exportar Excel desde UI

Patrones implementados:

- Botón **Exportar a Excel** en pantallas administrativas.
- Llamada a servicio frontend que invoca endpoint backend de exportación.
- Descarga vía `Blob` y `link.download` en navegador.

También hay exportación local (cliente) en algunos casos con librería `xlsx`.
