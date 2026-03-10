#!/usr/bin/env pwsh
# launch.ps1 - Gore Karaoke launcher (PowerShell version)
# Also handles optional Windows cert store import for a warning-free host browser.

param(
    [ValidateSet('auto', 'native', 'emulated')]
    [string]$Mode = 'auto'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$script:PathPrefix = $null

$launcherCacheRoot = Join-Path $env:LOCALAPPDATA 'GoreKaraoke\launcher-cache'
New-Item -ItemType Directory -Force -Path $launcherCacheRoot | Out-Null

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
    if ($script:PathPrefix) {
        $env:PATH = "$script:PathPrefix$([IO.Path]::PathSeparator)$env:PATH"
    }
}

function Ensure-PortableNodeX64 {
    param([string]$Version = 'v22.22.0')

    $toolsRoot = Join-Path $launcherCacheRoot 'tools'
    $nodeRoot = Join-Path $toolsRoot ("node-$Version-win-x64")
    $nodeExe  = Join-Path $nodeRoot 'node.exe'
    if (Test-Path $nodeExe) { return $nodeRoot }

    New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
    $zipName = "node-$Version-win-x64.zip"
    $zipPath = Join-Path $toolsRoot $zipName
    $url = "https://nodejs.org/dist/$Version/$zipName"

    $downloadAttempted = $false
    if (-not (Test-Path $zipPath)) {
        Write-Host "[INFO] Downloading portable Node x64 ($Version) for emulated mode..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $url -OutFile $zipPath
        $downloadAttempted = $true
    }

    Write-Host "[INFO] Extracting portable Node x64 (first run can take a minute)..." -ForegroundColor Cyan
    try {
        if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
            & tar.exe -xf $zipPath -C $toolsRoot
            if ($LASTEXITCODE -ne 0) { throw "tar extraction failed" }
        } else {
            Expand-Archive -Path $zipPath -DestinationPath $toolsRoot -Force
        }
    } catch {
        if ($downloadAttempted) { throw }
        Write-Host "[WARN] Cached Node zip appears incomplete; re-downloading..." -ForegroundColor Yellow
        Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
        Invoke-WebRequest -Uri $url -OutFile $zipPath
        if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
            & tar.exe -xf $zipPath -C $toolsRoot
            if ($LASTEXITCODE -ne 0) { throw "tar extraction failed" }
        } else {
            Expand-Archive -Path $zipPath -DestinationPath $toolsRoot -Force
        }
    }

    if (-not (Test-Path $nodeExe)) {
        Write-Host "[ERROR] Portable Node x64 was not extracted as expected." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    return $nodeRoot
}

function Ensure-PortablePnpm {
    param(
        [string]$NodeExe,
        [string]$NpmCli,
        [string]$Version = '9.0.0'
    )

    $pnpmRoot = Join-Path $launcherCacheRoot 'pnpm-x64'
    $pnpmCli = Join-Path $pnpmRoot 'node_modules\pnpm\bin\pnpm.cjs'
    if (Test-Path $pnpmCli) { return $pnpmCli }

    New-Item -ItemType Directory -Force -Path $pnpmRoot | Out-Null
    Write-Host "[INFO] Installing portable pnpm@$Version for emulated mode..." -ForegroundColor Cyan
    & $NodeExe $NpmCli install --prefix $pnpmRoot "pnpm@$Version" | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $pnpmCli)) {
        Write-Host "[ERROR] Failed to provision portable pnpm runtime." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    return $pnpmCli
}

function Resolve-CmdShim {
    param([string]$BaseName)

    $cmdShim = Get-Command "$BaseName.cmd" -ErrorAction SilentlyContinue
    if ($cmdShim) { return $cmdShim.Source }

    $plain = Get-Command $BaseName -ErrorAction SilentlyContinue
    if ($plain) { return $plain.Source }

    return $null
}

