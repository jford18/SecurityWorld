@echo off
setlocal
cd /d C:\portal-sw\SecurityWorld\server
if not exist logs mkdir logs\
echo [%date% %time%] INICIO BACKEND (NODE) >> logs\backend.log
call node index.js >> logs\backend.log 2>&1
