@echo off
setlocal enabledelayedexpansion

set "BASE_DIR=%~dp0"
set "VENV_PY=%BASE_DIR%venv\Scripts\python.exe"
set "PYTHON_EXE="
set "PYTHON_ARGS="
set "SCRIPT1=%BASE_DIR%hikcentral_open_eventalarms.py"
set "SCRIPT2=%BASE_DIR%hikcentral_open_eventalarms 2.py"

call :banner "INICIO"

cd /d "%BASE_DIR%"
if errorlevel 1 (
  echo ERROR: No se pudo cambiar a %BASE_DIR%
  exit /b 1
)

if exist "%VENV_PY%" (
  set "PYTHON_EXE=%VENV_PY%"
) else (
  where py >nul 2>&1
  if errorlevel 1 (
    echo ERROR: No existe %VENV_PY% y no se encontro "py -3".
    exit /b 1
  )
  set "PYTHON_EXE=py"
  set "PYTHON_ARGS=-3"
)
if not exist "%SCRIPT1%" (
  echo ERROR: No existe %SCRIPT1%
  exit /b 1
)
if not exist "%SCRIPT2%" (
  echo ERROR: No existe %SCRIPT2%
  exit /b 1
)

echo ----------------------------------------
echo PYTHON_EXE=%PYTHON_EXE% %PYTHON_ARGS%
"%PYTHON_EXE%" %PYTHON_ARGS% -c "import sys; print(sys.executable)"
"%PYTHON_EXE%" %PYTHON_ARGS% -c "import pandas as pd; import numpy as np; print('pandas', pd.__version__, 'numpy', np.__version__)"
if errorlevel 1 (
  echo ERROR: Faltan dependencias en este Python/venv.
  echo Ejecuta estos comandos para instalar en el venv:
  echo "%PYTHON_EXE%" %PYTHON_ARGS% -m pip install --upgrade pip
  echo "%PYTHON_EXE%" %PYTHON_ARGS% -m pip install pandas numpy psutil psycopg2-binary selenium python-dotenv webdriver-manager openpyxl xlrd
  exit /b 2
)

echo ----------------------------------------
"%PYTHON_EXE%" %PYTHON_ARGS% "%SCRIPT1%"
set "RC1=%ERRORLEVEL%"
if not "%RC1%"=="0" (
  echo ERROR: Script 1 fallo con RC=%RC1%
  exit /b 1
)

echo ----------------------------------------
"%PYTHON_EXE%" %PYTHON_ARGS% "%SCRIPT2%"
set "RC2=%ERRORLEVEL%"
if not "%RC2%"=="0" (
  echo ERROR: Script 2 fallo con RC=%RC2%
  exit /b 1
)

echo ----------------------------------------
call :banner "FIN"
exit /b 0

:banner
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set "FECHA=%%a/%%b/%%c"
for /f "tokens=1-2 delims=:" %%a in ('time /t') do set "HORA=%%a:%%b"
echo ========================================
echo [%FECHA% %HORA%] %~1
exit /b 0
