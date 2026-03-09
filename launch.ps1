#!/usr/bin/env pwsh
# launch.ps1 - Gore Karaoke launcher (PowerShell version)
# Also handles optional Windows cert store import for a warning-free host browser.

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    Gore Karaoke | Starting up..."             -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# -- Helpers ------------------------------------------------------------------------

function Check-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# Reload PATH from the registry so freshly installed tools become visible in
# this session without needing to open a new terminal.
function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') +
                [IO.Path]::PathSeparator +
                [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}

# -- Detect OS architecture early ---------------------------------------------------
# RuntimeInformation is .NET Core / PS 7+ only; Win PowerShell 5.1 uses .NET Framework
# and doesn't have it.  WMI (Get-CimInstance) reports the true hardware arch on all
# versions, regardless of whether this pwsh process itself is running under emulation.
try {
    $wmArch = (Get-CimInstance -ClassName Win32_OperatingSystem -Property OSArchitecture -ErrorAction Stop).OSArchitecture
    if     ($wmArch -match 'ARM') { $osArch = 'arm64' }
    elseif ($wmArch -match '64')  { $osArch = 'amd64' }
    else                          { $osArch = 'x86'   }
} catch {
    # Fallback: env var is accurate when the shell itself is native (not emulated)
    $osArch = $env:PROCESSOR_ARCHITECTURE.ToLower()
}

# -- winget availability ------------------------------------------------------------
$hasWinget = Check-Command "winget"
if (-not $hasWinget) {
    Write-Host "[WARN] winget (App Installer) not found. Automatic dependency installs" -ForegroundColor Yellow
    Write-Host "       will be skipped. Get it from the Microsoft Store if needed." -ForegroundColor Yellow
    Write-Host ""
}

# Install a package via winget and refresh PATH afterwards.
# Pass -SkipArchOverride to force the default (x64) binary even on ARM64 hosts
# (used for yt-dlp which ships no native ARM64 binary but runs fine under emulation).
function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$DisplayName,
        [switch]$SkipArchOverride
    )
    if (-not $hasWinget) { return }
    Write-Host "[INFO] Installing $DisplayName via winget..." -ForegroundColor Cyan
    $args = @("install", "--id", $Id, "--silent",
              "--accept-package-agreements", "--accept-source-agreements")
    if (-not $SkipArchOverride -and $osArch -eq "arm64") {
        $args += @("--architecture", "arm64")
    }
    # winget exit code -1978335189 (0x8A15002B) means "already installed / up to date" -- treat as OK
    $proc = Start-Process "winget" -ArgumentList $args -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne -1978335189) {
        Write-Host "[WARN] winget exited $($proc.ExitCode) for '$DisplayName'. Continuing anyway." -ForegroundColor Yellow
    }
    Refresh-Path
}

# -- Node.js ------------------------------------------------------------------------

