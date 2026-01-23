@echo off
setlocal
cd /d C:\portal-sw\SecurityWorld
if not exist logs mkdir logs\
echo [%date% %time%] INICIO FRONTEND (VITE) >> logs\frontend.log
call npm run dev >> logs\frontend.log 2>&1
