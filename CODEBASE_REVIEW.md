# AgentHistoric Codebase Review

**Review Date:** March 31, 2026
**Reviewer:** Automated analysis (Phase 1-3 updates)
**Project Type:** AI Agent Routing System / Mixture-of-Experts Framework

---

## Executive Summary

AgentHistoric is a sophisticated **Mixture-of-Experts (MoE) Swarm Architecture** that routes AI agent tasks to specialized philosophical personas. The project implements a "philosophical engineering" approach where each expert embodies a distinct epistemological tradition (Pragmatism, Rationalism, Empiricism, etc.) with corresponding output contracts, handoff rules, and behavioral guardrails.

### Key Strengths
- **Well-defined separation of concerns** between router, experts, and global OS
- **Philosophically-grounded personas** that provide consistent behavioral patterns
- **Multi-IDE support** (Claude, Cursor, Windsurf, Codex) with format-specific frontmatter
- **Behavioral guardrails** on all 11 experts using the Failure Mode → Rule → Anti-Over-Correction triple pattern (30 guardrails total)
- **32 unit tests** across 3 test files covering structural smoke tests, behavioral assertions, and artifact sync
- **Build automation** that generates IDE-specific rule files from a single source of truth

### Primary Concerns
- **Complexity overhead** from maintaining multiple output formats for different IDEs
- **Potential persona blending** when tasks span multiple domains
- **Limited runtime flexibility** - experts are statically defined rather than dynamically discoverable

---

## Architecture Overview

### Core Components

```
AgentHistoric/
├── prompt-system/          # Source of truth (JSON expert definitions)
│   ├── router.json         # Routing configuration
│   ├── system.json         # System-level settings
│   └── experts/            # 11 expert persona definitions
├── scripts/                # Build automation
│   ├── build-prompt-system.mjs    # Main artifact generator
│   ├── run-regressions.mjs        # Test runner
│   └── lib/                      # Shared utilities
├── dot-claude/rules/       # Generated Claude Code rules (.md)
├── dot-cursor/rules/       # Generated Cursor rules (.mdc)
├── dot-windsurf/rules/     # Generated Windsurf rules (.md)
└── dot-codex/skills/       # Codex-specific skill definitions
```

### Data Flow

1. **Source Layer**: `prompt-system/experts/*.json` files define expert personas
2. **Build Layer**: `scripts/build-prompt-system.mjs` transforms JSON into IDE-specific formats
3. **Runtime Layer**: Generated rule files are loaded by respective IDEs
4. **Verification Layer**: `regression/fixtures/cases.json` defines test cases

---

## Expert Persona Registry

| Expert | Philosophical Basis | Primary Responsibility | Key Output Sections |
|--------|---------------------|----------------------|---------------------|
| expert-abstractions-liskov | Liskov Substitution Principle | Interface stability, modular boundaries | N/A (specialist) |
| expert-architect-descartes | Rationalism | Foundational design, trust boundaries | Assumptions, Failure Modes, Fallbacks, Foundation, Verification Flags |
| expert-engineer-peirce | Pragmatism | Implementation, smallest correct change | Answer (simple) / Hypothesis, Evidence, Risk, Next Step (complex) |
| expert-formal-dijkstra | Formal Methods | Stateful systems, concurrency, invariants | N/A (specialist) |
| expert-information-shannon | Information Theory | Context compression, retrieval quality | N/A (specialist) |
| expert-manager-blackmore | Organizational Learning | Pattern extraction, automation | Root Cause, Solution Pattern, Automation Opportunity, Verification |
| expert-orchestrator-simon | Workflow Design | Task decomposition, stopping rules | N/A (router support) |
| expert-performance-knuth | Algorithmic Analysis | Performance measurement, bottlenecks | N/A (specialist) |
| expert-qa-popper | Falsificationism | Failure reproduction, root cause analysis | Hypothesis, Reproduction, Failure Coordinates, Verification |
| expert-ux-rogers | Human-Centered Design | User experience, friction points | Felt Experience, Friction, Human Cost, Fix, Success Criteria |
| expert-visionary-dennett | Divergent Thinking | Alternative designs, solution space expansion | Draft A/B/C, Recommendation |

---

## Routing Logic Analysis

### Router Decision Matrix (from `AGENTS.md`)

The routing system prioritizes experts based on **task type** and **impact on correctness**:

