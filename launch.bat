@echo off
title Gore Karaoke
color 0A
setlocal EnableDelayedExpansion

echo.
echo  ============================================
echo    Gore Karaoke ^| Starting up...
echo  ============================================
echo.

:: -- winget availability -----------------------------------------------------------
set HAS_WINGET=0
where winget >nul 2>&1 && set HAS_WINGET=1
if "%HAS_WINGET%"=="0" (
    echo [WARN] winget ^(App Installer^) not found.  Automatic dependency installs
    echo        will be skipped.  Get it from the Microsoft Store if needed.
    echo.
)

:: Helper: refresh PATH from registry so freshly-installed tools are visible
:: in this session without reopening the terminal.
goto :after_refresh_fn
:refresh_path
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command ^
        "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) ^
        do set "PATH=%%P"
    exit /b 0
:after_refresh_fn

:: Helper: install a package via winget (silent, auto-accept)
:: Usage: call :winget_install <package-id> <display-name> [arm64override]
::   arm64override = 1  → add --architecture arm64 when on ARM64 host
::   arm64override = 0  → skip arch override (e.g. yt-dlp x64 on ARM64 is fine)
goto :after_winget_fn
:winget_install
    set "_WG_ID=%~1"
    set "_WG_NAME=%~2"
    set "_WG_ARCH=%~3"
    if "%HAS_WINGET%"=="0" exit /b 1
    echo [INFO] Installing %_WG_NAME% via winget...
    set "_WG_ARGS=install --id %_WG_ID% --silent --accept-package-agreements --accept-source-agreements"
    if "%_WG_ARCH%"=="1" if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
        set "_WG_ARGS=%_WG_ARGS% --architecture arm64"
    )
    winget %_WG_ARGS%
    call :refresh_path
    exit /b 0
:after_winget_fn

:: -- Node.js -----------------------------------------------------------------------

where node >nul 2>&1
if errorlevel 1 (
    echo [INFO] Node.js not found. Attempting automatic install...
    call :winget_install "OpenJS.NodeJS.LTS" "Node.js LTS" 1
    where node >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Node.js still not found after install attempt.
        echo         Install manually from https://nodejs.org ^(LTS^) then re-run.
        pause & exit /b 1
    )
    echo [INFO] Node.js installed successfully.
    echo.
)

:: -- Python ------------------------------------------------------------------------
:: node-gyp needs Python to compile better-sqlite3 when no prebuilt exists.
:: Auto-install now to avoid a confusing failure during pnpm install.

where python >nul 2>&1
if errorlevel 1 (
    where python3 >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Python not found. Attempting automatic install...
        call :winget_install "Python.Python.3" "Python 3" 1
        where python >nul 2>&1
        if errorlevel 1 (
            echo [WARN] Python may not be in PATH yet. If pnpm install fails for
            echo        better-sqlite3, install Python from https://python.org and re-run.
        ) else (
            echo [INFO] Python installed successfully.
        )
        echo.
    )
)

:: -- pnpm --------------------------------------------------------------------------

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [INFO] pnpm not found. Installing globally via npm...
    npm install -g pnpm
    if errorlevel 1 ( echo [ERROR] Failed to install pnpm. & pause & exit /b 1 )
    echo.
)

:: -- yt-dlp ------------------------------------------------------------------------
:: The winget package is x64-only; it runs fine under Windows ARM64 x64 emulation.

where yt-dlp >nul 2>&1
if errorlevel 1 (
    echo [INFO] yt-dlp not found. Attempting automatic install...
    call :winget_install "yt-dlp.yt-dlp" "yt-dlp" 0
    where yt-dlp >nul 2>&1
    if errorlevel 1 (
        echo [WARN] yt-dlp still not in PATH. YouTube fallback will not work until
        echo        it is reachable. Re-running the launcher may fix it.
    ) else (
        echo [INFO] yt-dlp installed successfully.
    )
    echo.
)

:: -- ARM64 / architecture checks --------------------------------------------------

for /f %%A in ('node -e "process.stdout.write(process.arch)"') do set NODE_ARCH=%%A

if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    echo [INFO] Detected ARM64 host ^(Snapdragon / Windows on ARM^).

    if /i NOT "%NODE_ARCH%"=="arm64" (
        echo [WARN] Node.js is arch=%NODE_ARCH% on an ARM64 OS ^(running under emulation^).
        echo        Everything works, but for native performance run:
        echo          winget install --id OpenJS.NodeJS.LTS --architecture arm64
        echo.
    ) else (
        echo [INFO] Node.js is native ARM64 -- good.
    )

    where cl >nul 2>&1
    if errorlevel 1 (
        echo [INFO] MSVC ^(cl.exe^) not in PATH. If pnpm install fails for better-sqlite3,
        echo        install Visual Studio Build Tools 2022 with:
        echo          - Desktop development with C++
        echo          - MSVC v143 ARM64 build tools ^(optional component^)
        echo.
    )
)

:: -- Stale native addon guard -----------------------------------------------------
:: better-sqlite3 is a native .node binary. If node_modules was built with a
:: different Node arch (e.g. x64 addons now used by an ARM64 Node), the server
:: will crash at startup.  Use PowerShell's binary read to check the PE machine
:: type of the addon and force a clean reinstall on mismatch.

if exist "node_modules" (
    if exist "server\node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
        for /f %%A in ('powershell -NoProfile -Command ^
            "$b=[IO.File]::ReadAllBytes('server\node_modules\better-sqlite3\build\Release\better_sqlite3.node'); $o=[BitConverter]::ToInt32($b,0x3C); $m=[BitConverter]::ToUInt16($b,$o+4); if($m -eq 0xAA64){'arm64'}elseif($m -eq 0x8664){'x64'}else{'unknown'}"') do set ADDON_ARCH=%%A
        if /i NOT "%ADDON_ARCH%"=="%NODE_ARCH%" (
            if NOT "%ADDON_ARCH%"=="unknown" (
                echo [WARN] Stale native addon: better-sqlite3 is '%ADDON_ARCH%' but Node is '%NODE_ARCH%'.
                echo [INFO] Removing node_modules and rebuilding for '%NODE_ARCH%'...
                rd /s /q node_modules
                if exist "server\node_modules" rd /s /q server\node_modules
            )
        )
    )
)

:: -- Dependencies -----------------------------------------------------------------

if not exist "node_modules" (
    echo [INFO] Installing dependencies (first run may take a minute)...
    pnpm install
    if errorlevel 1 ( echo [ERROR] pnpm install failed. & pause & exit /b 1 )
    echo.
)

:: -- Environment ------------------------------------------------------------------

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy ".env.example" ".env" >nul
    ) else (
        echo [WARN] No .env file found. Server will use defaults.
    )
)

:: -- Build clients if needed ------------------------------------------------------

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

:: -- Launch -----------------------------------------------------------------------

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
