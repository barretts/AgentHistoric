# PHASE-8-SCION-CROSS-POLLINATION.md — Architectural Review

**Routing:** expert-architect-descartes
**Date:** 2026-04-18
**Source:** `docs/plans/PHASE-8-SCION-CROSS-POLLINATION.md`, `docs/experiments/scion-cross-pollination-analysis.md`

---

## Executive Summary

The plan extracts three actionable items from the Scion cross-pollination analysis. Two are solid and ready for implementation. One — the pipeline integration test suite — is underspecified and requires infrastructure work that the plan does not scope.

---

## Assumptions

The plan assumes the Scion cross-pollination source analysis (155 lines) is the authoritative reference, that `build-prompt-system.mjs` has already partially implemented Priority 2 (the renderer protocol JSDoc is present but informal), and that the multi-turn regression infrastructure does not exist. These are accurate.

---

## Fallbacks

### Priority 1 (Harness Expansion)

The `clr-runner.mjs` already supports `cursor` and `claude`/`crush` via `TOOL_ID_BY_TARGET`. Adding `gemini` and `opencode` requires harness availability — the plan correctly flags this as a gating concern.

**Fallback:** Skip unknown targets rather than fail-fast. If `gemini` or `opencode` is not installed, the regression runner should log a warning and skip those targets. This is consistent with how the plan's Gate is written.

### Priority 2 (Renderer Protocol)

The protocol is partially documented in JSDoc but the validation lives in `prompt-smoke.test.mjs` as informal assertions. Formalizing it as a named interface with explicit function signatures is low-risk since the test suite already enforces the semantics.

**Fallback:** Implement the formal interface as typed function signatures in `build-prompt-system.mjs` rather than a separate protocol doc — keeping the contract adjacent to the implementation prevents drift.

### Priority 3 (Pipeline Integration)

The plan identifies the right gap — current pipeline tests only validate trigger detection (CC1-CC4, AV1-AV3), not the actual handoff output. However, the plan underestimates the infrastructure cost: `regression.mjs` is a single-shot evaluator. Multi-turn state propagation requires a new test runner architecture, not just new cases.

**Fallback:** Decompose Priority 3 into two sub-issues before implementation: (a) design the multi-turn runner contract, (b) define the `pipeline-integration` case schema. Without (a), the cases cannot be written.

---

## Foundation

### Priority 1 — Sound and Most Actionable

The harness wrapper pattern is proven — `agent-print.sh`, `claude-print.sh`, and `crush-print.sh` already exist in `scripts/clr-wrappers/`. The gap is `gemini-print.sh` and `opencode-print.sh` plus updating `TOOL_ID_BY_TARGET` in `clr-runner.mjs`.

The critical unknown is whether Gemini CLI and OpenCode support the same `--print` / manifest-driven workflow as Claude Code and Cursor. If they do, the wrapper and integration work is straightforward.

### Priority 2 — Already In Progress

The JSDoc in `build-prompt-system.mjs` (lines 14–42) documents the protocol invariants. `prompt-smoke.test.mjs` enforces them through `PROTOCOL:` prefixed tests. The plan's recommendation to add a formal `renderInit/renderRouter/renderExpert` interface contract is valid.

### Priority 3 — Underspecified

Pipeline integration requires:

1. A multi-turn state machine that preserves `activeExpert` and `handoffs` between turns
2. Per-step output validation (Step N produces correct sections, Step N+1 receives Step N's context)
3. Terminal step deliverable checks (e.g., `VERDICT: PASS/FAIL` in Popper's output)

This is a new test runner architecture, not a new test suite. The plan names the case schema but not the runner changes.

---

## Verification Flags

| Priority | Gate | Feasibility | Risk |
|----------|------|-------------|------|
| 1 | `run-regressions.mjs --suite smoke --targets claude,gemini,opencode` | **High** — wrapper pattern proven, only new harness wrappers needed | Gemini/OpenCode harness availability |
| 2 | All 6 targets satisfy protocol test | **High** — semantics already enforced, needs only formalization | None identified |
| 3 | Pipeline integration suite passes | **Medium** — requires new multi-turn runner, not just cases | State propagation architecture undefined |

---

## Recommendations

1. **Prioritize 1 and 2** as stated. Both have clear paths to completion with existing infrastructure.
2. **Decompose Priority 3** into two sub-issues before implementation: (a) design the multi-turn runner contract, (b) define the `pipeline-integration` case schema.
3. **Add a "skip" strategy** for harness availability: if `gemini` or `opencode` is not installed, log a warning and skip rather than failing the suite.
4. **Close the gap on verbalized sampling** — the `prompt-smoke.test.mjs` references VS (`verbalizedSampling`) in the router (line 158) but the Phase 8 plan does not mention it. Verify whether VS is gated by an experiment flag or is a stable feature before Priority 1 lands it on more targets.
