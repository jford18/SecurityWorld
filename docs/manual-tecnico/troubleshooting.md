# Manual técnico · Troubleshooting

## Matriz síntoma / causa / solución

| Síntoma | Causa probable | Solución recomendada |
|---|---|---|
| Selenium no puede hacer clic en botón (overlay) | Capa modal/overlay intercepta el clic | Esperar desaparición del overlay, hacer `scrollIntoView`, usar selector más específico y reintento controlado. |
| Timeout en navegación HikCentral | Red lenta, cambios de UI, espera insuficiente | Aumentar timeout explícito, validar disponibilidad de URL, registrar paso exacto del fallo. |
| Export con fechas distintas a la consulta | Conversión de zona horaria o filtros fecha/hora ambiguos | Normalizar timezone en backend/frontend, validar formato enviado a API y criterio inclusivo/exclusivo. |
| Columnas no coinciden entre UI y Excel | Mapeo de cabeceras no alineado con dataset | Unificar contrato de columnas en backend/frontend y agregar pruebas de regresión de exportación. |
| Duplicidad de registros por joins | JOIN 1:N sin agregación o clave incorrecta | Revisar query SQL, aplicar `DISTINCT`/agregación o ajustar condición de JOIN. |
| `total` no coincide con filas mostradas | Conteo y query de datos usan filtros diferentes | Alinear `WHERE` en query de conteo y de listado. |
| Descarga de Excel no inicia desde UI | Endpoint caído, CORS, Blob inválido | Verificar endpoint de export, headers de respuesta y manejo de Blob en frontend. |
| RPA genera archivo vacío | Filtro en HikCentral sin datos o lectura de hoja incorrecta | Confirmar datos en pantalla origen y validar `sheet_name`/`header` en script. |

## Procedimiento rápido de diagnóstico

1. Reproducir el problema con timestamp.
2. Capturar request/response (frontend + backend).
3. Revisar logs de backend y RPA.
4. Validar SQL/DOM involucrado.
5. Aplicar corrección mínima y revalidar.
6. Documentar causa raíz y acción preventiva.
