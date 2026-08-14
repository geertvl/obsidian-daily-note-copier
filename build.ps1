<#
.SYNOPSIS
    Build script for the Obsidian Daily Note Copier plugin.

.PARAMETER Dev
    When set, runs esbuild in watch mode (rebuilds on file changes).
    Omit for a one-shot production build.

.EXAMPLE
    # Production build
    .\build.ps1

    # Development / watch mode
    .\build.ps1 -Dev
#>
param(
    [switch]$Dev
)

$ErrorActionPreference = 'Stop'

# ── Load optional vault path from dev-config.ps1 ─────────────────────────────
$VaultPath = $null
if (Test-Path 'dev-config.ps1') {
    . '.\dev-config.ps1'
}

$pluginDir = $null
if ($VaultPath) {
    $pluginDir = Join-Path $VaultPath '.obsidian\plugins\obsidian-daily-note-copier'
    New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
    # Required by the Hot Reload plugin to watch this directory for changes
    $null = New-Item -ItemType File -Force -Path (Join-Path $pluginDir '.hotreload')
    Write-Host "Vault plugin dir: $pluginDir" -ForegroundColor DarkGray
} else {
    Write-Host "No dev-config.ps1 found — output goes to build\ only." -ForegroundColor DarkGray
    Write-Host "Copy dev-config.example.ps1 to dev-config.ps1 and set your vault path for auto-deploy." -ForegroundColor DarkGray
}

# ── 0. Ensure build/ directory exists ────────────────────────────────────────
New-Item -ItemType Directory -Force -Path 'build' | Out-Null

# ── 1. Copy wasm_exec.js from the local Go installation ──────────────────────
Write-Host '[1/4] Locating wasm_exec.js ...' -ForegroundColor Cyan

$goRoot = (go env GOROOT).Trim()

# Path changed from misc/wasm → lib/wasm in Go 1.21
$candidates = @(
    (Join-Path $goRoot 'lib\wasm\wasm_exec.js'),
    (Join-Path $goRoot 'misc\wasm\wasm_exec.js')
)
$wasmExecSrc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $wasmExecSrc) {
    Write-Error "Cannot find wasm_exec.js under GOROOT ($goRoot). Is Go installed correctly?"
    exit 1
}

Copy-Item $wasmExecSrc 'src\wasm_exec.js' -Force
Write-Host "    Copied from: $wasmExecSrc" -ForegroundColor DarkGray

# ── 2. Compile Go → WASM ─────────────────────────────────────────────────────
Write-Host '[2/4] Compiling Go to WASM ...' -ForegroundColor Cyan

$env:GOOS   = 'js'
$env:GOARCH = 'wasm'
try {
    Push-Location 'go'
    go build -o '..\build\plugin.wasm' .
    if ($LASTEXITCODE -ne 0) { throw "go build failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
    Remove-Item Env:\GOOS   -ErrorAction SilentlyContinue
    Remove-Item Env:\GOARCH -ErrorAction SilentlyContinue
}

$wasmSize = [math]::Round((Get-Item 'build\plugin.wasm').Length / 1MB, 2)
Write-Host "    build\plugin.wasm  $wasmSize MB" -ForegroundColor DarkGray

# Copy plugin.wasm and manifest.json to vault and touch main.js there so
# Hot Reload picks up the new binary without a manual plugin toggle.
if ($pluginDir) {
    Copy-Item 'build\plugin.wasm' (Join-Path $pluginDir 'plugin.wasm') -Force
    Copy-Item 'manifest.json'     (Join-Path $pluginDir 'manifest.json') -Force
    $mainJs = Join-Path $pluginDir 'main.js'
    if (Test-Path $mainJs) { (Get-Item $mainJs).LastWriteTime = Get-Date }
    Write-Host "    Copied to vault plugin dir" -ForegroundColor DarkGray
}

# ── 2b. Copy manifest.json into build/ ───────────────────────────────────────
Copy-Item 'manifest.json' 'build\manifest.json' -Force

# ── 3. Install npm dependencies ───────────────────────────────────────────────
if (-not (Test-Path 'node_modules')) {
    Write-Host '[3/4] Installing npm dependencies ...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else {
    Write-Host '[3/4] npm dependencies already installed.' -ForegroundColor DarkGray
}

# ── 4. Build / watch TypeScript ───────────────────────────────────────────────
# Pass vault path to esbuild so its onEnd plugin can copy main.js after each build.
if ($VaultPath) { $env:VAULT_PATH = $VaultPath }

if ($Dev) {
    Write-Host '[4/4] Starting esbuild in watch mode (Ctrl-C to stop) ...' -ForegroundColor Cyan
    node esbuild.config.mjs
} else {
    Write-Host '[4/4] Bundling TypeScript (production) ...' -ForegroundColor Cyan
    node esbuild.config.mjs production
    if ($LASTEXITCODE -ne 0) { throw "esbuild failed" }

    Write-Host ''
    Write-Host 'Build complete!' -ForegroundColor Green
}

Remove-Item Env:\VAULT_PATH -ErrorAction SilentlyContinue
