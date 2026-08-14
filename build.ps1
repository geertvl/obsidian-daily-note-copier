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

# ── 2b. Copy manifest.json into build/ ───────────────────────────────────────
Copy-Item 'manifest.json' 'build\manifest.json' -Force
Write-Host "    build\manifest.json copied" -ForegroundColor DarkGray

# ── 3. Install npm dependencies ───────────────────────────────────────────────
if (-not (Test-Path 'node_modules')) {
    Write-Host '[3/4] Installing npm dependencies ...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else {
    Write-Host '[3/4] npm dependencies already installed.' -ForegroundColor DarkGray
}

# ── 4. Build / watch TypeScript ───────────────────────────────────────────────
if ($Dev) {
    Write-Host '[4/4] Starting esbuild in watch mode (Ctrl-C to stop) ...' -ForegroundColor Cyan
    Write-Host '      main.js will be written to build\ on every save.' -ForegroundColor DarkGray
    node esbuild.config.mjs
} else {
    Write-Host '[4/4] Bundling TypeScript (production) ...' -ForegroundColor Cyan
    node esbuild.config.mjs production
    if ($LASTEXITCODE -ne 0) { throw "esbuild failed" }

    Write-Host ''
    Write-Host 'Build complete!  Output in build\' -ForegroundColor Green
    Write-Host ''
    Write-Host '  build\main.js'
    Write-Host '  build\manifest.json'
    Write-Host '  build\plugin.wasm'
    Write-Host ''
    Write-Host 'Junction command (run once):' -ForegroundColor Yellow
    $here = (Get-Location).Path
    Write-Host "  New-Item -ItemType Junction -Path `"<vault>\.obsidian\plugins\obsidian-daily-note-copier`" -Target `"$here\build`"" -ForegroundColor Yellow
}
