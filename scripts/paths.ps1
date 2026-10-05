# Local source checkout and machine runtime have independent lifecycles.
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = if ($env:FABOPS_RUNTIME_DIR) {
    [IO.Path]::GetFullPath($env:FABOPS_RUNTIME_DIR)
} else {
    [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $projectRoot) 'fabops-runtime'))
}
$pythonEnvironment = Join-Path $projectRoot '.venv\Scripts\python.exe'
function Resolve-FabOpsTool([string]$Command, [string]$RelativePath) {
    $portable = Join-Path $runtimeRoot $RelativePath
    if (Test-Path -LiteralPath $portable) { return $portable }
    return (Get-Command $Command -ErrorAction Stop).Source
}