```
Massive Codebase Sweeps → architect-descartes → engineer-peirce → qa-popper → manager-blackmore
Agent Workflows & Orchestration → orchestrator-simon → architect-descartes → manager-blackmore
Exploration & Ideation → visionary-dennett → ux-rogers
Foundational Architecture → architect-descartes
Interfaces & Abstractions → abstractions-liskov → architect-descartes → engineer-peirce
Pragmatic Implementation → engineer-peirce
Performance & Scaling → performance-knuth → engineer-peirce → architect-descartes
Debug Firefighting → qa-popper → engineer-peirce → manager-blackmore
State, Concurrency & Invariants → formal-dijkstra → qa-popper → engineer-peirce
Bug Hunting & Edge Cases → qa-popper
Context Compression → information-shannon → orchestrator-simon → engineer-peirce
Security & 3PP Vulnerabilities → qa-popper → engineer-peirce
Retrospective & Pattern Extraction → manager-blackmore
```

### Routing Priority Principle

> "If multiple experts could apply, choose the one with the highest impact on **correctness**, not completeness."

This is a critical design decision that prioritizes **soundness** over **feature completeness**.

---

## Build System Analysis

### Artifact Generation (`scripts/build-prompt-system.mjs`)

The build system generates artifacts for multiple target formats:

| Target | Directory | Format | Frontmatter Style |
|--------|-----------|--------|-------------------|
| Claude Code | `dot-claude/rules/` | `.md` | Custom YAML-like |
| Cursor | `dot-cursor/rules/` | `.mdc` | Cursor-specific JSON |
| Windsurf (root) | `dot-windsurf/rules/` | `.md` | Custom YAML-like |
| Windsurf (gpt) | `dot-windsurf/rules/gpt/` | `.md` | Sparse format |
| Codex | `dot-codex/` | `.md` | Proprietary |

### Frontmatter Variations

**Claude/Windsurf Format:**
```yaml
---
trigger: always | model_decision
description: "..."
---
```

**Cursor Format:**
```json
{
  "description": "...",
  "alwaysApply": true
}
```

**Design Implication:** The different frontmatter styles reflect each IDE's rule activation semantics. Claude uses `trigger` for conditional loading, while Cursor uses `alwaysApply` for persistent rules.

---

## Test Coverage Analysis

### Unit Tests (32 tests across 3 files)

| Test File | Tests | Coverage |
|-----------|:-----:|----------|
| `prompt-smoke.test.mjs` | 12 | Frontmatter validity, required sections (init/router/expert), expert ID cross-references, handoff validity, guardrail completeness, token budgets |
| `prompt-system.test.mjs` | 4 | Section resolution logic, generated artifact sync |
| `regression.test.mjs` | 16 | Routing correctness, evaluator behavior, behavioral assertions (gold-plating, concision, false claims, diagnostic discipline) |

### Behavioral Assertion Helpers

Four code-based graders in `regression.mjs` for evaluating LLM output quality:

| Assertion | Detects |
|-----------|---------|
| `assertNoGoldPlating` | Extra sections beyond expected output contract |
| `assertConcision` | Response exceeding character budget |
| `assertNoFalseClaims` | Success claims without execution evidence |
| `assertDiagnosticDiscipline` | Fix proposals without prior diagnosis |

### Regression Fixtures (`regression/fixtures/cases.json`)

The test suite defines **25 test cases** across 4 categories:

| Category | Cases | Purpose |
|----------|-------|---------|
| Router (clear intent) | R1-R6 | Verify correct expert selection for unambiguous tasks |
| Expert behavior | Q1, D1, P1, Rg1, B1, V1, Dj1, Sh1, Kn1, Li1, Si1 | Validate each expert's output contract (all 11 covered) |
| Conflict resolution | C1, C2 | Test priority rules when multiple experts apply |
| Behavioral | BG1-BG6 | Test guardrail effectiveness (gold-plating, false claims, scope creep, diagnostic discipline) |

### Remaining Coverage Gaps

All 11 experts now have at least one dedicated regression case. Remaining gaps:
1. **Multi-case coverage** - Most experts have only 1 case; higher-traffic experts (Peirce, Descartes, Popper) would benefit from 3-5 cases each
2. **Cross-expert pipeline cases** - No cases that exercise full pipeline handoff sequences
3. **LLM-as-judge graders** (D6/D7) - All evaluation is deterministic code; no model-based soft grading yet

---

## Code Quality Assessment

### Strengths

1. **Single Source of Truth**: JSON expert definitions drive all generated artifacts
2. **Explicit Output Contracts**: Each expert defines required sections and forbidden behaviors
3. **Handoff Rules**: Clear delegation paths between experts (e.g., Peirce → Popper for debugging)
4. **Philosophical Grounding**: Each persona has a coherent epistemological basis

