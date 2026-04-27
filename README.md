# Agent Historic

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.19559517.svg)](https://doi.org/10.5281/zenodo.19559517)

> **Translating the world's most documented lives into high-fidelity agentic personas.**

Agent Historic is an open library of persona architectures for Large Language Models. It bridges primary historical records and modern prompt engineering by distilling the reasoning, rhetoric, and decision-making frameworks of well-attested figures into actionable system prompts.

A Mixture-of-Experts (MoE) routing layer assigns the right persona to every request, generating rules for **Claude**, **Cursor**, **Windsurf**, and **Codex** from one canonical source.

The routing layer includes negative routing guards, diversified sub-domain heuristics, progressive two-pass routing, a judge-mediated deliberation council for ambiguous tasks, and an adversarial verification pipeline for high-stakes implementations.

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
| **Crawford** | Manual Deliberation & Essential Friction | Embodied Knowledge, Anti-Automation Craftsmanship (Crawford / Morris / Dreyfus) |

## Quick Start

```bash
# 1. Generate all target artifacts
npm run build:prompts

# 2. Install rules into your editors (auto-detects installed editors)
node install.js

# 3. Or install for specific editors
node install.js --cursor --windsurf

# 4. Remote bootstrap install (served from GitHub Pages)
bash <(curl -fsSL https://agenthistoric.com/install.sh) --all
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((New-Object Net.WebClient).DownloadString('https://agenthistoric.com/install.ps1'))) --all"
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
node install.js [options]
```

The installer is a single cross-platform Node.js script (works on macOS, Linux, and Windows). The remote bootstrap wrappers (`install.sh`, `install.ps1`) download the repo and invoke `node install.js` for you.

```powershell
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((New-Object Net.WebClient).DownloadString('https://agenthistoric.com/install.ps1'))) [options]"
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

Remote bootstrap installer:

```bash
bash <(curl -fsSL https://agenthistoric.com/install.sh) [options]
```

```powershell
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((New-Object Net.WebClient).DownloadString('https://agenthistoric.com/install.ps1'))) [options]"
# or with flags:
powershell -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((New-Object Net.WebClient).DownloadString('https://agenthistoric.com/install.ps1'))) --cursor --codex"
```

### Windows Install Paths

| Target | Windows Path |
|------|--------|
| Claude | `%USERPROFILE%\.claude\rules\` |
| Cursor | `%USERPROFILE%\.cursor\rules\` |
| Windsurf | `%USERPROFILE%\.windsurf\rules\` |
| Codex | `%USERPROFILE%\.codex\` |
| OpenCode | `%APPDATA%\opencode\rules\` |

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

## Routing Evolution Features

Five features enhance the routing layer beyond basic signal matching. All are defined in `prompt-system/router.json`, rendered into every target by the build system, and covered by dedicated test suites.

### Negative Routing Examples

Anti-pattern rules that prevent common mis-routes. The router checks `negativeExamples` *before* confirming a positive signal match. For example, "refactor" normally matches Peirce, but when combined with "module boundaries" or "coupling" the negative guard redirects to Liskov.

- **Data:** `router.json` → `negativeExamples` (`doNotRouteToPeirce`, `doNotRouteToPopper`, `doNotRouteToDennett`)
- **Rendered as:** "Routing Anti-Patterns" section in every router artifact
- **Test suite:** `negative` (NE1-NE4)

### Diversified Routing Heuristics

Broad domains like "Pragmatic Implementation" and "Debug Firefighting" are split into granular sub-domains (18+ heuristics, up from 13) with specific lead experts, reducing Peirce/Popper over-selection. New sub-domains include Test Failure Diagnosis, Build & Config Errors, Quick Fix & Patch, General Implementation, Refactoring & Restructuring, Test Authoring, and Runtime Error Investigation.

Disambiguation is expanded to 9 expert keys (added `routeToLiskov`, `routeToSimon`, `routeToShannon`, `routeToKnuth`, `routeToDescartes`).

- **Data:** `router.json` → `routingHeuristics`, `disambiguation`
- **Test suite:** `diversity` (RB1-RB9)

### Progressive Two-Pass Routing

For ambiguous prompts, the router classifies the broad domain first, then refines to a specific expert based on task nuance. A contract rule mandates two-pass routing for ambiguous requests.

- **Data:** `router.json` → `refinementHeuristics`
- **Rendered as:** "Two-Pass Routing Refinement" section in every router artifact
- **Test suite:** `twopass` (TP1-TP3)

### Deliberation Council Pipeline

A judge-mediated multi-expert pipeline for tasks spanning multiple concerns. The router selects 2-3 experts, each contributes from their domain, and the router synthesizes a consensus. Triggered when confidence < 0.65 with 2+ matching domains, or when the user explicitly requests multiple perspectives.

- **Data:** `router.json` → `pipelines["Deliberation Council"]` with `triggerSignals` and `autoTrigger`
- **Design rationale:** Based on ICLR 2025 findings that judge-mediated debate outperforms naive multi-agent debate
- **Test suite:** `council` (CC1-CC4; CC4 is a negative case)

### Adversarial Verification Pipeline

After implementation, a separate adversarial verification step by Popper prevents self-verification bias. Popper's `verificationContract` (7 rules) requires running code, testing boundary conditions, and issuing exactly one of `VERDICT: PASS` or `VERDICT: FAIL`.

- **Data:** `router.json` → `pipelines["Implement & Verify"]`, `expert-qa-popper.json` → `verificationContract`
- **Design rationale:** Inspired by Claude Code's verification agent pattern; explicitly rejects rationalization patterns
- **Test suite:** `verification` (AV1-AV3)

## Testing

### Unit Tests

```bash
npm run test:unit
```

136 unit tests across 3 test files:

| File | Tests | Scope |
|------|:-----:|-------|
| `prompt-smoke.test.mjs` | 75 | Frontmatter validity, required sections, expert cross-references, guardrail completeness, token budgets, routing evolution rendering, pipeline structure, disambiguation expansion, cross-target semantic equivalence (`PROTOCOL:` tests), model-parity suite structure |
| `prompt-system.test.mjs` | 14 | Section resolution, generated artifact sync, variable substitution |
| `regression.test.mjs` | 47 | Routing, evaluator, behavioral assertions, negative routing guards, diversity routing, verbalized sampling |

### Behavioral Assertions

The regression evaluator includes five code-based graders that detect behavioral anti-patterns in LLM output:

- **`assertNoGoldPlating`** — flags extra sections beyond the output contract
- **`assertConcision`** — flags responses exceeding a character budget
- **`assertNoFalseClaims`** — flags success claims without execution evidence
- **`assertDiagnosticDiscipline`** — flags fix proposals without prior diagnosis
- **`assertRoutingFirst`** — flags preamble content before the routing decision

### Regression Suites

```bash
npm run test:regressions:smoke   # Quick smoke suite
npm run test:regressions         # Full suite
```

New feature-specific suites:

```bash
node scripts/run-regressions.mjs --suite negative     # NE1-NE4: negative routing guards
node scripts/run-regressions.mjs --suite diversity     # RB1-RB9: expert variety
node scripts/run-regressions.mjs --suite twopass       # TP1-TP3: progressive routing
node scripts/run-regressions.mjs --suite council       # CC1-CC4: deliberation council
node scripts/run-regressions.mjs --suite verification  # AV1-AV3: adversarial verification
node scripts/run-regressions.mjs --suite model-parity   # 13 cases: cross-model routing agreement
```

Target filtering and model overrides:

```bash
node scripts/run-regressions.mjs --suite smoke --targets cursor
node scripts/run-regressions.mjs --suite full --targets codex
node scripts/run-regressions.mjs --suite smoke --cursor-model gpt-5.4-medium
node scripts/run-regressions.mjs --suite diversity --trials 3  # Multi-trial for consistency
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

