# free-api-radar PowerShell wrapper (Windows)
# Usage: pwsh scripts/fetch-free-apis.ps1 refresh [--offline] [--stale-hours 24] [--only a,b]
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$engine = Join-Path $root "scripts\fetch-free-apis.mjs"
if (-not (Test-Path $engine)) { throw "Engine not found: $engine" }
& node $engine @args
exit $LASTEXITCODE
