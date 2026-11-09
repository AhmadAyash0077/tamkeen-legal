$ErrorActionPreference = 'Stop'
$bridgePath = Join-Path $PSScriptRoot 'bridge.mjs'
& claude-mem start | Out-Null
try {
  $health = Invoke-RestMethod 'http://127.0.0.1:37721/health' -TimeoutSec 3
  if ($health.service -eq 'tamkeen-memory-bridge') { exit 0 }
} catch {}
$nodePath = (Get-Command node.exe).Source
Start-Process -FilePath $nodePath -ArgumentList ('"' + $bridgePath + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