if (-not (Check-Command "node")) {
    Write-Host "[INFO] Node.js not found. Attempting automatic install..." -ForegroundColor Yellow
    Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    if (-not (Check-Command "node")) {
        Write-Host "[ERROR] Node.js still not found after install attempt." -ForegroundColor Red
        Write-Host "        Install manually from https://nodejs.org (LTS) then re-run." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[INFO] Node.js installed successfully." -ForegroundColor Green
    Write-Host ""
}

# -- Python -------------------------------------------------------------------------
# node-gyp needs Python to compile better-sqlite3 when no prebuilt exists for the
# current Node version. Not required on most LTS installs, but auto-install it now
# to avoid a confusing failure later.

if (-not (Check-Command "python") -and -not (Check-Command "python3")) {
    Write-Host "[INFO] Python not found. Attempting automatic install..." -ForegroundColor Yellow
    Install-WingetPackage -Id "Python.Python.3" -DisplayName "Python 3"
    if (Check-Command "python" -or Check-Command "python3") {
        Write-Host "[INFO] Python installed successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARN] Python may not be in PATH yet. If 'pnpm install' fails for" -ForegroundColor Yellow
        Write-Host "       better-sqlite3, install Python from https://python.org and re-run." -ForegroundColor Yellow
    }
    Write-Host ""
}

# -- pnpm ---------------------------------------------------------------------------

if (-not (Check-Command "pnpm")) {
    Write-Host "[INFO] pnpm not found. Installing globally via npm..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host ""
}

# -- yt-dlp -------------------------------------------------------------------------
# The winget package is an x64 binary. On ARM64 it runs under Windows x64 emulation
# which is fully supported -- no native ARM64 build is required here.

if (-not (Check-Command "yt-dlp")) {
    Write-Host "[INFO] yt-dlp not found. Attempting automatic install..." -ForegroundColor Yellow
    Install-WingetPackage -Id "yt-dlp.yt-dlp" -DisplayName "yt-dlp" -SkipArchOverride
    if (Check-Command "yt-dlp") {
        Write-Host "[INFO] yt-dlp installed successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARN] yt-dlp still not in PATH (may need a terminal restart)." -ForegroundColor Yellow
        Write-Host "       YouTube fallback will not work until it is reachable." -ForegroundColor Yellow
    }
    Write-Host ""
}

# -- ARM64 / architecture checks ----------------------------------------------------
# Now that Node is confirmed present, check whether it is the native ARM64 build.

$nodeArch = & node -e "process.stdout.write(process.arch)" 2>$null

if ($osArch -eq "arm64") {
    Write-Host "[INFO] Detected ARM64 host (Snapdragon / Windows on ARM)." -ForegroundColor Cyan

    if ($nodeArch -ne "arm64") {
        Write-Host "[WARN] Node.js is arch='$nodeArch' on an ARM64 OS (running under emulation)." -ForegroundColor Yellow
        Write-Host "       Everything works, but for native performance run:" -ForegroundColor Yellow
        Write-Host "         winget install --id OpenJS.NodeJS.LTS --architecture arm64" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "[INFO] Node.js is native ARM64 -- good." -ForegroundColor Green
    }

    # If better-sqlite3 has no prebuilt for this Node version it will fall back to
    # node-gyp compilation, which requires MSVC with the ARM64 cross-compile target.
    if (-not (Check-Command "cl")) {
        Write-Host "[INFO] MSVC (cl.exe) not in PATH. If 'pnpm install' fails for better-sqlite3," -ForegroundColor DarkYellow
        Write-Host "       install Visual Studio Build Tools 2022 with:" -ForegroundColor DarkYellow
        Write-Host "         - 'Desktop development with C++'" -ForegroundColor DarkYellow
        Write-Host "         - 'MSVC v143 ARM64 build tools' optional component" -ForegroundColor DarkYellow
        Write-Host ""
    }
}

# -- Stale native addon guard -------------------------------------------------------
# better-sqlite3 compiles a .node binary that is architecture-specific.
# If node_modules was previously installed with a different Node arch (e.g. x64
# node_modules now being run by an ARM64 Node binary), the server will crash on
# startup.  Detect the mismatch here and force a clean reinstall.

function Get-PEArch($filePath) {
    try {
        $bytes    = [System.IO.File]::ReadAllBytes($filePath)
        $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
        $machine  = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
        switch ($machine) {
            0x8664 { return "x64"   }
            0xAA64 { return "arm64" }
            0x014C { return "x86"   }
            default { return "unknown" }
        }
    } catch { return "unknown" }
}

$sqliteAddon = "server\node_modules\better-sqlite3\build\Release\better_sqlite3.node"
if ((Test-Path "node_modules") -and (Test-Path $sqliteAddon)) {
    $addonArch = Get-PEArch $sqliteAddon
    if ($addonArch -ne "unknown" -and $addonArch -ne $nodeArch) {
        Write-Host "[WARN] Stale native addon detected: better-sqlite3 is '$addonArch' but Node is '$nodeArch'." -ForegroundColor Yellow
        Write-Host "[INFO] Removing node_modules and rebuilding for '$nodeArch'..." -ForegroundColor Cyan
        Remove-Item -Recurse -Force "node_modules"
        Remove-Item -Recurse -Force "server\node_modules" -ErrorAction SilentlyContinue
    }
}

# -- Dependencies -------------------------------------------------------------------

if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies (first run)..." -ForegroundColor Cyan
    pnpm install
    Write-Host ""
}

# -- Environment --------------------------------------------------------------------

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "[INFO] Creating .env from .env.example..." -ForegroundColor Cyan
        Copy-Item ".env.example" ".env"
    } else {
        Write-Host "[WARN] No .env file found - server will use defaults." -ForegroundColor Yellow
    }
}

# -- Build clients if needed --------------------------------------------------------

if (-not (Test-Path "client\display\dist\index.html")) {
    Write-Host "[INFO] Building display client..." -ForegroundColor Cyan
    pnpm --filter display build
}

if (-not (Test-Path "client\mobile\dist\index.html")) {
    Write-Host "[INFO] Building mobile client..." -ForegroundColor Cyan
    pnpm --filter mobile build
}

# -- Optional: import CA cert into Windows trust store ------------------------------
# Uncomment the block below (requires running as Administrator) to make Chrome/Edge
# trust the local CA without showing a certificate warning on the host machine.
#
# $caCert = "certs\rootCA.pem"
# if (Test-Path $caCert) {
#     Write-Host "[INFO] Importing CA cert into Windows trust store (requires admin)..." -ForegroundColor Cyan
#     Import-Certificate -FilePath $caCert -CertStoreLocation "Cert:\LocalMachine\Root"
#     Write-Host "[INFO] CA cert trusted. No more browser warnings on this machine." -ForegroundColor Green
# }

# -- Launch -------------------------------------------------------------------------

Write-Host ""
Write-Host "  Certs are auto-generated on first run." -ForegroundColor Green
Write-Host "  Phones: visit the /rootCA.pem URL shown in the server logs to install trust." -ForegroundColor Green
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    Starting server..." -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

pnpm --filter server start
