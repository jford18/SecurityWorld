# Manual técnico · Backend

## Estructura `server/`

El backend está organizado por dominios y capas:

- `server/index.js` y `server/app.js`: bootstrap del API.
- `server/routes/`: definición de endpoints por módulo.
- `server/controllers/`: lógica de entrada/salida HTTP.
- `server/services/`: acceso a consultas/servicios de negocio.
- `server/queries/`: SQL parametrizado reutilizable.
- `server/middlewares/`: autenticación y validaciones transversales.
- `server/data/`: catálogos y datos base.

## Patrón de listados: `{ data, total }`

Se utiliza de manera estándar para paginación en frontend:

```json
{
  "data": [/* registros */],
  "total": 123
}
```

Este patrón aparece en varios controladores/servicios y facilita paginación de tablas y reportes.

## Filtros + paginación (`LIMIT/OFFSET`)

Patrón recomendado y observado:

1. Parseo/normalización de `page` y `limit`.
2. Cálculo de `offset`.
3. Query de datos con `LIMIT/OFFSET`.
4. Query de conteo para `total`.

Esto permite respuestas predecibles y desacople entre volumen total y página actual.

## Exportación a Excel

### Hallazgos

Se observan endpoints y servicios de exportación en backend, por ejemplo:

- Rutas con `export-excel-public` (usuarios/roles).
- Controladores con uso de `XLSX` (p. ej. `clientes.controller.js`, `usuarios.controller.js`).
- Servicios dedicados a export (`usuarios.service.js`, `proveedores.service.js`).

### Activación general

Normalmente se activa desde endpoints `GET` de exportación consumidos por UI (descarga de `Blob`/archivo).

### Pendiente de confirmación (inventario completo)

Para inventariar todas las exportaciones Excel del backend, ejecutar:

```bash
rg -n "export|xlsx|excel" server
```

También pueden usarse búsquedas puntuales:

```bash
rg -n "export" server
rg -n "xlsx" server
rg -n "excel" server
```
