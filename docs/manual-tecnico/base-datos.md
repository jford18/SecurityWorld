# Manual técnico · Base de Datos

## Estructura por áreas (visión funcional)

### 1) Seguridad

Incluye tablas relacionadas con:

- intrusiones/eventos,
- catálogos de tipos,
- usuarios/roles/permisos,
- auditoría de logeos.

### 2) Operación

Incluye tablas de:

- catálogos operativos,
- consolas/sitios,
- fallos técnicos y tableros de seguimiento,
- entidades de mantenimiento administrativo.

### 3) Integración HikCentral

Incluye persistencia de:

- eventos/alarmas ingeridos desde RPA,
- estados de recursos exportados,
- conciliación con catálogos internos.

## Pendiente de confirmación (diccionario completo)

No se identificó en el repositorio un diccionario de datos completo consolidado.

Para listar tablas en PostgreSQL:

```sql
\dt
```

O desde `information_schema`:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
```

Recomendación: construir un catálogo técnico por tabla con columnas, tipo, PK/FK, índices y dueño funcional.

## Cambio aplicado · `seguimiento_fallos.hasta`

Para completar el modelo histórico de departamentos en fallos técnicos, se agregó la migración `server/data/20260318_add_hasta_to_seguimiento_fallos.sql`, que:

- crea la columna `hasta` en `seguimiento_fallos`,
- rellena `hasta` con el siguiente `fecha_creacion` cuando existe cambio de departamento,
- cierra seguimientos todavía abiertos con `fecha_resolucion + hora_resolucion` cuando el fallo ya fue resuelto,
- deja una consulta de validación para comprobar que exista como máximo un seguimiento abierto por fallo.

Ejecutar la validación mínima:

```sql
SELECT *
FROM public.seguimiento_fallos
WHERE hasta IS NULL;
```