function Invoke-Checked {
    param(
        [string]$Exe,
        [string[]]$CommandArgs,
        [string]$FailureMessage
    )

    & $Exe @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] $FailureMessage" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

function Get-UsablePythonCommand {
    $candidates = @(
        @{ Name = 'python'; Args = @('--version') },
        @{ Name = 'python3'; Args = @('--version') },
        @{ Name = 'py'; Args = @('-3', '--version') }
    )

    foreach ($candidate in $candidates) {
        $cmd = Get-Command $candidate.Name -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }

        $src = $cmd.Source
        if (-not $src) { continue }

        # Ignore Windows Store app execution aliases; node-gyp cannot use these shims.
        if ($src -match '\\Microsoft\\WindowsApps\\') { continue }

        try {
            & $src @($candidate.Args) *> $null
            if ($LASTEXITCODE -eq 0) {
                return $src
            }
        } catch {
            continue
        }
    }

    return $null
}

function Invoke-PnpmChecked {
    param(
        [string[]]$PnpmArgs,
        [string]$FailureMessage
    )

    if ($script:portablePnpmCli) {
        & $script:nodeExe $script:portablePnpmCli @PnpmArgs
    } else {
        & $script:pnpmExe @PnpmArgs
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] $FailureMessage" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

$pythonExe = Get-UsablePythonCommand

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

$effectiveMode = switch ($Mode) {
    'native'   { 'native' }
    'emulated' { 'emulated' }
    default {
        if ($osArch -eq 'arm64') { 'emulated' } else { 'native' }
    }
}

$nodeExe = $null
$npmExe  = $null
$pnpmExe = $null
$npmCli  = $null
$portablePnpmCli = $null

if ($effectiveMode -eq 'emulated') {
    if ($osArch -ne 'arm64') {
        Write-Host "[WARN] Emulated mode requested on non-ARM64 host; using native mode instead." -ForegroundColor Yellow
        $effectiveMode = 'native'
    } else {
        $portableNodeRoot = Ensure-PortableNodeX64
        $nodeExe = Join-Path $portableNodeRoot 'node.exe'
        $npmCli = Join-Path $portableNodeRoot 'node_modules\npm\bin\npm-cli.js'
        if (-not (Test-Path $npmCli)) {
            Write-Host "[ERROR] Portable Node npm-cli was not found." -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }

        # Ensure all child commands resolve node/pnpm against the x64 runtime first.
        $script:PathPrefix = $portableNodeRoot
        $env:PATH = "$portableNodeRoot;$env:PATH"
        $portablePnpmCli = Ensure-PortablePnpm -NodeExe $nodeExe -NpmCli $npmCli
        Write-Host "[INFO] ARM64 host detected: using x64 emulated Node runtime for compatibility." -ForegroundColor Cyan
    }
}

if ($effectiveMode -eq 'native') {
    # Prefer .cmd shims in PowerShell to avoid ExecutionPolicy failures on generated .ps1 shims.
    $npmExe = Resolve-CmdShim "npm"
    $pnpmExe = Resolve-CmdShim "pnpm"

    if (-not $npmExe) {
        Write-Host "[ERROR] npm was not found in PATH. Install Node.js and re-run." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
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
    $usedArchOverride = $false
    if (-not $SkipArchOverride -and $osArch -eq "arm64") {
        $args += @("--architecture", "arm64")
        $usedArchOverride = $true
    }
    # winget exit code -1978335189 (0x8A15002B) means "already installed / up to date" -- treat as OK
    $proc = Start-Process "winget" -ArgumentList $args -NoNewWindow -Wait -PassThru
    # Some packages don't publish ARM64 manifests. Retry once without --architecture.
    if ($usedArchOverride -and $proc.ExitCode -eq -1978335212) {
        Write-Host "[WARN] $DisplayName has no ARM64 package in winget. Retrying with default architecture..." -ForegroundColor Yellow
        $retryArgs = @("install", "--id", $Id, "--silent",
                       "--accept-package-agreements", "--accept-source-agreements")
        $proc = Start-Process "winget" -ArgumentList $retryArgs -NoNewWindow -Wait -PassThru
    }
    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne -1978335189) {
        Write-Host "[WARN] winget exited $($proc.ExitCode) for '$DisplayName'. Continuing anyway." -ForegroundColor Yellow
    }
    Refresh-Path
}

# -- Node.js ------------------------------------------------------------------------

if ($effectiveMode -eq 'native' -and -not (Check-Command "node")) {
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

if ($effectiveMode -eq 'native') {
    $nodeExe = Resolve-CmdShim "node"
}

if (-not $nodeExe) {
    Write-Host "[ERROR] Could not resolve a Node.js executable for mode '$effectiveMode'." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# -- Python -------------------------------------------------------------------------
# node-gyp needs Python to compile better-sqlite3 when no prebuilt exists for the
# current Node version. Not required on most LTS installs, but auto-install it now
# to avoid a confusing failure later.

if (-not $pythonExe) {
    Write-Host "[INFO] Python not found. Attempting automatic install..." -ForegroundColor Yellow
    Install-WingetPackage -Id "Python.Python.3.12" -DisplayName "Python 3.12"
    $pythonExe = Get-UsablePythonCommand
    if ($pythonExe) {
        Write-Host "[INFO] Python installed successfully." -ForegroundColor Green
    } else {
        Write-Host "[WARN] Python is still not usable from PATH." -ForegroundColor Yellow
        Write-Host "       If 'pnpm install' needs to compile better-sqlite3, install Python 3 and re-run." -ForegroundColor Yellow
        Write-Host "       Example: winget install --id Python.Python.3.12 --architecture arm64" -ForegroundColor Yellow
    }
    Write-Host ""
}

# -- pnpm ---------------------------------------------------------------------------

if ($effectiveMode -eq 'native' -and -not (Check-Command "pnpm")) {
    Write-Host "[INFO] pnpm not found. Installing globally via npm..." -ForegroundColor Yellow
    Invoke-Checked -Exe $npmExe -CommandArgs @('install', '-g', 'pnpm') -FailureMessage "Failed to install pnpm globally via npm."
    $pnpmExe = Resolve-CmdShim "pnpm"
    Write-Host ""
}

if ($effectiveMode -eq 'native' -and -not $pnpmExe) {
    Write-Host "[ERROR] pnpm is still not available. Install with 'npm install -g pnpm' and re-run." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
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

$nodeArch = & $nodeExe -e "process.stdout.write(process.arch)" 2>$null
$nodeVersion = & $nodeExe -e "process.stdout.write(process.version)" 2>$null

if ($osArch -eq "arm64") {
    Write-Host "[INFO] Detected ARM64 host (Snapdragon / Windows on ARM)." -ForegroundColor Cyan

    if ($effectiveMode -eq 'emulated') {
        Write-Host "[INFO] Runtime mode: emulated x64 Node for cross-arch compatibility." -ForegroundColor Green
    } else {
        Write-Host "[INFO] Runtime mode: native Node." -ForegroundColor Green
    }
    Write-Host "[INFO] Using Node $nodeVersion (arch='$nodeArch')." -ForegroundColor Green

    if ($nodeArch -ne "arm64") {
        Write-Host "[INFO] x64 emulation is expected in this mode." -ForegroundColor DarkYellow
    } else {
        Write-Host "[INFO] Node.js is native ARM64." -ForegroundColor Green
    }

    # If better-sqlite3 has no prebuilt for this Node version it will fall back to
    # node-gyp compilation, which requires MSVC with the ARM64 cross-compile target.
    if ($effectiveMode -eq 'native' -and -not (Check-Command "cl")) {
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

$runtimeMarkerDir = Join-Path $launcherCacheRoot 'runtime'
$runtimeMarkerPath = Join-Path $runtimeMarkerDir 'runtime-marker.txt'
$runtimeMarker = "$effectiveMode|$nodeArch|$nodeVersion"
$requiresCleanInstall = $false

if (Test-Path 'node_modules') {
    if (-not (Test-Path $runtimeMarkerPath)) {
        $requiresCleanInstall = $true
        Write-Host "[WARN] Existing node_modules has no runtime marker; forcing clean install." -ForegroundColor Yellow
    } else {
        $previousMarker = (Get-Content $runtimeMarkerPath -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($previousMarker -ne $runtimeMarker) {
            $requiresCleanInstall = $true
            Write-Host "[WARN] Runtime changed ($previousMarker -> $runtimeMarker). Rebuilding dependencies..." -ForegroundColor Yellow
        }
    }
}

if ($requiresCleanInstall) {
    Write-Host "[INFO] Removing node_modules for clean rebuild..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force 'node_modules' -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force 'server\node_modules' -ErrorAction SilentlyContinue
}

# -- Dependencies -------------------------------------------------------------------

if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies (first run)..." -ForegroundColor Cyan
    Invoke-PnpmChecked -PnpmArgs @('install', '--ignore-scripts=false') -FailureMessage "Dependency installation failed."
    Write-Host ""
}

$sqliteBindingGlob = 'node_modules\.pnpm\better-sqlite3@*\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
$hasSqliteBinding = [bool](Get-ChildItem -Path $sqliteBindingGlob -ErrorAction SilentlyContinue)
if (-not $hasSqliteBinding) {
    Write-Host "[WARN] better-sqlite3 native binding is missing. Reinstalling dependencies..." -ForegroundColor Yellow
    Invoke-PnpmChecked -PnpmArgs @('install', '--ignore-scripts=false') -FailureMessage "Dependency reinstall failed while fixing better-sqlite3."

    Write-Host "[INFO] Rebuilding better-sqlite3 explicitly..." -ForegroundColor Cyan
    Invoke-PnpmChecked -PnpmArgs @('--filter', 'server', 'rebuild', 'better-sqlite3') -FailureMessage "better-sqlite3 rebuild failed."

    $hasSqliteBinding = [bool](Get-ChildItem -Path $sqliteBindingGlob -ErrorAction SilentlyContinue)
}

if (-not $hasSqliteBinding) {
    Write-Host "[ERROR] better-sqlite3 is still missing its native binding." -ForegroundColor Red
    if (-not $pythonExe) {
        Write-Host "        Python is not usable from PATH. Install Python 3 and re-run." -ForegroundColor Red
    }
    if ($effectiveMode -eq 'native' -and $osArch -eq 'arm64') {
        Write-Host "        On ARM64 native mode, install Visual Studio Build Tools 2022 with MSVC v143 ARM64 tools." -ForegroundColor Red
    } elseif ($effectiveMode -eq 'emulated' -and $osArch -eq 'arm64') {
        Write-Host "        Emulated mode could not produce a compatible prebuilt/binary; try: .\launch.ps1 -Mode native" -ForegroundColor Red
    }
    Read-Host "Press Enter to exit"
    exit 1
}

New-Item -ItemType Directory -Force -Path $runtimeMarkerDir | Out-Null
Set-Content -Path $runtimeMarkerPath -Value $runtimeMarker -NoNewline

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
    Invoke-PnpmChecked -PnpmArgs @('--filter', 'display', 'build') -FailureMessage "Display build failed."
}

if (-not (Test-Path "client\mobile\dist\index.html")) {
    Write-Host "[INFO] Building mobile client..." -ForegroundColor Cyan
    Invoke-PnpmChecked -PnpmArgs @('--filter', 'mobile', 'build') -FailureMessage "Mobile build failed."
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

Invoke-PnpmChecked -PnpmArgs @('--filter', 'server', 'start') -FailureMessage "Server failed to start."
