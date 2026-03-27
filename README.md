# Philosopher Prompt System

A Mixture-of-Experts (MoE) prompt system for AI coding assistants. Six philosopher-inspired expert personas are routed by a single orchestrator, generating rules for **Claude**, **Cursor**, **Windsurf**, and **Codex** from one canonical source.

## Experts

| Expert | Role | Philosophy |
|--------|------|------------|
| **Peirce** | Implementation & Execution | Pragmatism, Cartesian Doubt, Stoic Discipline |
| **Descartes** | Architecture & System Design | Methodological Skepticism |
| **Popper** | QA & Falsification | Critical Rationalism |
| **Rogers** | UX & Accessibility | User-Centered Design |
| **Blackmore** | Automation & Patterns | Memetics, DRY Principle |
| **Dennett** | Ideation & Exploration | Cognitive Science, Design Space |

## Quick Start

```bash
# 1. Generate all target artifacts
npm run build:prompts

# 2. Install rules into your editors (auto-detects installed editors)
bash install.sh

# 3. Or install for specific editors
bash install.sh --cursor --windsurf

# 4. Use GPT-optimized sparse rules instead of rich
bash install.sh --gpt
```

## Layout

```
prompt-system/
  system.json              # Global runtime, constraints, logging
  router.json              # Routing heuristics, pipelines, disambiguation
  experts/*.json           # One file per expert persona

scripts/
  build-prompt-system.mjs  # Entry point: node scripts/build-prompt-system.mjs
  lib/
    prompt-system.mjs      # Loader, frontmatter, helpers
    build-prompt-system.mjs # Artifact generator + frontmatter factories
    render-rich.mjs        # Rich renderers (Claude-optimized)
    render-sparse.mjs      # Sparse renderers (GPT-optimized)
    render-codex.mjs       # Codex renderers (AGENTS.md + SKILL.md)

Generated output:
  dot-claude/rules/        # Rich rules for Claude Code
  dot-windsurf/rules/      # Rich rules for Windsurf
  dot-cursor/rules/        # Rich rules for Cursor (.mdc)
  dot-windsurf/rules/gpt/  # Sparse rules for GPT-family Windsurf routing
  dot-cursor/rules/gpt/    # Sparse rules for GPT-family Cursor routing
  dot-codex/               # Sparse AGENTS.md + skills/

regression/
  fixtures/cases.json      # Regression test cases
  output-schema.json       # Structured output contract
```

## Install

```bash
bash install.sh [options]
```

| Flag | Effect |
|------|--------|
| `--claude` | Install to `~/dot-claude/rules/` |
| `--cursor` | Install to `~/dot-cursor/rules/` |
| `--windsurf` | Install to `~/dot-windsurf/rules/` |
| `--codex` | Install to `~/dot-codex/` |
| `--all` | All editors |
| `--gpt` | Use sparse/GPT-optimized rules for Cursor and Windsurf |
| `--list` | Show installed files without modifying anything |
| *(no flags)* | Auto-detect installed editors |

### Post-Install IDE Configuration

**Cursor:** Open Settings > Rules for AI. Ensure `00-init` is the **first rule** with `alwaysApply: true`, followed by `01-router`. Expert rules are auto-attached by description match.

**Windsurf:** Open Customizations > Rules. `00-init.md` and `01-router.md` use `trigger: always` and load on every request. Expert rules use `trigger: model_decision` and are invoked automatically when relevant.

**Claude Code:** Rules auto-load from `~/dot-claude/rules/`. No configuration needed.

**Codex:** `AGENTS.md` and `skills/` auto-load from `~/dot-codex/`. No configuration needed.

## Rich vs Sparse

| Style | Targets | Description |
|-------|---------|-------------|
| **Rich** | Claude, Cursor, Windsurf | Full narrative, philosophy, voice. Includes a GPT adaptation preamble so GPT models can still follow them. |
| **Sparse** | Codex, `rules/gpt/` | Numbered steps, execution bindings, output contracts. Optimized for models that prefer explicit structure. |

Rich rules are the default. Use `bash install.sh --gpt` if you exclusively use GPT models and want the sparse variant.

## Generate Targets

```bash
npm run build:prompts
```

Regenerates all six output directories from the canonical JSON in `prompt-system/`.

## Testing

### Unit Tests

```bash
npm run test:unit
```

Covers artifact drift detection, routing expectations, and evaluator behavior.

### Regression Suites

```bash
npm run test:regressions:smoke   # Quick smoke suite
npm run test:regressions         # Full suite
```

Target filtering and model overrides:

```bash
node scripts/run-regressions.mjs --suite smoke --targets cursor
node scripts/run-regressions.mjs --suite full --targets codex
node scripts/run-regressions.mjs --suite smoke --cursor-model gpt-5.4-medium
```

### Scores

- **2:** Correct expert, correct structure, correct depth
- **1:** Mostly correct, minor drift
- **0:** Wrong expert or wrong structure

## Adding a New Expert

1. Create `prompt-system/experts/<expert-id>.json`.
2. Register the expert in `prompt-system/system.json`.
3. Run `npm run build:prompts`.
4. Add regression cases to `regression/fixtures/cases.json`.
5. Run `npm run test:unit` and the smoke suite.

## Adding a Regression Case

Add an object to `regression/fixtures/cases.json` with `id`, `category`, `name`, `targets`, `prompt`, `expectedPrimaryExpert`, `expectedSections`, `allowedHandoffs`, and `forbiddenBehaviors`. Include the case id in `suites.smoke` or `suites.full`.

## Verification Workflow

1. `npm run build:prompts`
2. `npm run test:unit`
3. `npm run test:regressions:smoke`
4. Inspect `.logs/regression-summary-*.md`
5. `npm run test:regressions`
6. Compare parity deltas and adjust the prompt layer if drift is systematic.

## License

MIT
