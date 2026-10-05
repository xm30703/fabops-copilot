#Requires -Version 5.1
param([switch]$RequireAI)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)
Set-Location -LiteralPath $projectRoot
foreach ($line in Get-Content -LiteralPath '.env') {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process') }
}
$portablePython = Join-Path $workspaceRoot 'work\venv\Scripts\python.exe'
$pythonExe = if (Test-Path -LiteralPath $portablePython) { $portablePython } else { Join-Path $projectRoot '.venv\Scripts\python.exe' }
$env:FABOPS_INTEGRATION = '1'
& $pythonExe -m pytest tests -q -p no:cacheprovider
if ($LASTEXITCODE) { throw 'Agent or live domain tests failed' }
$arguments = @('scripts\evaluate.py', '--agent')
if ($RequireAI) { $arguments += '--require-ai' }
& $pythonExe @arguments
if ($LASTEXITCODE) { throw 'Live retrieval/agent evaluation failed' }
if ($RequireAI) {
    $env:FABOPS_LIVE = '1'
    $portableBrowser = Join-Path $workspaceRoot 'work\playwright'
    $env:PLAYWRIGHT_BROWSERS_PATH = if (Test-Path -LiteralPath $portableBrowser) { $portableBrowser } else { Join-Path $projectRoot '.tools\playwright' }
    Push-Location -LiteralPath web
    try {
        npx.cmd playwright install chromium
        if ($LASTEXITCODE) { throw 'Browser installation failed' }
        npm.cmd run test:e2e
        if ($LASTEXITCODE) { throw 'Live browser workflow failed' }
    } finally { Pop-Location }
}
Write-Host 'Verification complete. Reports and screenshots are in artifacts/.'