For model-parity tracking, add `expectedParity: true` (models should agree) or `expectedParity: false` with a `parityNote` explaining the divergence. Include the case id in `suites.model-parity`.

## Verification Workflow

1. `npm run build:prompts`
2. `npm run test:unit`
3. `npm run test:regressions:smoke`
4. Inspect `.logs/regression-summary-*.md`
5. `npm run test:regressions`
6. Compare parity deltas and adjust the prompt layer if drift is systematic.

## Ecosystem

Agent Historic shares compilation tooling with the [Agentic Skill Mill](https://github.com/barretts/AgenticSkillMill) ecosystem but maintains its own MoE routing layer and regression suite. Related projects:

| Project | Role | Links |
|---------|------|-------|
| **[Agentic Skill Mill](https://github.com/barretts/AgenticSkillMill)** | Parent — defines the skill-system-template architecture, fragment composition, and 7-target compiler | [agenticskillmill.com](https://agenticskillmill.com) |
| **[AgentThreader](https://github.com/barretts/AgentThreader)** | Sibling — manifest-driven agentic CLI orchestration with contracts and self-healing | [agentthreader.com](https://agentthreader.com) |
| **[TechDemoDirector](https://github.com/barretts/TechDemoDirector)** | Sibling — code walk-through presentation scripting | [Site](https://barretts.github.io/TechDemoDirector) |

## Citation

If you use Agent Historic in your research, please cite:

> Sonntag, Barrett. (2025). *Philosophical Persona Prompting as Semantic Indexing for Latent Representation Steering in Large Language Models*. Zenodo. [https://doi.org/10.5281/zenodo.19559517](https://doi.org/10.5281/zenodo.19559517)

BibTeX:

```bibtex
@techreport{sonntag2025persona,
  author    = {Sonntag, Barrett},
  title     = {Philosophical Persona Prompting as Semantic Indexing for Latent Representation Steering in Large Language Models},
  year      = {2025},
  doi       = {10.5281/zenodo.19559517},
  url       = {https://doi.org/10.5281/zenodo.19559517},
  publisher = {Zenodo}
}
```

## License

MIT

## Disclaimer

The persona biographies and voice simulations in this project are generated by LLMs from historical and public-source material. They are not official statements, endorsements, sponsorships, or approvals by the represented individuals, their estates, or affiliated institutions.
