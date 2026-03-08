#!/usr/bin/env pwsh
# launch.ps1 — Bootleggers Karaoke launcher (PowerShell version)
# Also handles optional Windows cert store import for a warning-free host browser.

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    Bootleggers Karaoke | Starting up..."      -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# -- Prerequisites ------------------------------------------------------------------

function Check-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

if (-not (Check-Command "node")) {
    Write-Error "Node.js not found. Download from https://nodejs.org (LTS)"
    exit 1
}

if (-not (Check-Command "pnpm")) {
    Write-Host "[INFO] pnpm not found. Installing globally..." -ForegroundColor Yellow
    npm install -g pnpm
}

if (-not (Check-Command "yt-dlp")) {
    Write-Host "[WARN] yt-dlp not found. YouTube fallback will not work." -ForegroundColor Yellow
    Write-Host "       Install with: winget install yt-dlp.yt-dlp" -ForegroundColor Yellow
    Write-Host ""
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
