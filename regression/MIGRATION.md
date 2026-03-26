# Migration Map

This file maps the original source prompts into the canonical spec and generated targets.

## Source To Canonical

- `claude-prompts/00-init.md`
  - `prompt-system/system.json -> globalRuntime`
- `claude-prompts/01-router.md`
  - `prompt-system/router.json`
- `claude-prompts/expert-architect-descartes.md`
  - `prompt-system/experts/expert-architect-descartes.json`
- `claude-prompts/expert-engineer-quinn.md`
  - `prompt-system/experts/expert-engineer-peirce.json`
- `claude-prompts/expert-manager-blackmore.md`
  - `prompt-system/experts/expert-manager-blackmore.json`
- `claude-prompts/expert-qa-popper.md`
  - `prompt-system/experts/expert-qa-popper.json`
- `claude-prompts/expert-ux-rogers.md`
  - `prompt-system/experts/expert-ux-rogers.json`
- `claude-prompts/expert-visionary-dennett.md`
  - `prompt-system/experts/expert-visionary-dennett.json`
- `notes.txt`
  - canonical execution binding rules
  - deterministic routing tie-break
  - regression expectations
  - parity/scoring guidance

## Canonical To Cursor

- `prompt-system/ -> dot-cursor/rules/00-init.mdc`
- `prompt-system/ -> dot-cursor/rules/01-router.mdc`
- `prompt-system/ -> dot-cursor/rules/expert-*.mdc`

## Canonical To Codex

- `prompt-system/ -> dot-codex/AGENTS.md`
- `prompt-system/ -> dot-codex/skills/*/SKILL.md`

## Canonical To Regression

- `prompt-system/system.json`, `prompt-system/router.json`, `prompt-system/experts/*.json`
  - provide expert ids and structural expectations used by the generated targets
- `notes.txt`
  - provides regression prompts, failure signals, and 0/1/2 scoring intent
- `regression/fixtures/cases.json`
  - machine-readable regression suite
- `regression/output-schema.json`
  - structured output contract for Codex runs

## Operational Rule

Do not hand-edit generated targets unless you also update the generator or canonical source. The durable edit locations are:

- `prompt-system/system.json`, `prompt-system/router.json`, `prompt-system/experts/*.json`
- `scripts/build-prompt-system.mjs`
- `regression/fixtures/cases.json`
- `scripts/run-regressions.mjs`
