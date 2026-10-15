@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Marine Shrimp Dashboard - Local Server
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install it from https://nodejs.org first.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Installing dependencies for the first time, this may take a moment...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [1/2] node_modules found, skipping install.
)

echo [2/2] Starting server...
echo.
echo Open your browser at http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.

call npm start

pause
