@echo off
title Bootleggers Karaoke
color 0A

echo.
echo  ============================================
echo    Bootleggers Karaoke ^| Starting up...
echo  ============================================
echo.

:: ── Prerequisites check ────────────────────────────────────────────────────

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo         Download and install from https://nodejs.org ^(LTS^)
    pause & exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [INFO] pnpm not found. Installing globally via npm...
    npm install -g pnpm
    if errorlevel 1 ( echo [ERROR] Failed to install pnpm. & pause & exit /b 1 )
)

where yt-dlp >nul 2>&1
if errorlevel 1 (
    echo [WARN] yt-dlp not found. YouTube fallback (embed-blocked videos) will not work.
    echo        Install with: winget install yt-dlp.yt-dlp
    echo.
)

:: ── Dependencies ───────────────────────────────────────────────────────────

if not exist "node_modules" (
    echo [INFO] Installing dependencies (first run may take a minute)...
    pnpm install
    if errorlevel 1 ( echo [ERROR] pnpm install failed. & pause & exit /b 1 )
    echo.
)

:: ── Environment ────────────────────────────────────────────────────────────

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy ".env.example" ".env" >nul
    ) else (
        echo [WARN] No .env file found. Server will use defaults.
    )
)

:: ── Build clients if needed ────────────────────────────────────────────────

if not exist "client\display\dist\index.html" (
    echo [INFO] Building display client...
    pnpm --filter display build
    if errorlevel 1 ( echo [ERROR] Display build failed. & pause & exit /b 1 )
)

if not exist "client\mobile\dist\index.html" (
    echo [INFO] Building mobile client...
    pnpm --filter mobile build
    if errorlevel 1 ( echo [ERROR] Mobile build failed. & pause & exit /b 1 )
)

:: ── Launch ─────────────────────────────────────────────────────────────────

echo.
echo  Certs will be auto-generated on first run if missing.
echo  Phones: open the URL shown below and install rootCA.pem to trust HTTPS.
echo.
echo  ============================================
echo    Starting server... check logs below.
echo  ============================================
echo.

pnpm --filter server start

pause
