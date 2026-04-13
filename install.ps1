#!/usr/bin/env pwsh
# install.ps1 -- Remote bootstrap installer for Agent Historic (PowerShell).
# Usage:
#   & ([ScriptBlock]::Create((New-Object Net.WebClient).DownloadString('https://agenthistoric.com/install.ps1'))) --all
#   # or download and run:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 --all

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$InstallerArgs
)

$ErrorActionPreference = "Stop"

$repoSlug = if ($env:AGENT_HISTORIC_REPO) { $env:AGENT_HISTORIC_REPO } else { "barretts/AgentHistoric" }
$repoRef = if ($env:AGENT_HISTORIC_REF) { $env:AGENT_HISTORIC_REF } else { "main" }
$localInstaller = "install-local.ps1"

$tmpDir = Join-Path ([IO.Path]::GetTempPath()) ("agent-historic-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

try {
  $archiveUrl = "https://github.com/$repoSlug/archive/refs/heads/$repoRef.zip"
  $archivePath = Join-Path $tmpDir "agent-historic.zip"

  Write-Host "==> agent-historic remote bootstrap (PowerShell)"
  Write-Host "    Repo: $repoSlug@$repoRef"
  Write-Host "    URL:  $archiveUrl"
  Write-Host ""

  Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath
  Expand-Archive -Path $archivePath -DestinationPath $tmpDir -Force

  $repoDir = Get-ChildItem -Path $tmpDir -Directory | Select-Object -First 1
  if (-not $repoDir) {
    throw "ERROR: Unable to locate extracted repository directory."
  }

  $targetScript = Join-Path $repoDir.FullName $localInstaller
  if (-not (Test-Path $targetScript)) {
    throw "ERROR: $localInstaller not found in extracted repository."
  }

  Write-Host "--> Running local installer..."
  & $targetScript @InstallerArgs
}
finally {
  if (Test-Path $tmpDir) {
    Remove-Item -Path $tmpDir -Recurse -Force
  }
}
