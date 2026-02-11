# Manual técnico · Operación Windows Server

## Variables de entorno

- El repositorio incluye `.env.example` en raíz.
- Se recomienda crear `env.local` o `.env` por ambiente sin commitear secretos.

Flujo sugerido:

1. Copiar `.env.example` a `.env` (o `env.local` según convención del módulo).
2. Completar credenciales/hosts/puertos.
3. Reiniciar procesos para aplicar cambios.

## Scripts de arranque

- En raíz existe `start_frontend.bat` para levantar frontend en entorno Windows.
- En backend existe `server/start_backend.bat` para API.

## Levantar y parar servicios

### Si hay servicios Windows instalados

- Iniciar/detener desde `services.msc` o `sc start|stop <Servicio>`.
- Validar logs y puertos tras el arranque.

### Si no hay servicio registrado (ejecución manual)

Desde terminal (PowerShell/CMD) en la raíz del proyecto:

```bat
start_frontend.bat
```

Para backend:

```bat
cd server
start_backend.bat
```

Para detener ejecución manual: cerrar ventana de proceso o finalizar PID desde Task Manager.

## Backups recomendados

### Base de datos (PostgreSQL)

Ejemplo:

```bash
pg_dump -h <host> -U <usuario> -d <base> -F c -f backup_securityworld.dump
```

### Archivos operativos

Respaldar periódicamente:

- carpeta `logs/` (si aplica en ambiente),
- carpeta de descargas/salidas del RPA HikCentral,
- archivos de configuración de tareas programadas (`.bat`, Task Scheduler export XML).

## Checklist operativo diario

1. Verificar estado de frontend/backend.
2. Confirmar ejecución de tareas RPA programadas.
3. Revisar errores críticos en logs.
4. Validar disponibilidad de disco para descargas/backups.
