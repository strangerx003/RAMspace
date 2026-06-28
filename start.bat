@echo off
setlocal enabledelayedexpansion

REM ================================================
REM  RAMSspace - Enterprise RAMS Tool Launcher
REM ================================================
REM
REM  HOW TO RUN MANUALLY (without this batch file):
REM  -------------------------------------------
REM    Quick start (production mode):
REM      1. cd frontend
REM      2. npm install                  (first time only)
REM      3. npm run build                (one-time build)
REM      4. npm start                    (serves on port 3000)
REM      5. Open http://localhost:3000
REM
REM    Development mode (auto-rebuild on changes):
REM      1. cd frontend
REM      2. npm install                  (first time only)
REM      3. npm run dev                  (starts esbuild watcher)
REM      4. Open a SEPARATE terminal:
REM         cd frontend
REM         npm start                    (serves on port 3000)
REM      5. Open http://localhost:3000
REM
REM  PREREQUISITES:
REM  - Node.js v18 or later: https://nodejs.org
REM  - npm (included with Node.js)
REM
REM ================================================

echo.
echo ================================================
echo    RAMSspace - Enterprise RAMS Tool
echo ================================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Download and install it from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"

REM Step 1: Install dependencies if needed
if not exist "frontend\node_modules\" (
    echo [1/3] Installing dependencies...
    cd frontend
    call npm install --no-fund --no-audit
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    cd ..
)

REM Step 2: Build
echo [2/3] Building application...
cd frontend
call node esbuild.config.js
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
cd ..

REM Step 3: Serve
echo [3/3] Starting web server...
echo.
echo Open http://localhost:3000 in your browser
echo Close this window to stop the server.
echo.

cd frontend

REM Open browser in background (wait a moment for server to start)
start /B cmd /c "timeout /t 2 >nul & start http://localhost:3000"

REM Use locally installed serve (no npx prompts)
call node_modules\.bin\serve.cmd public -p 3000

cd ..
echo.
echo Server stopped.
pause