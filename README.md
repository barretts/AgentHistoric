# Agent Historic

> **Translating the world's most documented lives into high-fidelity agentic personas.**

Agent Historic is an open library of persona architectures for Large Language Models. It bridges primary historical records and modern prompt engineering by distilling the reasoning, rhetoric, and decision-making frameworks of well-attested figures into actionable system prompts.

A Mixture-of-Experts (MoE) routing layer assigns the right persona to every request, generating rules for **Claude**, **Cursor**, **Windsurf**, and **Codex** from one canonical source.

## Attested Personas

| Persona | Role | Grounding |
|---------|------|-----------|
| **Peirce** | Implementation & Execution | Pragmatism, Cartesian Doubt, Stoic Discipline |
| **Descartes** | Architecture & System Design | Methodological Skepticism |
| **Popper** | QA & Falsification | Critical Rationalism |
| **Rogers** | UX & Accessibility | User-Centered Design |
| **Blackmore** | Automation & Patterns | Memetics, DRY Principle |
| **Dennett** | Ideation & Exploration | Cognitive Science, Design Space |
| **Liskov** | Interfaces & Abstractions | Substitution Principle, Contract Design |
| **Dijkstra** | State & Formal Reasoning | Structured Programming, Invariants |
| **Knuth** | Performance & Scaling | Algorithmic Analysis, Literate Programming |
| **Shannon** | Context & Information Quality | Information Theory, Signal-to-Noise |
| **Simon** | Agent Orchestration | Bounded Rationality, Satisficing |

## Quick Start

```bash
# 1. Generate all target artifacts
npm run build:prompts

# 2. Install rules into your editors (auto-detects installed editors)
bash install.sh

# 3. Or install for specific editors
bash install.sh --cursor --windsurf

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
    render-codex.mjs       # Codex renderers (AGENTS.md + SKILL.md)

Generated output (compiled/):
  compiled/claude/rules/        # Rich rules for Claude Code
  compiled/windsurf/rules/      # Rich rules for Windsurf
  compiled/cursor/rules/        # Rich rules for Cursor (.mdc)
  compiled/codex/               # Codex AGENTS.md + skills/

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
| `--claude` | Install to `~/.claude/rules/` |
| `--cursor` | Install to `~/.cursor/rules/` |
| `--windsurf` | Install to `~/.windsurf/rules/` |
| `--codex` | Install to `~/.codex/` |
| `--all` | All editors |
| `--list` | Show installed files without modifying anything |
| *(no flags)* | Auto-detect installed editors |

### Post-Install IDE Configuration

**Cursor:** Open Settings > Rules for AI. `00-init.mdc` and `01-router.mdc` must have `alwaysApply: true`. Expert rules are auto-attached by description match.

**Windsurf:** Open Customizations > Rules. `00-init.md` and `01-router.md` use `trigger: always` and load on every request. Expert rules use `trigger: model_decision` and are invoked automatically when relevant.

**Claude Code:** Rules auto-load from `~/.claude/rules/`. No configuration needed.

**Codex:** `AGENTS.md` and `skills/` auto-load from `~/.codex/`. No configuration needed.

## Generate Targets

```bash
npm run build:prompts
```

Regenerates all output directories from the canonical JSON in `prompt-system/`.

## Testing

### Unit Tests

```bash
npm run test:unit
```

32 tests across 3 test files:

| File | Tests | Scope |
|------|:-----:|-------|
| `prompt-smoke.test.mjs` | 12 | Frontmatter validity, required sections, expert cross-references, guardrail completeness, token budgets |
| `prompt-system.test.mjs` | 4 | Section resolution, generated artifact sync |
| `regression.test.mjs` | 16 | Routing, evaluator, behavioral assertions |

### Behavioral Assertions

The regression evaluator includes four code-based graders that detect behavioral anti-patterns in LLM output:

- **`assertNoGoldPlating`** — flags extra sections beyond the output contract
- **`assertConcision`** — flags responses exceeding a character budget
- **`assertNoFalseClaims`** — flags success claims without execution evidence
- **`assertDiagnosticDiscipline`** — flags fix proposals without prior diagnosis

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

- **2:** Correct expert, correct structure, no behavioral findings
- **1:** Correct expert, minor format drift or behavioral findings
- **0:** Wrong expert or wrong structure

## Adding a New Expert

1. Create `prompt-system/experts/<expert-id>.json` with a `behavioralGuardrails` array (at least one Failure Mode → Rule → Anti-Over-Correction triple).
2. Register the expert in `prompt-system/system.json`.
3. Run `npm run build:prompts`.
4. Add regression cases to `regression/fixtures/cases.json`.
5. Run `npm run test:unit` and the smoke suite.

## Adding a Regression Case

Add an object to `regression/fixtures/cases.json` with `id`, `category`, `name`, `targets`, `prompt`, `expectedPrimaryExpert`, `expectedSections`, `allowedHandoffs`, and `forbiddenBehaviors`. Optionally add `behavioralAssertions` (e.g., `["noGoldPlating", "concision"]`). Include the case id in `suites.smoke` or `suites.full`.

## Verification Workflow

1. `npm run build:prompts`
2. `npm run test:unit`
3. `npm run test:regressions:smoke`
4. Inspect `.logs/regression-summary-*.md`
5. `npm run test:regressions`
6. Compare parity deltas and adjust the prompt layer if drift is systematic.

## License

MIT
