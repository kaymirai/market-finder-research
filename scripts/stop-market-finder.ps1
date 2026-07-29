param(
  [int]$Port = 4174
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$HealthUrl = "http://127.0.0.1:$Port/market-finder/health"
$PidPath = Join-Path $Root ".tmp\market-finder-$Port.pid"

function Get-MarketFinderHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $HealthUrl -TimeoutSec 2
    if ([int]$response.StatusCode -ne 200) { return $null }
    $payload = $response.Content | ConvertFrom-Json
    if ($payload.service -ne 'market-finder' -or
      -not ($payload.pid -is [int] -or $payload.pid -is [long]) -or
      $payload.root -ne $Root) {
      return $null
    }
    return $payload
  } catch {
    return $null
  }
}

if (-not (Test-Path -LiteralPath $PidPath)) {
  Write-Host 'No Market Finder PID file exists; nothing to stop.'
  exit 0
}

$pidText = (Get-Content -LiteralPath $PidPath -Raw).Trim()
if ($pidText -notmatch '^\d+$') {
  throw "The Market Finder PID file is invalid: $PidPath"
}
$targetPid = [int]$pidText
$process = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if (-not $process) {
  Remove-Item -LiteralPath $PidPath -Force
  Write-Host "Removed stale Market Finder PID file for PID $targetPid."
  exit 0
}

if ($process.ProcessName -ne 'node') {
  throw "PID $targetPid does not identify the Market Finder Node server. Refusing to stop it."
}

$healthyServer = Get-MarketFinderHealth
if (-not $healthyServer -or [int]$healthyServer.pid -ne $targetPid) {
  throw "PID $targetPid is not serving the verified Market Finder health endpoint. Refusing to stop it."
}

Stop-Process -Id $targetPid -ErrorAction Stop
Remove-Item -LiteralPath $PidPath -Force
Write-Host "Stopped Market Finder PID $targetPid."
