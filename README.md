# Agent Historic

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.19559517.svg)](https://doi.org/10.5281/zenodo.19559517)

Agent Historic publishes installable, generated persona-rule bundles for agentic coding tools.

This `main` branch is the stable static release branch. Source development now happens on `dev`.

## Install

```bash
node install.js --all
```

Remote bootstrap installers are served from GitHub Pages:

```bash
bash <(curl -fsSL https://agenthistoric.com/install.sh) --all
```

```powershell
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((New-Object Net.WebClient).DownloadString('https://agenthistoric.com/install.ps1'))) --all"
```

## Supported Targets

| Flag | Target |
|------|--------|
| `--claude` | Claude Code rules |
| `--cursor` | Cursor rules |
| `--windsurf` | Windsurf rules |
| `--codex` | Codex `AGENTS.md` and skills |
| `--crush` | Crush rules |
| `--opencode` | OpenCode rules |
| `--gemini` | Gemini CLI rules |
| `--all` | All targets |
| `--list` | List expected installed files without writing target rules |

If no target flags are provided, the installer auto-detects installed editors.

## Branches

- **`main`:** stable static release branch with `compiled/`, installers, hooks, public docs, and the static website.
- **`dev`:** canonical source branch with `prompt-system/`, renderers, tests, regression suites, and site source.

To modify personas, renderers, regression tests, or the website source, branch from `dev`.

## Included Release Artifacts

- `compiled/claude/rules/`
- `compiled/cursor/rules/`
- `compiled/windsurf/rules/`
- `compiled/codex/`
- `compiled/crush/rules/`
- `compiled/gemini/rules/`
- `hooks/`
- `site/`

## Website

The static website is deployed from the tracked `site/` directory on `main`.

Public install wrappers are also copied into:

- `site/install.sh`
- `site/install.ps1`
