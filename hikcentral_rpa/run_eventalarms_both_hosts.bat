@echo off
setlocal

REM (opcional) ir a la carpeta del script
cd /d C:\portal-sw\SecurityWorld\hikcentral_rpa

REM ejecutar host 1
py C:\portal-sw\SecurityWorld\hikcentral_rpa\hikcentral_open_eventalarms.py --host 172.16.9.10

REM ejecutar host 2
py C:\portal-sw\SecurityWorld\hikcentral_rpa\hikcentral_open_eventalarms.py --host 172.16.9.11

endlocal
