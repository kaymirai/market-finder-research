param(
  [switch]$NoBrowser,
  [int]$Port = 4174,
  [string]$BrowserPath = ''
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$HealthUrl = "http://127.0.0.1:$Port/market-finder/health"
$PidPath = Join-Path $Root ".tmp\market-finder-$Port.pid"
$ServerScript = Join-Path $Root 'market-finder\scripts\static-server.mjs'
$Deadline = (Get-Date).AddSeconds(30)

function Get-MarketFinderHealth {
  $remainingMilliseconds = [Math]::Floor(($Deadline - (Get-Date)).TotalMilliseconds)
  if ($remainingMilliseconds -le 0) { return $null }

  $response = $null
  $reader = $null
  try {
    $request = [System.Net.WebRequest]::Create($HealthUrl)
    $request.Timeout = [Math]::Min([int]$remainingMilliseconds, 2000)
    $request.ReadWriteTimeout = [Math]::Min([int]$remainingMilliseconds, 2000)
    $response = $request.GetResponse()
    if ([int]$response.StatusCode -ne 200) { return $null }
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $payload = $reader.ReadToEnd() | ConvertFrom-Json
    if ($payload.service -ne 'market-finder' -or
      -not ($payload.pid -is [int] -or $payload.pid -is [long]) -or
      $payload.root -ne $Root) {
      return $null
    }
    return $payload
  } catch {
    return $null
  } finally {
    if ($reader) { $reader.Dispose() }
    if ($response) { $response.Dispose() }
  }
}

function Get-PortListenerPid {
  $portPattern = [regex]::Escape([string]$Port)
  $listener = & netstat -ano -p TCP | Where-Object {
    $_ -match "^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]|::):$portPattern\s+.*\sLISTENING\s+\d+\s*$"
  } | Select-Object -First 1
  if (-not $listener) { return $null }
  $match = [regex]::Match($listener, '(\d+)\s*$')
  if (-not $match.Success) { return $null }
  return [int]$match.Groups[1].Value
}

function Write-MarketFinderPid([int]$ProcessId) {
  $pidDirectory = Split-Path -Parent $PidPath
  New-Item -ItemType Directory -Path $pidDirectory -Force | Out-Null
  Set-Content -LiteralPath $PidPath -Value $ProcessId -Encoding Ascii
}

function Get-ChromePath {
  if ($BrowserPath) {
    if (-not (Test-Path -LiteralPath $BrowserPath)) {
      throw "The requested browser executable was not found: $BrowserPath"
    }
    return (Resolve-Path -LiteralPath $BrowserPath).Path
  }
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

function Open-MarketFinder {
  if ($NoBrowser) { return }
  $url = "http://127.0.0.1:$Port/market-finder/"
  $chromePath = Get-ChromePath
  if ($chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $url | Out-Null
  } else {
    Start-Process $url | Out-Null
  }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw 'Node.js was not found. Could not start the Market Finder local server.'
}

$healthyServer = Get-MarketFinderHealth
if ($healthyServer) {
  Write-MarketFinderPid -ProcessId ([int]$healthyServer.pid)
  Write-Host "Market Finder is already running; reusing PID $($healthyServer.pid): $HealthUrl"
  Open-MarketFinder
  exit 0
}

$listenerPid = Get-PortListenerPid
if ($listenerPid) {
  throw "Port $Port is already used by PID $listenerPid, but it is not this Market Finder server. Refusing to start."
}

$process = Start-Process -FilePath $node.Source -ArgumentList @($ServerScript, $Root, "$Port") -WorkingDirectory $Root -WindowStyle Hidden -PassThru
$started = $false
try {
  while ((Get-Date) -lt $Deadline) {
    $remainingMilliseconds = [Math]::Floor(($Deadline - (Get-Date)).TotalMilliseconds)
    if ($remainingMilliseconds -le 0) { break }
    Start-Sleep -Milliseconds ([Math]::Min(500, [Math]::Max(1, [int]$remainingMilliseconds)))
    $healthyServer = Get-MarketFinderHealth
    if ($healthyServer -and [int]$healthyServer.pid -eq $process.Id) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw 'Timed out while waiting for Market Finder to start.'
  }

  Write-MarketFinderPid -ProcessId $process.Id
} catch {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  throw
}

Open-MarketFinder

Write-Host "Market Finder is ready: $HealthUrl (PID $($process.Id))"
