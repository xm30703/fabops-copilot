#Requires -Version 5.1
param([switch]$Offline)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'paths.ps1')
Set-Location -LiteralPath $projectRoot
New-Item -ItemType Directory -Path artifacts,.tools -Force | Out-Null
function New-RandomHex([int]$Bytes) {
    $buffer = New-Object byte[] $Bytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
    return [BitConverter]::ToString($buffer).Replace('-', '')
}
if (-not (Test-Path -LiteralPath '.env')) {
    $template = Get-Content -LiteralPath '.env.example' -Raw
    $template = $template.Replace('fabops-local-only', (New-RandomHex 20))
    $template = $template.Replace('local-service-change-me', (New-RandomHex 32))
    $template = $template.Replace('local-operator-change-me', (New-RandomHex 32))
    [IO.File]::WriteAllText((Join-Path $projectRoot '.env'), $template, (New-Object Text.UTF8Encoding $false))
}
foreach ($line in Get-Content -LiteralPath '.env') {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process') }
}
if ($Offline) { $env:AI_PROVIDER = 'offline' }
$env:DB_CONNECTION = "Host=127.0.0.1;Port=5439;Database=fabops;Username=fabops;Password=$env:DB_PASSWORD"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.tools\dotnet-home'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.tools\nuget'
$env:NUGET_HTTP_CACHE_PATH = Join-Path $projectRoot '.tools\nuget-http'
$env:NUGET_SCRATCH = Join-Path $projectRoot '.tools\nuget-scratch'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $runtimeRoot 'playwright'
$dotnetExe = Resolve-FabOpsTool 'dotnet.exe' 'tools\dotnet\dotnet.exe'
if (-not (Test-Path -LiteralPath $pythonEnvironment)) {
    python.exe -m venv .venv
    if ($LASTEXITCODE) { throw 'Python venv failed' }
}
$pythonExe = $pythonEnvironment
& $pythonExe -m pip install -r requirements-lock.txt --cache-dir (Join-Path $runtimeRoot 'cache\pip')
if ($LASTEXITCODE) { throw 'Python dependency installation failed' }
docker compose up -d --wait
if ($LASTEXITCODE) { throw 'Docker Compose failed. Ensure Docker Desktop Engine is running.' }
& $dotnetExe restore tests\FabOps.Tests.csproj --configfile NuGet.Config
if ($LASTEXITCODE) { throw '.NET restore failed' }
& $dotnetExe build api\FabOps.Api.csproj --no-restore
if ($LASTEXITCODE) { throw '.NET build failed' }
& $dotnetExe test tests\FabOps.Tests.csproj --no-restore
if ($LASTEXITCODE) { throw 'xUnit tests failed' }
Push-Location -LiteralPath web
npm.cmd ci --cache ..\.tools\npm-cache --no-audit --no-fund
if ($LASTEXITCODE) { throw 'Frontend dependency installation failed' }
npm.cmd run build
if ($LASTEXITCODE) { throw 'Angular build failed' }
Pop-Location
$processes = @()
function Wait-Endpoint([string]$Url, [int]$Seconds = 60) {
    for ($attempt = 0; $attempt -lt $Seconds; $attempt++) {
        try { $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { return } } catch { }
        Start-Sleep -Seconds 1
    }
    throw "Endpoint not ready: $Url. See artifacts logs."
}
try {
    try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:5080/health/live' -UseBasicParsing -TimeoutSec 2; throw 'Port 5080 is already in use. Stop the previous API before starting.' }
    catch { if ($_.Exception.Message -like 'Port 5080*') { throw } }
    $apiProcess = Start-Process -FilePath $dotnetExe -ArgumentList @('api\bin\Debug\net8.0\FabOps.Api.dll') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput 'artifacts\api.stdout.log' -RedirectStandardError 'artifacts\api.stderr.log'
    $processes += @{id=$apiProcess.Id; executable=(Get-Process -Id $apiProcess.Id).Path; startedAtUtc=$apiProcess.StartTime.ToUniversalTime().ToString('o')}
    Wait-Endpoint 'http://127.0.0.1:5080/health/ready'
    if (-not $Offline) {
        $ollamaExe = Resolve-FabOpsTool 'ollama.exe' 'tools\ollama\ollama.exe'
        try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 2 }
        catch {
            $env:OLLAMA_MODELS = Join-Path $runtimeRoot 'models'
            $env:OLLAMA_HOST = '127.0.0.1:11434'
            $ollamaProcess = Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput 'artifacts\ollama.stdout.log' -RedirectStandardError 'artifacts\ollama.stderr.log'
            $processes += @{id=$ollamaProcess.Id; executable=(Get-Process -Id $ollamaProcess.Id).Path; startedAtUtc=$ollamaProcess.StartTime.ToUniversalTime().ToString('o')}
            Wait-Endpoint 'http://127.0.0.1:11434/api/tags'
        }
        & $ollamaExe pull $env:OLLAMA_CHAT_MODEL
        if ($LASTEXITCODE) { throw 'Chat model download failed' }
        & $ollamaExe pull $env:OLLAMA_EMBED_MODEL
        if ($LASTEXITCODE) { throw 'Embedding model download failed' }
        & $pythonExe -m agent.ingest
    } else { & $pythonExe -m agent.ingest --lexical-only }
    if ($LASTEXITCODE) { throw 'Knowledge ingestion failed' }
    & $pythonExe -m pytest tests -q -p no:cacheprovider
    if ($LASTEXITCODE) { throw 'Agent tests failed' }
    $gatewayProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','agent.app:app','--host','127.0.0.1','--port','4317') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput 'artifacts\agent.stdout.log' -RedirectStandardError 'artifacts\agent.stderr.log'
    $processes += @{id=$gatewayProcess.Id; executable=(Get-Process -Id $gatewayProcess.Id).Path; startedAtUtc=$gatewayProcess.StartTime.ToUniversalTime().ToString('o')}
    Wait-Endpoint 'http://127.0.0.1:4317/api/health'
    ConvertTo-Json -InputObject @($processes) | Set-Content -LiteralPath 'artifacts\processes.json' -Encoding UTF8
    Write-Host 'Ready: http://127.0.0.1:4317 | Jaeger: http://127.0.0.1:16686'
    Write-Host 'Run scripts\evaluate.py to verify actual retrieval and agent behavior before your demo.'
} catch {
    foreach ($entry in $processes) {
        $ownedProcess = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($ownedProcess -and $ownedProcess.Path -eq $entry.executable) { & taskkill.exe /PID $entry.id /T /F | Out-Null }
    }
    throw
}
