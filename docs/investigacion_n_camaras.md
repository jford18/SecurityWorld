# Investigación N_CAMARAS (solo análisis)

Fecha: 2026-03-29

## 1) Endpoint que consume `/fallos/operador`

- Frontend (`/fallos/operador`) usa `fetchFallos(...)`.
- `fetchFallos` llama `GET /fallos`.
- Backend enruta `/api/fallos` a `fallos.routes.js` y `GET /` ejecuta `getFallos` en `fallos.controller.js`.

## 2) Campos de fallo que devuelve `GET /api/fallos`

La consulta selecciona (entre otros):

- `ft.id`
- `ft.fecha`, `ft.hora`
- `ft.equipo_afectado`
- `ft.descripcion_fallo`
- `ft.camera_id`
- `ft.tipo_afectacion`
- `sitio.nombre AS sitio_nombre` y `COALESCE(sitio.nombre, ...) AS sitio`
- `CASE ... END AS nodo_nombre` (cuando `tipo_afectacion = 'NODO'`)

Mapeo DTO:

- Se expone `equipo_afectado`, `tipo_afectacion`, `nodo_nombre`.
- `camera_id` **se consulta** pero no se mapea explícitamente en `mapFalloRowToDto`.
- `sitio_id` **no se selecciona** en `getFallos` (solo `sitio/sitio_nombre`).

## 3) Relación `hik_camera_resource_status` ↔ `sitios`

Relación usada en backend:

- Por nombre de sitio: `SITIOS.NOMBRE = HIK_CAMERA_RESOURCE_STATUS.SITE_NAME`.
- Ejemplos reales:
  - `LEFT JOIN PUBLIC.SITIOS B ON (B.NOMBRE = A.SITE_NAME)` en KPI de uptime cámaras manual.
  - Para cargar cámaras por sitio_id, primero obtiene `SITIOS.NOMBRE` y luego filtra `HIK_CAMERA_RESOURCE_STATUS.SITE_NAME = $1`.

Conclusión: la relación operacional real es por **nombre** (`site_name` ↔ `sitios.nombre`), no por id directo.

## 4) Relación nodo → sitios

Relación real:

- Tabla puente: `nodos_sitios`.
- Join: `nodos_sitios.nodo_id -> nodos.id` y `nodos_sitios.sitio_id -> sitios.id`.
- Endpoint operativo: `GET /api/nodos/:id/sitio` consulta `nodos_sitios` y devuelve los sitios activos del nodo.

## 5) SQL real para total de cámaras (pantalla uptime manual)

En `/api/dashboards/uptime-camaras-manual`, el CTE `CAMERAS` calcula:

```sql
SELECT
    COUNT(DISTINCT A.DEVICE_CODE) AS CAMARAS
FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS A
LEFT JOIN PUBLIC.SITIOS B ON (B.NOMBRE = A.SITE_NAME)
LEFT JOIN PUBLIC.HACIENDA C ON (C.ID = B.HACIENDA_ID)
JOIN PARAMS D ON (1 = 1)
WHERE A.DEVICE_CODE IS NOT NULL
  AND (D.HACIENDA_ID IS NULL OR C.ID = D.HACIENDA_ID)
  AND (D.CLIENTE_ID IS NULL OR B.CLIENTE_ID = D.CLIENTE_ID)
```

Ese valor es el que alimenta el KPI `CAMARAS` (ej. 1,971 según filtros y data vigente).

## 6) SQL base cámaras por sitio

Consulta solicitada (válida con la relación actual por nombre):

```sql
SELECT
    A.site_name,
    COUNT(*) AS n_camaras
FROM hik_camera_resource_status A
GROUP BY A.site_name;
```

Recomendación para “cámaras reales” del KPI: usar `COUNT(DISTINCT A.device_code)` y excluir `site_name` vacío si se requiere consistencia con los CTE del dashboard.

## 7) Reglas de cálculo N_CAMARAS por tipo de afectación

Con el modelo actual, para reproducir lógica consistente con tablas reales:

- Equipo: si hay `camera_id` => `N_CAMARAS = 1` (falla cámara puntual).
- Punto: usar `sitio_id` del fallo y contar cámaras del sitio (`site_name = sitios.nombre`).
- Nodo: obtener sitios del nodo (`nodos_sitios`) y sumar cámaras de esos sitios.
- Masivo: usar total global del KPI (`COUNT(DISTINCT device_code)` con filtros activos).

Notas:

- El endpoint `GET /api/fallos` no retorna `sitio_id`; para cálculo robusto se requiere `fallos_tecnicos.sitio_id` en consulta o resolver por otra vía.
- Para `Nodo`, en creación del fallo se persiste `sitio_id = sitiosNodo[0]?.id`; el nombre del nodo queda en `equipo_afectado`.

## 8) SQL sugerido para reportes operativos

### 8.1 Cámaras por sitio (alineado a KPI por dispositivo)

```sql
SELECT
    A.site_name,
    COUNT(DISTINCT A.device_code) AS n_camaras
FROM public.hik_camera_resource_status A
WHERE A.site_name IS NOT NULL
  AND TRIM(A.site_name) <> ''
  AND A.device_code IS NOT NULL
GROUP BY A.site_name
ORDER BY A.site_name;
```

### 8.2 Cámaras por nodo (usando relación oficial `nodos_sitios`)

```sql
SELECT
    N.id AS nodo_id,
    N.nombre AS nodo_nombre,
    COUNT(DISTINCT H.device_code) AS n_camaras
FROM public.nodos N
LEFT JOIN public.nodos_sitios NS ON NS.nodo_id = N.id
LEFT JOIN public.sitios S ON S.id = NS.sitio_id
LEFT JOIN public.hik_camera_resource_status H ON H.site_name = S.nombre
WHERE H.device_code IS NOT NULL
GROUP BY N.id, N.nombre
ORDER BY N.nombre;
```

### 8.3 Total cámaras (igual KPI manual)

```sql
SELECT COUNT(DISTINCT A.device_code) AS camaras
FROM public.hik_camera_resource_status A
LEFT JOIN public.sitios B ON (B.nombre = A.site_name)
LEFT JOIN public.hacienda C ON (C.id = B.hacienda_id)
WHERE A.device_code IS NOT NULL
  AND (:hacienda_id IS NULL OR C.id = :hacienda_id)
  AND (:cliente_id IS NULL OR B.cliente_id = :cliente_id);
```

