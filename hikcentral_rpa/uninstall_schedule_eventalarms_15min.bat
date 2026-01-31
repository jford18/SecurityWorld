@echo off
setlocal EnableDelayedExpansion

REM ------------------------------------------------------------------------------
REM Que ejecuta: elimina la tarea programada que corre el RPA cada 15 minutos.
REM Python: no ejecuta Python directamente; la tarea removida apuntaba a
REM         run_hikcentral_open_eventalarms_all.bat (que detecta el Python correcto).
REM Logs: los logs previos se mantienen en %~dp0\logs\.
REM /IT: la tarea eliminada usaba /IT (usuario logueado) para Selenium.
REM ------------------------------------------------------------------------------

set "TASK_NAME=SecurityWorld_HikCentral_EventAlarms_15min"

echo Eliminando tarea programada "%TASK_NAME%"...

schtasks /Delete /TN "%TASK_NAME%" /F
if errorlevel 1 (
  echo ERROR: No se pudo eliminar la tarea programada.
  exit /b 1
)

echo Tarea eliminada.
exit /b 0
