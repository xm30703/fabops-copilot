param(
    [string]$Owner = 'xm30703',
    [string]$Repository = 'fabops-copilot',
    [string]$GitHubCli,
    [string]$RunnerDirectory,
    [switch]$EnableLocalCd
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'paths.ps1')
if ($Owner -notmatch '^[a-zA-Z0-9-]+$' -or $Repository -notmatch '^[a-zA-Z0-9_.-]+$') { throw 'Invalid GitHub owner or repository name.' }
if (-not $GitHubCli) {
    $portable = Join-Path $runtimeRoot 'tools\gh\bin\gh.exe'
    if (Test-Path -LiteralPath $portable) {
        $GitHubCli = $portable
        $env:GH_CONFIG_DIR = Join-Path $runtimeRoot 'gh-config'
    } else { $GitHubCli = (Get-Command gh.exe -ErrorAction Stop).Source }
}
function Invoke-Gh {
    param([string[]]$Arguments)
    & $GitHubCli @Arguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub CLI failed: $($Arguments[0])." }
}
function Invoke-Git {
    param([string[]]$Arguments)
    & git -C $projectRoot @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $($Arguments[0])." }
}
$login = Invoke-Gh @('api','user','--jq','.login')
if ($login -ne $Owner) { throw "GitHub CLI is logged in as $login; supply its matching -Owner explicitly." }
if (Invoke-Git @('status','--porcelain')) { throw 'Commit the reviewed local changes before publishing.' }
$fullName = "$Owner/$Repository"
$remoteUrl = "https://github.com/$fullName.git"
$helper = '!'
if ($env:GH_CONFIG_DIR) { $helper += "GH_CONFIG_DIR='" + $env:GH_CONFIG_DIR.Replace('\','/').Replace("'", "'\''") + "' " }
$helper += "'" + $GitHubCli.Replace('\','/').Replace("'", "'\''") + "' auth git-credential"
Invoke-Git @('config','--local','--replace-all','credential.helper',$helper)
# PowerShell 5.1 drops empty native arguments. Write the Git helper reset directly,
# before the encoded helper entry, so inherited helpers cannot open another login.
$gitConfig = Join-Path $projectRoot '.git\config'
$existingConfig = [IO.File]::ReadAllText($gitConfig)
[IO.File]::WriteAllText($gitConfig, "[credential]`n`thelper =`n" + $existingConfig, [Text.UTF8Encoding]::new($false))
if ((Invoke-Git @('remote')) -contains 'origin') {
    if ((Invoke-Git @('remote','get-url','origin')) -ne $remoteUrl) { throw 'Existing origin differs; no remote was changed.' }
} else {
    # Inspect first; a missing repository is created privately, never replacing an existing one.
    $ErrorActionPreference = 'Continue'
    & $GitHubCli repo view $fullName --json nameWithOwner --jq .nameWithOwner 2>$null | Out-Null
    $exists = $LASTEXITCODE -eq 0
    $ErrorActionPreference = 'Stop'
    if (-not $exists) { Invoke-Gh @('repo','create',$fullName,'--private','--description','Synthetic manufacturing incident copilot: Angular, .NET, MCP, Ollama RAG and local CI/CD') }
    Invoke-Git @('remote','add','origin',$remoteUrl)
}
if ($EnableLocalCd) {
    if (-not $RunnerDirectory) { $RunnerDirectory = Join-Path $runtimeRoot 'actions-runner' }
    $RunnerDirectory = [IO.Path]::GetFullPath($RunnerDirectory)
    $runnerConfig = Join-Path $RunnerDirectory '.runner'
    if (-not (Test-Path -LiteralPath (Join-Path $RunnerDirectory 'config.cmd'))) { throw 'Download and verify the official Windows Actions runner first.' }
    if (Test-Path -LiteralPath $runnerConfig) {
        $registered = Get-Content -LiteralPath $runnerConfig -Raw | ConvertFrom-Json
        if ($registered.gitHubUrl.TrimEnd('/') -ne "https://github.com/$fullName") { throw 'Runner is registered to another repository.' }
    } else {
        $registration = Invoke-Gh @('api','--method','POST',"repos/$fullName/actions/runners/registration-token",'--jq','.token')
        try {
            Push-Location $RunnerDirectory
            & .\config.cmd --unattended --url "https://github.com/$fullName" --token $registration --name "$env:COMPUTERNAME-fabops" --labels fabops-local --work _work
            if ($LASTEXITCODE -ne 0) { throw 'Runner registration failed.' }
        } finally { Pop-Location; $registration = $null }
    }
    Invoke-Gh @('api','--method','PUT',"repos/$fullName/environments/local-staging",'--silent')
    Invoke-Gh @('variable','set','FABOPS_RUNTIME_DIR','--repo',$fullName,'--body',$runtimeRoot)
    Invoke-Gh @('variable','set','FABOPS_STATE_DIR','--repo',$fullName,'--body',(Join-Path $runtimeRoot 'staging'))
    & (Join-Path $PSScriptRoot 'start-runner.ps1') -RunnerDirectory $RunnerDirectory
    Invoke-Gh @('variable','set','LOCAL_CD_ENABLED','--repo',$fullName,'--body','true')
}
Invoke-Git @('push','--set-upstream','origin','main')
Write-Host "Published https://github.com/$fullName. Check its Actions tab for actual CI/CD results."
