$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Install Node.js 22 or newer from https://nodejs.org, then run this again.'; exit 1 }
& node -e "if(Number(process.versions.node.split('.')[0])<22){console.error('JobScout needs Node.js 22 or newer.');process.exit(1)}"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$packageInfo = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
$pdfDependency = Join-Path $PSScriptRoot 'node_modules\unpdf\package.json'
$needsDependencies = -not (Test-Path -LiteralPath $pdfDependency)
if (-not $needsDependencies) { $needsDependencies = (Get-Content -LiteralPath $pdfDependency -Raw | ConvertFrom-Json).version -ne $packageInfo.dependencies.unpdf }
if ($needsDependencies) {
 Write-Host 'Preparing the free PDF reader for CV imports (internet needed on first start)...'
 & npm.cmd ci --omit=dev --ignore-scripts --no-fund --no-audit
 if ($LASTEXITCODE -ne 0) { Write-Host 'Setup could not finish. Check your internet connection and try again.'; exit 1 }
}
Write-Host 'Keep this window open while using JobScout. Press Ctrl+C to stop.'
& node (Join-Path $PSScriptRoot 'scripts\launch.mjs') --open --start-ollama
exit $LASTEXITCODE
