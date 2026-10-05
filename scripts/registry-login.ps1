param(
    [Parameter(Mandatory=$true)][string]$RegistryUser,
    [Parameter(Mandatory=$true)][string]$Repository
)
$ErrorActionPreference = 'Stop'
if (-not $env:GHCR_TOKEN) { throw 'The job registry token is missing.' }
if ($RegistryUser -notmatch '^[A-Za-z0-9][A-Za-z0-9-]*$') { throw 'Invalid registry username.' }
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Invalid repository name.' }

# Check package access without logging credentials or registry bearer tokens.
$owner, $repoName = $Repository.Split('/')
$headers = @{ Authorization="Bearer $env:GHCR_TOKEN"; Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28' }
foreach ($image in @('domain-api', 'gateway')) {
    $packageName = [Uri]::EscapeDataString("$repoName/$image")
    $package = Invoke-RestMethod -Uri "https://api.github.com/users/$owner/packages/container/$packageName" -Headers $headers
    Write-Host "Package $($package.name): $($package.visibility), source $($package.repository.full_name)"
    if ($package.name -ne "$repoName/$image") { throw "Unexpected package metadata for $image." }
}

# Send ASCII token bytes directly to stdin, independent of PowerShell's pipeline encoding.
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = (Get-Command docker.exe -ErrorAction Stop).Source
$start.Arguments = "login ghcr.io -u $RegistryUser --password-stdin"
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardInput = $true
$process = New-Object Diagnostics.Process
$process.StartInfo = $start
try {
    [void]$process.Start()
    $bytes = [Text.Encoding]::ASCII.GetBytes($env:GHCR_TOKEN)
    $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
    $process.StandardInput.Close()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'GHCR authentication failed.' }
} finally { $process.Dispose() }
