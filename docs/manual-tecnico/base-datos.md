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
