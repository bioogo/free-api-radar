# free-api-radar -- Windows Task Scheduler auto-refresh installer
# Usage (current user is enough):
#   pwsh scripts/install-scheduler.ps1 [-Minutes 1440] [-TaskName free-api-radar-refresh]
# Registers a scheduled task running `node scripts/fetch-free-apis.mjs refresh --stale-hours 0`,
# logging output to data/refresh.log.
# Uninstall: Unregister-ScheduledTask -TaskName free-api-radar-refresh
param(
  [int]$Minutes = 1440,
  [string]$TaskName = "free-api-radar-refresh"
)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$engine = Join-Path $root "scripts\fetch-free-apis.mjs"
if (-not (Test-Path $engine)) { throw "Engine not found: $engine" }
$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$engine`" refresh --stale-hours 0" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "free-api-radar: scheduled refresh of cross-platform free API index" -Force
Write-Host "Scheduled task registered: $TaskName (every $Minutes minutes)."
Write-Host "Uninstall: Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
