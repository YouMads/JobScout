$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
$packageInfo = Get-Content -LiteralPath (Join-Path $packageRoot 'package.json') -Raw | ConvertFrom-Json
$archiveFile = Join-Path (Split-Path $packageRoot -Parent) ("JobScout-Source-v" + $packageInfo.version + '.zip')
Push-Location -LiteralPath $packageRoot
try {
 $sourceEntries = & node --input-type=module -e "import {sourceEntries} from './scripts/source-files.mjs'; console.log(JSON.stringify(sourceEntries))"
 if ($LASTEXITCODE -ne 0) { throw 'Could not read the source file manifest.' }
} finally { Pop-Location }
$decodedEntries = ConvertFrom-Json -InputObject ($sourceEntries -join [Environment]::NewLine)
$includedFiles = foreach ($sourceEntry in $decodedEntries) { Join-Path $packageRoot ([string]$sourceEntry) }
Compress-Archive -LiteralPath $includedFiles -DestinationPath $archiveFile -Force
Write-Output $archiveFile
