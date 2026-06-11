@echo off
title RAMspace
cd /d "%~dp0"

echo Starting RAMspace server...
start "RAMspace Server" /min cmd /c "npm run dev"

echo Waiting for server...
:WAIT
timeout /t 2 /nobreak >nul
powershell -Command "Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2" >nul 2>nul
if %ERRORLEVEL% NEQ 0 goto WAIT

start "" "http://localhost:3000"
exit /b 0
