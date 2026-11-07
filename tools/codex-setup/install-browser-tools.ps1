[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$SkipCuratedSkill
)
$ErrorActionPreference = 'Stop'
$setupDirectory = $PSScriptRoot
$profileDirectory = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$skillSource = Join-Path $setupDirectory 'browser-uat'
$skillTarget = Join-Path $profileDirectory 'skills\browser-uat'
$configPath = Join-Path $profileDirectory 'config.toml'
$codexCommand = Get-Command codex.exe -ErrorAction SilentlyContinue
if (-not $codexCommand) {
    $codexExecutable = Join-Path $env:LOCALAPPDATA 'Programs\OpenAI\Codex\bin\codex.exe'
    if (Test-Path -LiteralPath $codexExecutable) { $codexCommand = [pscustomobject]@{ Source = $codexExecutable } }
}
$npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
$pythonCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Python\bin\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe')
)
$pythonCommand = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $pythonCommand) {
    $foundPython = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($foundPython) { $pythonCommand = $foundPython.Source }
}
if (-not $codexCommand) { throw 'Codex CLI is missing from PATH.' }
if (-not $npxCommand) { throw 'Node.js/npm/npx are required.' }
if (-not (Test-Path -LiteralPath (Join-Path $skillSource 'SKILL.md'))) { throw 'Bundled browser-uat skill is missing.' }
$curatedInstaller = Join-Path $profileDirectory 'skills\.system\skill-installer\scripts\install-skill-from-github.py'
Write-Output "Codex: $($codexCommand.Source)"
Write-Output "Browser UAT destination: $skillTarget"
Write-Output "MCP config destination: $configPath"
Write-Output 'Playwright MCP: @playwright/mcp@0.0.84, Chrome, isolated, headless'
if ($CheckOnly) {
    Write-Output 'CHECK ONLY: no package, skill or configuration was installed.'
    return
}

# Download/resolve through normal npm before touching persistent configuration.
& $npxCommand.Source -y '@playwright/mcp@0.0.84' --help
if ($LASTEXITCODE -ne 0) { throw 'Playwright MCP package verification failed; configuration was not changed.' }

# Never overwrite an existing custom skill.
if (Test-Path -LiteralPath $skillTarget) {
    $existing = Join-Path $skillTarget 'SKILL.md'
    if (-not (Test-Path -LiteralPath $existing)) { throw 'Existing browser-uat directory has no SKILL.md; preserving it.' }
    if ((Get-FileHash -LiteralPath $existing).Hash -ne (Get-FileHash -LiteralPath (Join-Path $skillSource 'SKILL.md')).Hash) {
        throw 'A different browser-uat skill already exists; preserving it.'
    }
    Write-Output 'Browser UAT skill already matches.'
} else {
    New-Item -ItemType Directory -Path (Split-Path $skillTarget -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $skillSource -Destination $skillTarget -Recurse
    Write-Output 'Installed browser-uat skill.'
}

if (-not $SkipCuratedSkill) {
    $curatedTarget = Join-Path $profileDirectory 'skills\playwright'
    if (Test-Path -LiteralPath $curatedTarget) {
        Write-Output 'Existing curated Playwright skill preserved.'
    } else {
        if (-not $pythonCommand -or -not (Test-Path -LiteralPath $curatedInstaller)) {
            throw 'Python or the official skill-installer helper is unavailable. Use -SkipCuratedSkill to install only the requested Browser UAT skill and MCP.'
        }
        & $pythonCommand $curatedInstaller --repo openai/skills --path skills/.curated/playwright
        if ($LASTEXITCODE -ne 0) { throw 'Curated Playwright skill installation failed; Browser UAT remains installed.' }
    }
}

# Read only the selected MCP entry, never print unrelated configuration or secrets.
if (-not $pythonCommand) { throw 'Python 3.11+ is needed to inspect existing TOML safely.' }
$inspection = @'
import json,sys,tomllib
from pathlib import Path
p=Path(sys.argv[1])
c=tomllib.loads(p.read_text(encoding='utf-8')) if p.exists() else {}
entry=c.get('mcp_servers',{}).get('playwright')
expected=['/d','/c','npx.cmd','-y','@playwright/mcp@0.0.84','--browser','chrome','--isolated','--headless']
print('absent' if entry is None else 'matching' if entry.get('command')=='cmd.exe' and entry.get('args')==expected else 'different')
'@
$state = $inspection | & $pythonCommand - $configPath
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect MCP configuration.' }
if ($state -eq 'different') { throw 'A different Playwright MCP configuration already exists; preserving it.' }
if ($state -eq 'absent') {
    if (Test-Path -LiteralPath $configPath) {
        $backupPath = $configPath + '.before-playwright-' + (Get-Date -Format 'yyyyMMddHHmmss') + '.bak'
        Copy-Item -LiteralPath $configPath -Destination $backupPath
    }
    & $codexCommand.Source mcp add playwright -- cmd.exe /d /c npx.cmd -y '@playwright/mcp@0.0.84' --browser chrome --isolated --headless
    if ($LASTEXITCODE -ne 0) { throw 'Codex could not register MCP. Run this installer in a normal local PowerShell session.' }
}
$verified = $inspection | & $pythonCommand - $configPath
if ($LASTEXITCODE -ne 0 -or $verified -ne 'matching') { throw 'MCP configuration verification failed.' }
Write-Output 'PASS: Playwright MCP registered and Browser UAT skill present.'
Write-Output 'Restart Codex/MCP servers. The skill is available on the next turn after skill discovery; live browser/tool handshake still needs verification.'
