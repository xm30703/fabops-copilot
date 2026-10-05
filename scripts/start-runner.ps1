param([string]$RunnerDirectory)
$ErrorActionPreference = 'Stop'
if (-not $RunnerDirectory) { $RunnerDirectory = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) '..\work\actions-runner' }
$RunnerDirectory = [IO.Path]::GetFullPath($RunnerDirectory)
$executable = Join-Path $RunnerDirectory 'bin\Runner.Listener.exe'
if (-not (Test-Path -LiteralPath (Join-Path $RunnerDirectory '.runner'))) { throw 'Register this runner with GitHub before starting it.' }
$existing = Get-CimInstance Win32_Process -Filter "Name='Runner.Listener.exe'" | Where-Object { $_.ExecutablePath -eq $executable }
if ($existing) { Write-Host 'The project runner is already running.'; exit 0 }
$listener = Start-Process -FilePath $executable -ArgumentList 'run' -WorkingDirectory $RunnerDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $RunnerDirectory 'listener.log') -RedirectStandardError (Join-Path $RunnerDirectory 'listener-error.log')
Write-Host "Started local CD runner (PID $($listener.Id)). Keep Docker Desktop and Ollama running."
