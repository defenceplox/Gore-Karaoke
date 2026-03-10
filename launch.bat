@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%launch.ps1"

if not exist "%PS1%" (
    echo [ERROR] Could not find launch.ps1 next to launch.bat
    pause
    exit /b 1
)

where pwsh >nul 2>&1
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
    set "EXITCODE=%errorlevel%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
    set "EXITCODE=%errorlevel%"
)

if not "%EXITCODE%"=="0" (
    echo.
    echo [ERROR] Launcher exited with code %EXITCODE%.
    pause
)

exit /b %EXITCODE%
