# Migration Map

This file maps the original source prompts into the canonical spec and generated targets.

## Source To Canonical

- `claude-prompts/00-init.md`
  - `prompt-system/philosopher-system.json -> globalRuntime`
- `claude-prompts/01-router.md`
  - `prompt-system/philosopher-system.json -> router`
- `claude-prompts/expert-architect-descartes.md`
  - `prompt-system/philosopher-system.json -> experts[expert-architect-descartes]`
- `claude-prompts/expert-engineer-quinn.md`
  - `prompt-system/philosopher-system.json -> experts[expert-engineer-quinn]`
- `claude-prompts/expert-manager-blackmore.md`
  - `prompt-system/philosopher-system.json -> experts[expert-manager-blackmore]`
- `claude-prompts/expert-qa-popper.md`
  - `prompt-system/philosopher-system.json -> experts[expert-qa-popper]`
- `claude-prompts/expert-ux-rogers.md`
  - `prompt-system/philosopher-system.json -> experts[expert-ux-rogers]`
- `claude-prompts/expert-visionary-dennett.md`
  - `prompt-system/philosopher-system.json -> experts[expert-visionary-dennett]`
- `notes.txt`
  - canonical execution binding rules
  - deterministic routing tie-break
  - regression expectations
  - parity/scoring guidance

## Canonical To Cursor

- `prompt-system/philosopher-system.json -> .cursor/rules/00-init.mdc`
- `prompt-system/philosopher-system.json -> .cursor/rules/01-router.mdc`
- `prompt-system/philosopher-system.json -> .cursor/rules/expert-*.mdc`

## Canonical To Codex

- `prompt-system/philosopher-system.json -> AGENTS.md`
- `prompt-system/philosopher-system.json -> skills/*/SKILL.md`

## Canonical To Regression

- `prompt-system/philosopher-system.json`
  - provides expert ids and structural expectations used by the generated targets
- `notes.txt`
  - provides regression prompts, failure signals, and 0/1/2 scoring intent
- `regression/fixtures/cases.json`
  - machine-readable regression suite
- `regression/output-schema.json`
  - structured output contract for Codex runs

## Operational Rule

Do not hand-edit generated targets unless you also update the generator or canonical source. The durable edit locations are:

- `prompt-system/philosopher-system.json`
- `scripts/build-prompt-system.mjs`
- `regression/fixtures/cases.json`
- `scripts/run-regressions.mjs`
