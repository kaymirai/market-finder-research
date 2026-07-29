param(
  [switch]$InstallStartup
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Launcher = Join-Path $Root 'start-market-finder.cmd'

function New-MarketFinderShortcut([string]$Directory) {
  New-Item -ItemType Directory -Path $Directory -Force | Out-Null
  $shortcutPath = Join-Path $Directory 'Market Finder.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $Launcher
  $shortcut.WorkingDirectory = $Root
  $shortcut.Description = 'Start Market Finder on this computer'
  $shortcut.Save()
  return $shortcutPath
}

$desktopPath = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = New-MarketFinderShortcut -Directory $desktopPath
Write-Host "Created desktop shortcut: $desktopShortcut"

if ($InstallStartup) {
  $startupPath = [Environment]::GetFolderPath('Startup')
  $startupShortcut = New-MarketFinderShortcut -Directory $startupPath
  Write-Host "Created startup shortcut: $startupShortcut"
}
