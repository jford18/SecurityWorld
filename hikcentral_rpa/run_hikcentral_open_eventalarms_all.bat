@echo off
setlocal enabledelayedexpansion

set "BASE_DIR=C:\portal-sw\SecurityWorld\hikcentral_rpa"
set "PYTHON_EXE=%BASE_DIR%\venv\Scripts\python.exe"
set "SCRIPT1=%BASE_DIR%\hikcentral_open_eventalarms.py"
set "SCRIPT2=%BASE_DIR%\hikcentral_open_eventalarms 2.py"

call :banner "INICIO"

cd /d "%BASE_DIR%"
if errorlevel 1 (
  echo ERROR: No se pudo cambiar a %BASE_DIR%
  exit /b 1
)

if not exist "%PYTHON_EXE%" (
  echo ERROR: No existe %PYTHON_EXE%
  exit /b 1
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
"%PYTHON_EXE%" "%SCRIPT1%"
set "RC1=%ERRORLEVEL%"
if not "%RC1%"=="0" (
  echo ERROR: Script 1 fallo con RC=%RC1%
  exit /b 1
)

echo ----------------------------------------
"%PYTHON_EXE%" "%SCRIPT2%"
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
