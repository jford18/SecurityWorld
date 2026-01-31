@echo off
setlocal EnableDelayedExpansion

REM ------------------------------------------------------------------------------
REM Que ejecuta: crea/recrea la tarea programada que corre el RPA cada 15 minutos.
REM Python: la tarea ejecuta run_hikcentral_open_eventalarms_all.bat, que detecta
REM         automaticamente el Python correcto (venv -> py -3 -> python PATH).
REM Logs: revisar %~dp0\logs\scheduled_run_YYYYMMDD_HHMMSS.log.
REM /IT: requiere usuario logueado para que Selenium pueda abrir Chrome.
REM ------------------------------------------------------------------------------

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "RUN_BAT=%BASE_DIR%\run_hikcentral_open_eventalarms_all.bat"
set "TASK_NAME=SecurityWorld_HikCentral_EventAlarms_15min"

if not exist "%RUN_BAT%" (
  echo ERROR: No existe %RUN_BAT%
  exit /b 1
)

echo Creando tarea programada "%TASK_NAME%" cada 15 minutos...

echo Este modo requiere que el usuario este logueado para que Selenium abra Chrome.

schtasks /Create /TN "%TASK_NAME%" /SC MINUTE /MO 15 /TR "\"%RUN_BAT%\"" /IT /RU "%USERNAME%" /RL HIGHEST /F
if errorlevel 1 (
  echo ERROR: No se pudo crear la tarea programada.
  exit /b 1
)

echo Tarea creada. Ejecutando una corrida de prueba...
schtasks /Run /TN "%TASK_NAME%"

echo Listo.
exit /b 0
