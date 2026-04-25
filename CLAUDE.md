# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

[rules:loaded init router experts@12]

## Project Overview

Agent Historic is an open library of persona architectures for Large Language Models that implements a Mixture-of-Experts (MoE) routing layer. It bridges primary historical records and modern prompt engineering by distilling the reasoning, rhetoric, and decision-making frameworks of well-attested figures into actionable system prompts.

The system generates rules for **Claude**, **Cursor**, **Windsurf**, and **Codex** from one canonical source located in `prompt-system/` (JSON format).

## Key Commands

### Build and Generation
- `npm run build:prompts` - Generate all target artifacts from canonical JSON source
- `npm run build:prompts:release` - Generate artifacts in release mode (no debug)
- `npm run build:prompts:debug` - Generate artifacts in debug mode

### Testing
- `npm run test:unit` - Run 136 unit tests across 3 test files
- `npm run test:regressions:smoke` - Quick smoke regression suite (R1, R2, Q1, P1)
- `npm run test:regressions` - Full regression suite
- `node scripts/run-regressions.mjs --suite <suite>` - Run specific regression suites:
  - `negative` (NE1-NE4): negative routing guards
  - `diversity` (RB1-RB9): expert variety
  - `twopass` (TP1-TP3): progressive routing
  - `council` (CC1-CC4): deliberation council
  - `verification` (AV1-AV3): adversarial verification
  - `model-parity` (13 cases): cross-model routing agreement

### Installation
- `bash install-local.sh` - Install rules to auto-detected editors
- `bash install-local.sh --cursor --windsurf` - Install to specific editors
- `bash install-local.sh --all` - Install to all editors

## Code Architecture

### Canonical Source (`prompt-system/`)
- `system.json` - Global runtime constraints, logging rules, uncertainty rules, foundational constraints
- `router.json` - MoE routing heuristics, pipelines, disambiguation, negative examples
- `experts/*.json` - 11 expert personas with behavioral guardrails and output contracts
- `modifiers/*.json` - Voice and style overlays

### Build System (`scripts/lib/`)
- `build-prompt-system.mjs` - Artifact generator with frontmatter factories
- `render-rich.mjs` - Rich renderers for Claude/Windsurf/Cursor
- `render-codex.mjs` - Codex renderers (AGENTS.md + skills)
- `prompt-system.mjs` - Loader, frontmatter, helpers

### Generated Output (`compiled/`)
- `compiled/claude/rules/` - Rich rules for Claude Code
- `compiled/windsurf/rules/` - Rich rules for Windsurf  
- `compiled/cursor/rules/` - Rich rules for Cursor (.mdc)
- `compiled/codex/` - Codex AGENTS.md + skills/

### Testing Infrastructure
- `regression/fixtures/cases.json` - 50+ regression test cases with expected experts and behaviors
- `scripts/lib/prompt-smoke.test.mjs` - 75 frontmatter and protocol tests
- `scripts/lib/regression.test.mjs` - 47 regression and behavioral assertion tests
- `scripts/lib/prompt-system.test.mjs` - 14 variable substitution and artifact sync tests
- `scripts/run-regressions.mjs` - Regression test runner with multiple model support

## Key Concepts

### Constraint Hierarchy
Four layers that restrict but never expand constraints:
1. **Global Runtime** (`system.json`) - All experts, all contexts
2. **Router** (`router.json`) - Routing decisions and pipeline sequencing  
3. **Modifier** (`modifiers/*.json`) - Voice and style overlays
4. **Expert Persona** (`experts/*.json`) - Active expert only

### Expert Personas (11 total)
- **Peirce** - Implementation & Execution (pragmatism)
- **Descartes** - Architecture & System Design (methodological skepticism)
- **Popper** - QA & Falsification (critical rationalism)
- **Rogers** - UX & Accessibility (user-centered design)
- **Blackmore** - Automation & Patterns (memetics, DRY)
- **Dennett** - Ideation & Exploration (cognitive science)
- **Liskov** - Interfaces & Abstractions (substitution principle)
- **Dijkstra** - State & Formal Reasoning (structured programming)
- **Knuth** - Performance & Scaling (algorithmic analysis)
- **Shannon** - Context & Information Quality (information theory)
- **Simon** - Agent Orchestration (bounded rationality)

### Routing Evolution Features
1. **Negative Routing** - Anti-pattern guards preventing mis-routes
2. **Diversified Heuristics** - 18+ granular sub-domains vs 13 broad domains
3. **Two-Pass Routing** - Broad domain → specific expert refinement
4. **Deliberation Council** - Multi-expert pipeline for ambiguous tasks
5. **Adversarial Verification** - Popper verifies Peirce's implementations

### Behavioral Assertions
Five code-based graders detect anti-patterns:
- `assertNoGoldPlating` - flags extra sections beyond output contract
- `assertConcision` - flags responses exceeding character budget
- `assertNoFalseClaims` - flags success claims without execution evidence
- `assertDiagnosticDiscipline` - flags fix proposals without diagnosis
- `assertRoutingFirst` - flags preamble before routing decision

## Development Workflow

1. **Make changes** to canonical JSON in `prompt-system/`
2. **Rebuild artifacts**: `npm run build:prompts`
3. **Run unit tests**: `npm run test:unit`
4. **Run smoke tests**: `npm run test:regressions:smoke`
5. **Inspect logs**: Check `.logs/regression-summary-*.md`
6. **Run full suite**: `npm run test:regressions` if needed

## Adding New Experts

1. Create `prompt-system/experts/<expert-id>.json` with `behavioralGuardrails` array
2. Register expert in `prompt-system/system.json`
3. Run `npm run build:prompts`
4. Add regression cases to `regression/fixtures/cases.json`
5. Run `npm run test:unit` and smoke suite

## Adding Regression Cases

Add to `regression/fixtures/cases.json` with:
- `id`, `category`, `name`, `targets`
- `prompt`, `expectedPrimaryExpert`, `expectedSections`
- `allowedHandoffs`, `forbiddenBehaviors`
- Optional: `behavioralAssertions`, `expectedParity`

## Important Conventions

- **Non-Destructive Logging**: Never pipe test/build output directly to filters. Always write to `.logs/` first.
- **Protocol Compliance**: Routing step is mandatory before any tool call or code edit.
- **Expert Isolation**: Only one expert active at a time unless explicit handoff.
- **Variable Substitution**: VS is on by default (13.6% init token savings). Use `--no-vs` to opt out.
- **Cross-Target Parity**: All render targets must satisfy the same semantic invariants.

## File Organization

- **Never modify** files in `compiled/` - they are generated artifacts
- **Never modify** `.cursor/rules/` - install via `install-local.sh`
- **Focus edits** on `prompt-system/` JSON files and `scripts/lib/` renderers
- **Check AGENTS.md** for current project conventions and protocols