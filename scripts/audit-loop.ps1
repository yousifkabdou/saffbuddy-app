# Runs report-only audit passes, one fresh Claude session per checklist area.
# Fresh sessions keep each context small instead of one huge session.
# Usage:  powershell -File scripts\audit-loop.ps1 -MaxRuns 15
param([int]$MaxRuns = 15)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

# The CLI ships inside the VS Code extension; use the newest installed version.
$claude = Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Directory -Filter 'anthropic.claude-code-*' |
  Sort-Object { [version]($_.Name -replace '^anthropic\.claude-code-([\d.]+).*$', '$1') } -Descending |
  ForEach-Object { Join-Path $_.FullName 'resources\native-binary\claude.exe' } |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $claude) { throw 'claude.exe not found' }

$prompt = Get-Content 'docs\audit\prompt.md' -Raw
$log = 'docs\audit\runs.log'

# Read-only tools, plus writes limited to the two audit files and the three check commands.
$tools = @(
  'Read', 'Glob', 'Grep',
  'Edit(docs/audit/findings.md)', 'Edit(docs/audit/checklist.md)',
  'Bash(npm run typecheck)', 'Bash(npm run lint)', 'Bash(npm test)'
)

for ($i = 1; $i -le $MaxRuns; $i++) {
  if (-not (Select-String -Path 'docs\audit\checklist.md' -Pattern '^- \[ \]' -Quiet)) {
    Write-Host 'Checklist complete.'; break
  }
  Write-Host "Run $i starting $(Get-Date -Format 'HH:mm:ss')..."
  $start = Get-Date
  $raw = & $claude -p $prompt --output-format json --allowedTools $tools 2>&1 | Out-String
  $mins = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)

  try { $r = $raw | ConvertFrom-Json } catch { $r = $null }
  if (-not $r -or $r.is_error) {
    # Most likely a usage limit; stop rather than retry.
    Add-Content $log "$(Get-Date -Format s) run $i FAILED after $mins min: $($raw.Trim() | Select-Object -First 1)"
    Write-Host "Run $i failed; stopping. See $log"; break
  }
  $u = $r.usage
  $line = "$(Get-Date -Format s) run $i ok, $mins min, turns=$($r.num_turns), " +
    "in=$($u.input_tokens) cache_read=$($u.cache_read_input_tokens) cache_write=$($u.cache_creation_input_tokens) " +
    "out=$($u.output_tokens), api-equiv=`$$([math]::Round($r.total_cost_usd, 2)) :: $($r.result.Trim())"
  Add-Content $log $line
  Write-Host $line
}
