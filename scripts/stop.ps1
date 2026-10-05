$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (Test-Path -LiteralPath 'artifacts\processes.json') {
    foreach ($entry in (Get-Content -LiteralPath 'artifacts\processes.json' -Raw | ConvertFrom-Json)) {
        $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($process -and $process.Path -eq $entry.executable) {
            if ($entry.startedAtUtc -and $process.StartTime.ToUniversalTime() -ne [datetime]::Parse($entry.startedAtUtc).ToUniversalTime()) { continue }
            & taskkill.exe /PID $entry.id /T /F | Out-Null
        }
    }
}
docker compose stop
# Persist database and models. No delete/reset command is run.
