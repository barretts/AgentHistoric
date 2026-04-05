#!/usr/bin/env pwsh
# install.ps1 -- Remote bootstrap installer for Agent Historic (PowerShell).
# Usage:
#   iex "& { $(irm https://agenthistoric.com/install.ps1) } --all"
#   # or download and run:
#   pwsh -File .\install.ps1 --all

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
  $downloadUrl = "https://raw.githubusercontent.com/$repoSlug/$repoRef/$localInstaller"
  $targetScript = Join-Path $tmpDir $localInstaller

  Write-Host "==> agent-historic remote bootstrap (PowerShell)"
  Write-Host "    Repo: $repoSlug@$repoRef"
  Write-Host "    URL:  $downloadUrl"
  Write-Host ""

  Invoke-WebRequest -Uri $downloadUrl -OutFile $targetScript

  Write-Host "--> Running local installer..."
  & pwsh -NoProfile -ExecutionPolicy Bypass -File $targetScript @InstallerArgs
}
finally {
  if (Test-Path $tmpDir) {
    Remove-Item -Path $tmpDir -Recurse -Force
  }
}
