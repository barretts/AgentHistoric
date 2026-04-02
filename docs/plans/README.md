# Research Application Plan

Phased plan for applying findings from Claude Code source analysis (docs/research/00-02) to AgentHistoric's prompt system and testing infrastructure.

## Phase Index

| Phase | Document | Status | Depends On |
|-------|----------|--------|------------|
| 1 | [Gap Analysis](PHASE-1-GAP-ANALYSIS.md) | Complete | -- |
| 2 | [Behavioral Guardrails](PHASE-2-BEHAVIORAL-GUARDRAILS.md) | Ready | Phase 1 |
| 3 | [Test Infrastructure](PHASE-3-TEST-INFRASTRUCTURE.md) | Ready | Phase 1 |
| 4 | [Prompt Architecture](PHASE-4-PROMPT-ARCHITECTURE.md) | Ready | Phases 2, 3 |
| 5 | [Eval Maturity](PHASE-5-EVAL-MATURITY.md) | Ready | Phases 2, 3 |
| 6 | [Ablation Testing](PHASE-6-ABLATION-TESTING.md) | Ready | Phases 4, 5 |

## Dependency Graph

```
Phase 1 (Gap Analysis)
  |
  +---> Phase 2 (Behavioral Guardrails)  --+---> Phase 4 (Prompt Architecture) --+
  |                                        |                                     |
  +---> Phase 3 (Test Infrastructure)   --+---> Phase 5 (Eval Maturity)      --+--> Phase 6 (Ablation)
```

Phases 2 and 3 can run in parallel. All subsequent phases require both.

## Quick Reference

- **Source research:** `docs/research/00-DEEP-RESEARCH-EXTRACTION.md`, `01-BEHAVIORAL-ENGINEERING-DEEP-DIVE.md`, `02-EVAL-STACK-RECONSTRUCTION.md`
- **Prompt source:** `prompt-system/` (JSON)
- **Build:** `npm run build:prompts`
- **Unit tests:** `npm run test:unit`
- **Regression tests:** `npm run test:regressions:smoke` (quick) / `npm run test:regressions` (full)
- **Generated output:** `dot-claude/`, `dot-cursor/`, `dot-windsurf/`, `dot-codex/`
