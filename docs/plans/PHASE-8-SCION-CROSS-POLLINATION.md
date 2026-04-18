# Phase 8: Scion Cross-Pollination — Top 3 Priorities

**Date:** 2026-04-18
**Source:** `docs/experiments/scion-cross-pollination-analysis.md`
**Status:** Planned

---

## Summary

Extract top 3 actionable items from the Scion cross-pollination analysis. These borrow Scion's design patterns (interface contracts, scoped overrides, lifecycle phases) without taking its runtime concerns.

---

## Priority 1: Target Harness Expansion

**Goal:** Add `claude`, `gemini`, and `opencode` as regression targets alongside existing `cursor` and `codex`.

**Rationale:** Each harness has distinct instruction injection behavior. Validates that the same prompt routes identically regardless of harness format — catches "format sensitivity" failure modes.

### Implementation

1. **Create harness wrappers** in `scripts/clr-wrappers/`:
   - `claude-print.sh` — inject via `.claude/CLAUDE.md`
   - `gemini-print.sh` — inject via `.gemini/GEMINI.md`
   - `opencode-print.sh` — inject via `AGENTS.md`

2. **Update `scripts/lib/clr-runner.mjs`:**
   - Add target mappings for new harnesses
   - Handle different instruction injection paths per harness

3. **Add smoke cases:**
   - Route to same expert across all 5 targets
   - Validate instruction format is preserved

**Gate:** `node scripts/run-regressions.mjs --suite smoke --targets claude,gemini,opencode` produces parseable results.

---

## Priority 2: Renderer Interface Protocol

**Goal:** Formalize the renderer contract so adding new targets (OpenCode, Gemini) is trivial and testable.

**Rationale:** Currently each renderer is implicit convention. Formalizing prevents silent drift.

### Implementation

1. **Document the interface in `build-prompt-system.mjs`:**
   ```javascript
   /**
    * Renderer Protocol
    * 
    * Every render target must produce artifacts that satisfy these invariants:
    * 
    * renderInit(system) → string
    * renderRouter(system) → string
    * renderExpert(system, expert) → string
    */
   ```

2. **Add validation test** in `prompt-smoke.test.mjs`:
   - For each renderer, assert all required functions exist
   - Assert output contains required sections for each artifact type

3. **Target coverage matrix:**
   | Target | renderInit | renderRouter | renderExpert |
   |--------|-----------|--------------|---------------|
   | rich (claude) | ✓ | ✓ | ✓ |
   | rich (windsurf) | ✓ | ✓ | ✓ |
   | rich (cursor) | ✓ | ✓ | ✓ |
   | rich (crush) | ✓ | ✓ | ✓ |
   | rich (gemini) | ✓ | ✓ | ✓ |
   | codex | ✓ | ✓ | ✓ |

**Gate:** All 6 targets produce structurally equivalent artifacts by protocol test.

---

## Priority 3: Pipeline Integration Test Suite

**Goal:** Test actual handoff chains — that Step N's output conforms to expected contract, Step N+1 receives context, terminal steps produce deliverables.

**Rationale:** Pipelines (Deliberation Council, Implement & Verify, Debug Firefighting) are defined but only tested at trigger detection level. This tests the actual multi-turn behavior.

### Implementation

1. **Create `pipeline-integration` suite** in `regression/fixtures/cases.json`:
   - Multi-message regression cases (not single-shot)
   - Each case tests one pipeline
   - Assertions:
     - Step N output contains expected section headers for expert N
     - Step N+1 receives context from Step N
     - Terminal steps produce contract deliverables (e.g., `VERDICT: PASS`)

2. **Example cases:**
   - **AV1-pipeline:** Implement & Verify — Peirce implements, Popper verifies, VERDICT appears
   - **CC1-pipeline:** Deliberation Council — multi-expert analysis, consensus reached
   - **Debug1-pipeline:** Debug Firefighting — Popper diagnoses, Peirce fixes, Popper confirms

3. **Infrastructure needs:**
   - Multi-turn test runner (not single-shot)
   - State propagation between steps
   - Output validation per step

**Gate:** Pipeline integration cases pass with full handoff chain validated.

---

## Files to Modify

| Priority | Files |
|----------|-------|
| 1 | `scripts/clr-wrappers/`, `scripts/lib/clr-runner.mjs` |
| 2 | `scripts/lib/build-prompt-system.mjs`, `scripts/lib/prompt-smoke.test.mjs` |
| 3 | `regression/fixtures/cases.json`, `scripts/run-regressions.mjs` |

---

## Verification

1. `npm run test:unit` passes (135+ tests)
2. Harness expansion: smoke suite passes on all 5 targets
3. Renderer protocol: all targets satisfy interface contract
4. Pipeline integration: new suite passes

---

## Dependencies

- Scion harness binaries (claude, gemini, opencode) must be available
- Multi-turn test infrastructure may require new script development

---

## Open Questions

- How to handle harness availability? (skip if not installed vs. fail-fast)
- Pipeline integration tests require multi-turn LLM calls — estimate 10-20x more API calls per case