param(
    [string]$ImageTag,
    [string]$ImagePrefix = 'fabops',
    [string]$StateDirectory,
    [switch]$Pull,
    [switch]$Offline,
    [switch]$Rollback
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'paths.ps1')
if (-not $StateDirectory) { $StateDirectory = Join-Path $runtimeRoot 'staging' }
$StateDirectory = [IO.Path]::GetFullPath($StateDirectory)
New-Item -ItemType Directory -Force -Path $StateDirectory | Out-Null
$lock = [IO.File]::Open((Join-Path $StateDirectory 'deployment.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
$envFile = Join-Path $StateDirectory 'staging.env'
$stateFile = Join-Path $StateDirectory 'release.json'
$savedEnvironment = @{}
foreach ($name in @('IMAGE_PREFIX','IMAGE_TAG','AI_PROVIDER')) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}
function Invoke-Compose {
    param([string[]]$Arguments)
    & docker compose --env-file $envFile -f (Join-Path $projectRoot 'compose.staging.yaml') @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose command failed: $($Arguments[0]) (exit $LASTEXITCODE)" }
}
function Apply-Release {
    param($Release, [bool]$Download)
    $env:IMAGE_PREFIX = $Release.prefix
    $env:IMAGE_TAG = $Release.tag
    $env:AI_PROVIDER = $Release.provider
    if ($Download) { Invoke-Compose @('pull') }
    Invoke-Compose @('up','-d','--wait','--wait-timeout','180','--remove-orphans')
    $smoke = @('exec','-T','gateway','python','scripts/smoke.py')
    if ($Release.provider -eq 'ollama') { $smoke += '--require-ai' }
    Invoke-Compose $smoke
    $ingest = @('exec','-T','gateway','python','-m','agent.ingest')
    if ($Release.provider -eq 'offline') { $ingest += '--lexical-only' }
    Invoke-Compose $ingest
    $evaluate = @('exec','-T','gateway','python','scripts/evaluate.py','--agent')
    if ($Release.provider -eq 'ollama') { $evaluate += '--require-ai' }
    Invoke-Compose $evaluate
    Invoke-Compose @('cp','gateway:/app/artifacts/live-evaluation.json',(Join-Path $StateDirectory ('evaluation-' + $Release.tag + '.json')))
}
try {
    if (-not (Test-Path -LiteralPath $envFile)) {
        $configuration = @(
            ('DB_PASSWORD=' + (New-Secret)),
            ('SERVICE_KEY=' + (New-Secret)),
            ('OPERATOR_KEY=' + (New-Secret)),
            'APP_PORT=4319','JAEGER_PORT=16687',
            'OLLAMA_URL=http://host.docker.internal:11434',
            'OLLAMA_CHAT_MODEL=qwen2.5:7b','OLLAMA_EMBED_MODEL=nomic-embed-text'
        )
        [IO.File]::WriteAllLines($envFile, $configuration, [Text.UTF8Encoding]::new($false))
        Write-Host 'Created private staging configuration (ignored by Git).'
    }
    # Explicitly load the persistent staging values; inherited empty variables must not override them.
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^([A-Z_]+)=(.*)$') {
            $name = $Matches[1]
            if (-not $savedEnvironment.ContainsKey($name)) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
            [Environment]::SetEnvironmentVariable($name, $Matches[2], 'Process')
        }
    }
    $state = $null
    if (Test-Path -LiteralPath $stateFile) { $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json }
    if ($Rollback) {
        if (-not $state -or -not $state.previous) { throw 'No previous successful release is available.' }
        $target = $state.previous
    } else {
        if ($ImageTag -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$') { throw 'Supply a valid immutable Docker image tag.' }
        if ($ImagePrefix -notmatch '^[a-z0-9][a-z0-9./_-]+$') { throw 'Invalid Docker image prefix.' }
        $target = [PSCustomObject]@{ prefix=$ImagePrefix; tag=$ImageTag; provider=$(if ($Offline) { 'offline' } else { 'ollama' }) }
    }
    Write-Host "Deploying $($target.prefix) version $($target.tag) ($($target.provider))."
    try { Apply-Release $target ([bool]$Pull) }
    catch {
        $failure = $_
        if ($state -and $state.current) {
            Write-Warning 'Release verification failed. Restoring the last successful version.'
            try { Apply-Release $state.current $false }
            catch { throw 'Deployment and automatic recovery failed. Inspect Docker health and the staging release state.' }
        }
        throw $failure
    }
    $previous = $null
    if ($state -and $state.current) {
        if ($state.current.tag -eq $target.tag -and $state.current.prefix -eq $target.prefix -and $state.current.provider -eq $target.provider) { $previous = $state.previous }
        else { $previous = $state.current }
    }
    $next = @{ current=$target; previous=$previous; deployedAtUtc=[DateTime]::UtcNow.ToString('o') }
    $temporary = Join-Path $StateDirectory 'release.next.json'
    [IO.File]::WriteAllText($temporary, ($next | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $stateFile -Force
    Write-Host "Verified staging release: $($target.tag). Open http://127.0.0.1:4319"
} finally {
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    $lock.Dispose()
}
