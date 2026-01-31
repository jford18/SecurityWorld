@echo off
setlocal EnableDelayedExpansion

REM ------------------------------------------------------------------------------
REM Que ejecuta: corre los RPAs de HikCentral en orden y genera un log por corrida.
REM Python: detecta el ejecutable correcto (venv -> py -3 -> python PATH).
REM Logs: %~dp0\logs\scheduled_run_YYYYMMDD_HHMMSS.log
REM /IT: si se ejecuta desde Tarea Programada con /IT, requiere usuario logueado
REM       para que Selenium pueda abrir Chrome.
REM ------------------------------------------------------------------------------

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "VENV_PY=%BASE_DIR%\venv\Scripts\python.exe"
set "PYTHON_EXE="
set "PYTHON_ARGS="
set "SCRIPT1=%BASE_DIR%\hikcentral_open_eventalarms.py"
set "SCRIPT2=%BASE_DIR%\hikcentral_open_eventalarms 2.py"
set "LOG_DIR=%BASE_DIR%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
for /f %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "RUN_TS=%%a"
set "LOG_FILE=%LOG_DIR%\scheduled_run_%RUN_TS%.log"

call :log "========================================================"
call :log "[INICIO] %date% %time%"
call :log "BASE_DIR=%BASE_DIR%"

cd /d "%BASE_DIR%"
if errorlevel 1 (
  call :log "ERROR: No se pudo cambiar a %BASE_DIR%"
  exit /b 1
)

if exist "%VENV_PY%" (
  set "PYTHON_EXE=%VENV_PY%"
) else (
  where py >nul 2>&1
  if not errorlevel 1 (
    set "PYTHON_EXE=py"
    set "PYTHON_ARGS=-3"
  ) else (
    where python >nul 2>&1
    if errorlevel 1 (
      call :log "ERROR: No se encontro Python (venv, py -3, ni python en PATH)."
      exit /b 1
    )
    set "PYTHON_EXE=python"
  )
)

if not exist "%SCRIPT1%" (
  call :log "ERROR: No existe %SCRIPT1%"
  exit /b 1
)
if not exist "%SCRIPT2%" (
  call :log "ERROR: No existe %SCRIPT2%"
  exit /b 1
)

call :log "PYTHON_CMD=%PYTHON_EXE% %PYTHON_ARGS%"
for /f "delims=" %%a in ('"%PYTHON_EXE%" %PYTHON_ARGS% -c "import sys; print(sys.executable)"') do set "PYTHON_REAL=%%a"
call :log "PYTHON_EXE_REAL=%PYTHON_REAL%"
for /f "delims=" %%a in ('"%PYTHON_EXE%" %PYTHON_ARGS% --version') do set "PYTHON_VERSION=%%a"
call :log "PYTHON_VERSION=%PYTHON_VERSION%"

call :log "Verificando dependencias minimas (pandas, numpy, psutil, psycopg2, selenium, dotenv)..."
"%PYTHON_EXE%" %PYTHON_ARGS% -c "import pandas, numpy, psutil, psycopg2, selenium, dotenv" >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  call :log "Dependencias faltantes. Instalando en este mismo Python..."
  "%PYTHON_EXE%" %PYTHON_ARGS% -m pip install --upgrade pip >> "%LOG_FILE%" 2>&1
  "%PYTHON_EXE%" %PYTHON_ARGS% -m pip install pandas numpy psutil psycopg2-binary selenium python-dotenv webdriver-manager openpyxl xlrd >> "%LOG_FILE%" 2>&1
  "%PYTHON_EXE%" %PYTHON_ARGS% -c "import pandas, numpy, psutil, psycopg2, selenium, dotenv" >> "%LOG_FILE%" 2>&1
  if errorlevel 1 (
    call :log "ERROR: Dependencias faltantes luego de instalar."
    exit /b 2
  )
)

call :log "Ejecutando script 1: %SCRIPT1%"
"%PYTHON_EXE%" %PYTHON_ARGS% "%SCRIPT1%" >> "%LOG_FILE%" 2>&1
set "RC1=%ERRORLEVEL%"
if not "%RC1%"=="0" (
  call :log "ERROR: Script 1 fallo con RC=%RC1%"
  exit /b 1
)

call :log "Ejecutando script 2: %SCRIPT2%"
"%PYTHON_EXE%" %PYTHON_ARGS% "%SCRIPT2%" >> "%LOG_FILE%" 2>&1
set "RC2=%ERRORLEVEL%"
if not "%RC2%"=="0" (
  call :log "ERROR: Script 2 fallo con RC=%RC2%"
  exit /b 1
)

call :log "[FIN] %date% %time%"
exit /b 0

:log
echo %~1
>> "%LOG_FILE%" echo %~1
exit /b 0
