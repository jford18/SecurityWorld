# Manual técnico · RPA HikCentral

## Patrón existente en el repositorio

La integración RPA está concentrada en `hikcentral_rpa/`, con scripts como:

- `hikcentral_open_eventalarms.py`
- `hikcentral_export_resourcestatus.py`
- `hikcentral_export_resourcestatus2.py`
- scripts `.bat` para ejecución programada/masiva

Patrón general:

1. Abrir sesión o vista objetivo en HikCentral.
2. Navegar por DOM (Selenium) hasta paneles de consulta/export.
3. Ejecutar exportación (frecuentemente a `.xlsx`).
4. Procesar archivo descargado y/o persistir resultados.

## Descargas

- Las exportaciones de HikCentral se realizan a archivos Excel (`.xlsx`/`.xls`) según el flujo del script.
- Validar en cada script la variable/directorio de descarga configurado (por ejemplo `DOWNLOAD_DIR` en scripts de exportación).
- Definir una carpeta fija de descargas por ambiente (Windows Server) para simplificar soporte y backups.

## Logs y trazabilidad

- Revisar trazas por consola/archivo según implementación de cada script.
- Si el ambiente utiliza carpeta `logs/`, centralizar allí:
  - salida de ejecución programada,
  - errores Selenium,
  - tiempos de espera/timeout,
  - fallos de parsing de Excel.

## Problemas comunes

- **Overlay bloqueando clics:** elementos superpuestos impiden interacción del botón objetivo.
- **DOM dinámico:** selectores cambian y el script no encuentra nodos.
- **Timeouts:** carga lenta de HikCentral o red inestable.

## Dónde ver logs

1. Salida estándar de la tarea (Task Scheduler o consola).
2. Archivos de log configurados por script.
3. Carpeta `logs/` (si está habilitada en el entorno).

## Checklist de ejecución manual

1. Confirmar credenciales y URL de HikCentral.
2. Verificar versión de Chrome/Driver compatible.
3. Limpiar carpeta de descargas temporales.
4. Ejecutar script objetivo desde `hikcentral_rpa/`.
5. Confirmar generación de `.xlsx`.
6. Validar registros procesados y estructura esperada.
7. Revisar logs en caso de error y documentar evidencia (captura + timestamp).
