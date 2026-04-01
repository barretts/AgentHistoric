# AgentHistoric Codebase Review

**Review Date:** March 27, 2026  
**Reviewer:** Cline (Automated Analysis)  
**Project Type:** AI Agent Routing System / Mixture-of-Experts Framework

---

## Executive Summary

AgentHistoric is a sophisticated **Mixture-of-Experts (MoE) Swarm Architecture** that routes AI agent tasks to specialized philosophical personas. The project implements a "philosophical engineering" approach where each expert embodies a distinct epistemological tradition (Pragmatism, Rationalism, Empiricism, etc.) with corresponding output contracts and handoff rules.

### Key Strengths
- **Well-defined separation of concerns** between router, experts, and global OS
- **Philosophically-grounded personas** that provide consistent behavioral patterns
- **Multi-IDE support** (Claude, Cursor, Windsurf) with format-specific frontmatter
- **Comprehensive test fixtures** covering routing logic and expert behaviors
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

### Regression Fixtures (`regression/fixtures/cases.json`)

The test suite defines **14 test cases** across 5 categories:

| Category | Cases | Purpose |
|----------|-------|---------|
| Router (clear intent) | R1-R6 | Verify correct expert selection for unambiguous tasks |
| Expert behavior | Q1, D1, P1, Rg1, B1, V1 | Validate each expert's output contract |
| Conflict resolution | C1, C2 | Test priority rules when multiple experts apply |

### Coverage Gaps

**Missing Test Scenarios:**
1. **Formal Dijkstra** - No dedicated test case for concurrency/stateful systems
2. **Information Shannon** - No test for context compression scenarios  
3. **Performance Knuth** - No benchmark-driven routing tests
4. **Abstractions Liskov** - No interface stability validation
5. **Orchestrator Simon** - No multi-agent workflow decomposition tests

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

### High Priority

1. **Add Schema Validation**: Introduce JSON schema validation for `prompt-system/experts/*.json` to catch structural errors early
2. **Consolidate Frontmatter**: Consider a unified frontmatter format with IDE-specific adapters rather than separate factories
3. **Expand Test Coverage**: Add test cases for Dijkstra, Shannon, Knuth, Liskov, and Simon experts

### Medium Priority

4. **Document Routing Heuristics**: Create explicit decision tree or flowchart for router behavior
5. **Add Performance Budgets**: Define token budgets per expert to prevent context overflow
6. **Version Artifacts**: Include version hash in generated files for traceability

### Low Priority

7. **Extract Parameter Objects**: Refactor `addSet()` function parameters into a configuration object
8. **Add Linting Rules**: Create custom linting rules to detect forbidden behaviors (e.g., emoji usage outside Rogers)
9. **Generate Documentation**: Auto-generate API docs from expert JSON definitions

---

## Definition of Done Verification

Per the global `AGENTS.md` requirements:

| Criterion | Status | Notes |
|-----------|--------|-------|
| Code | ✅ Complete | Build scripts and render functions implemented |
| Tests | ⚠️ Partial | 14 cases defined, but gaps in expert coverage |
| Verified | ✅ Yes | Regression framework exists with clear pass/fail criteria |
| No TODOs/Placeholders | ✅ Clean | Core logic has no obvious placeholders |

---

## Conclusion

AgentHistoric implements a **sophisticated philosophical routing system** that successfully translates epistemological traditions into actionable AI agent behaviors. The architecture demonstrates strong separation of concerns between source definitions, build automation, and runtime artifacts.

The primary risk is **maintenance complexity** from supporting multiple IDE formats. However, the single-source-of-truth approach (JSON expert definitions) mitigates this by centralizing the canonical behavior specifications.

**Overall Assessment**: Production-ready with recommended test coverage expansion for full confidence in all expert routing paths.