#Requires -Version 5.1
param([switch]$RequireAI, [string]$BaseUrl = 'http://127.0.0.1:4317')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'paths.ps1')
Set-Location -LiteralPath $projectRoot
foreach ($line in Get-Content -LiteralPath '.env') {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process') }
}
$pythonExe = $pythonEnvironment
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run scripts/bootstrap.ps1 to create the project virtual environment first.' }
$env:FABOPS_INTEGRATION = '1'
& $pythonExe -m pytest tests -q -p no:cacheprovider
if ($LASTEXITCODE) { throw 'Agent or live domain tests failed' }
$arguments = @('scripts\evaluate.py', '--agent', '--base-url', $BaseUrl)
if ($RequireAI) { $arguments += '--require-ai' }
& $pythonExe @arguments
if ($LASTEXITCODE) { throw 'Live retrieval/agent evaluation failed' }
if ($RequireAI) {
    $env:FABOPS_LIVE = '1'
    $env:FABOPS_BASE_URL = $BaseUrl
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $runtimeRoot 'playwright'
    Push-Location -LiteralPath web
    try {
        npx.cmd playwright install chromium
        if ($LASTEXITCODE) { throw 'Browser installation failed' }
        npm.cmd run test:e2e
        if ($LASTEXITCODE) { throw 'Live browser workflow failed' }
    } finally { Pop-Location }
}
Write-Host 'Verification complete. Reports and screenshots are in artifacts/.'
