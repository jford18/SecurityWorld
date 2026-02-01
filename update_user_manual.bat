@echo off
setlocal

cd /d "C:\portal-sw\SecurityWorld"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "ARCHIVE_DIR=tools\user-manual\archives\%TS%"

mkdir "%ARCHIVE_DIR%" >nul 2>&1

if exist "tools\user-manual\manual.md" copy "tools\user-manual\manual.md" "%ARCHIVE_DIR%\" >nul
if exist "tools\user-manual\manual.html" copy "tools\user-manual\manual.html" "%ARCHIVE_DIR%\" >nul
if exist "tools\user-manual\manual.pdf" copy "tools\user-manual\manual.pdf" "%ARCHIVE_DIR%\" >nul

if exist "tools\user-manual\out\*.png" (
  mkdir "%ARCHIVE_DIR%\out" >nul 2>&1
  robocopy tools\user-manual\out "%ARCHIVE_DIR%\out" *.png /NFL /NDL /NJH /NJS /NC /NS /NP
  cmd /c exit /b 0
)

del /q tools\user-manual\out\*.png 2>nul
cmd /c exit /b 0

node tools\user-manual\capture.screenshots.mjs
if errorlevel 1 (
  echo ERROR: fallo capture.screenshots.mjs
  echo Backup: %ARCHIVE_DIR%
  exit /b 1
)

node tools\user-manual\build.manual.mjs
if errorlevel 1 (
  echo ERROR: fallo build.manual.mjs
  echo Backup: %ARCHIVE_DIR%
  exit /b 1
)

echo Capturas: tools\user-manual\out
echo Manual HTML: tools\user-manual\manual.html
echo Manual PDF: tools\user-manual\manual.pdf
echo Backup: %ARCHIVE_DIR%
