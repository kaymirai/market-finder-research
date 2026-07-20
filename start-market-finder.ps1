param(
  [switch]$NoResearch,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPidPath = Join-Path $Root '.tmp\market-finder-server.pid'
$Port = 4173
$AppPath = "http://127.0.0.1:$Port/market-finder/"
$AppUrl = "${AppPath}?v=$(Get-Date -Format 'yyyyMMddHHmmss')"
$ResearchUrls = @(
  'https://erank.com/tools/keyword-tool',
  'https://app.everbee.io/product-analytics',
  'https://www.etsy.com/'
)

function Test-MarketFinderServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $AppPath -TimeoutSec 2
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-MarketFinderServer {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw 'Node.js was not found. Could not start the Market Finder local server.'
  }

  $serverScript = Join-Path $Root 'market-finder\scripts\static-server.mjs'

  $serverProcess = @{
    FilePath = $node.Source
    ArgumentList = @($serverScript, $Root, "$Port")
    WorkingDirectory = $Root
    WindowStyle = 'Hidden'
    PassThru = $true
  }

  $process = Start-Process @serverProcess
  Set-Content -LiteralPath $ServerPidPath -Value $process.Id -Encoding ASCII

  for ($index = 0; $index -lt 20; $index += 1) {
    Start-Sleep -Milliseconds 300
    if (Test-MarketFinderServer) { return }
  }

  throw 'Timed out while waiting for Market Finder to start.'
}

function Get-ChromePath {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }

  return $null
}

if (-not (Test-MarketFinderServer)) {
  Start-MarketFinderServer
}

$urls = @($AppUrl)
if (-not $NoResearch) {
  $urls += $ResearchUrls
}

if (-not $NoBrowser) {
  $chromePath = Get-ChromePath
  if ($chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $urls | Out-Null
  } else {
    foreach ($url in $urls) {
      Start-Process $url | Out-Null
    }
  }
}

Write-Host "Market Finder is ready: $AppUrl"
if (-not $NoResearch -and -not $NoBrowser) {
  Write-Host 'Research pages opened: eRank, EverBee, Etsy'
}