### Weaknesses

1. **Tight Coupling**: Build scripts assume specific JSON structure; schema changes require coordinated updates
2. **Format Fragmentation**: Maintaining 5 different output formats increases maintenance burden
3. **Limited Extensibility**: Adding new experts requires changes in multiple places (JSON, AGENTS.md routing, render functions)

### Code Smells

1. **`build-prompt-system.mjs`** - The `addSet()` function has 7 parameters, indicating potential parameter object pattern opportunity
2. **Frontmatter factories** - Three nearly identical frontmatter generators (`mdFm`, `windsurfFm`, `cursorFm`) suggest template method abstraction

---

## IDE Integration Analysis

### Claude Code Integration

- **Strength**: `.md` files with custom frontmatter integrate well with Claude's rule loading
- **Weakness**: Custom frontmatter format may not be officially documented by Claude

### Cursor Integration  

- **Strength**: `.mdc` extension and JSON frontmatter match Cursor's expected format
- **Weakness**: `alwaysApply: true` on all rules means no conditional activation based on context

### Windsurf Integration

- **Strength**: Dual format support (root + gpt subfolder) provides flexibility
- **Weakness**: No clear documentation of when to use sparse vs. rich formats

---

## Recommendations

### High Priority (Phase 4 scope)

1. ~~**Add Schema Validation**~~ — Addressed by Phase 3 smoke tests (12 structural validations)
2. **Add constraint hierarchy** to `system.json` — explicit "restricts but never expands" rule between layers (A1, A4)
3. **Add model-version markers** (`_modelTuning`) to flag model-sensitive prompt sections (A5)
4. **Propagate numeric anchors** to remaining experts beyond Peirce (A6 extension)

### Medium Priority (Phase 5 scope)

5. **Add pass@k / pass^k metrics** — run regression cases multiple times to distinguish "always works" from "sometimes works" (D4, D5)
6. **Add behavioral provocation fixtures** — test cases that tempt gold-plating, false claims, scope creep (D10)
7. ~~**Add Performance Budgets**~~ — Addressed by Phase 3 smoke test (15,000 char limit per artifact)

### Low Priority (Phase 6 scope)

8. **Ablation testing** — generate prompt variants with sections removed, measure delta (D9)
9. **Model-based graders** — LLM-as-judge for soft behavioral dimensions (D6, D7)

---

## Definition of Done Verification

Per the global `AGENTS.md` requirements:

| Criterion | Status | Notes |
|-----------|--------|-------|
| Code | Complete | Build scripts, render functions, and behavioral guardrails implemented |
| Tests | Complete | 32 unit tests, 14 regression cases, 4 behavioral assertion helpers |
| Verified | Yes | Multi-layer test defense: smoke tests + sync tests + behavioral graders |
| No TODOs/Placeholders | Clean | Core logic has no obvious placeholders |

---

## Phase Completion Status

| Phase | Status | Key Deliverable |
|-------|--------|----------------|
| Phase 1: Gap Analysis | Complete | 38 items audited, all classifications verified |
| Phase 2: Behavioral Guardrails | Complete | 30 guardrail triples across 11 experts, 3 renderers updated |
| Phase 3: Test Infrastructure | Complete | 12 smoke tests, 4 behavioral assertions, 32 total tests |
| Phase 4: Prompt Architecture | Complete | Constraint hierarchy, model markers, numeric anchors |
| Phase 5: Eval Maturity | Complete | pass@k/pass^k, 6 behavioral fixtures, behavioral metrics |
| Phase 6: Ablation Testing | Complete | 7-section ablation manifest, runner, report renderer |
| Gap Cleanup | Complete | C2 (read-only bias), C3 (adversarial protocol), E2 (lead with answer), full expert coverage |

---

## Conclusion

AgentHistoric implements a **sophisticated philosophical routing system** that successfully translates epistemological traditions into actionable AI agent behaviors. The architecture demonstrates strong separation of concerns between source definitions, build automation, and runtime artifacts.

Phases 1-6 added behavioral guardrails (30 triples across 11 experts), a 3-layer constraint hierarchy, multi-trial regression with pass@k/pass^k, ablation testing infrastructure, and comprehensive smoke tests. The test count increased from 11 to 49 and regression cases from 14 to 25, with all 11 experts now covered.

**Overall Assessment**: Production-ready with comprehensive test and evaluation infrastructure. Remaining work focuses on running ablation experiments with live API access and adding LLM-as-judge graders for soft behavioral dimensions.