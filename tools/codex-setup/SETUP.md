# Playwright MCP and Browser UAT

This bundle is prepared, not globally installed by the restricted Codex session. The actual registration attempt failed with access denied when writing the user `.codex/config.toml`; no existing MCP configuration was replaced.

Validation performed here: PowerShell parser and skill YAML metadata PASS. Execution of the PowerShell file is blocked by this session's execution policy, and the official Python skill validator cannot run because PyYAML is not installed. A final read-only check confirmed both `playwright` MCP registration and global `browser-uat` installation are still absent.

Run from workspace in a normal Windows PowerShell session:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex-setup\install-browser-tools.ps1
```

This process-only ExecutionPolicy option does not alter the machine's persistent execution policy. The installer verifies the Microsoft `@playwright/mcp@0.0.84` package, installs the bundled `browser-uat` skill and OpenAI's curated `playwright` skill through the official helper, backs up the private config alongside itself, registers MCP through the Codex CLI, and checks the selected configuration. Existing different skills/server entries are preserved, not overwritten.

Use `-CheckOnly` for prerequisites and planned destinations without mutation; `-SkipCuratedSkill` omits the optional curated CLI skill. No project application dependency or lockfile is changed. Keep generated browser state in ignored `verification/artifacts/`.

After completion, restart Codex/MCP servers and start a new turn. Invoke `$browser-uat` and verify that Playwright browser tools are actually connected before recording browser PASS.

Sources: [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp), [OpenAI curated Playwright skill](https://github.com/openai/skills/tree/main/skills/.curated/playwright), [Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp).
