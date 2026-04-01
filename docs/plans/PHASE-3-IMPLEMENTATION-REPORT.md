# Phase 3: Test Infrastructure Hardening — Implementation Report

**Date:** 2026-03-31
**Status:** Complete
**Depends on:** Phase 1 (Gap Analysis), Phase 2 (Behavioral Guardrails)

---

## Summary

Two new test layers have been added to the system: structural smoke tests for generated prompts, and behavioral assertion helpers for the regression evaluator. Test count increased from 11 to 32. All tests pass, and intentional breakage is reliably caught by multiple independent tests.

---

## What Was Done

### 1. Prompt Smoke Tests (`scripts/lib/prompt-smoke.test.mjs`) — NEW FILE

12 structural tests that validate every generated artifact without depending on file snapshots:

| # | Test | What It Catches |
|---|------|----------------|
| 1 | Cursor `.mdc` frontmatter validity | Missing `description` or `alwaysApply` fields |
| 2 | Windsurf/Claude `.md` frontmatter validity | Missing `trigger` or `description` fields |
| 3 | Codex `SKILL.md` frontmatter validity | Missing `name` or `description` fields |
| 4 | Init prompts contain required sections | Missing Logging, Definition of Done, Foundational Constraints, Swarm Registry |
| 5 | Router prompts contain required sections | Missing Routing Heuristics, Pipeline Sequences |
| 6 | Expert prompts contain required structural sections | Missing Method, Voice, Deliverables, Output Contract, Failure Signals, Behavioral Guardrails, Allowed Handoffs |
| 7 | Every router-referenced expert has a generated file | Orphaned expert ID in router heuristics |
| 8 | Every expert has artifacts across all targets | Missing Cursor or Codex output for a registered expert |
| 9 | Every handoff target references a valid expert | Typo or deleted expert in handoff rules |
| 10 | Every expert has non-empty `behavioralGuardrails` | Missing or empty guardrails array |
| 11 | Every guardrail triple has all three fields | Incomplete guardrail (missing `failureMode`, `rule`, or `antiOverCorrection`) |
| 12 | No artifact exceeds 15,000 character budget | Unbounded prompt growth |

### 2. Behavioral Assertion Helpers (`scripts/lib/regression.mjs`) — EXTENDED

Four new exported functions for code-based behavioral grading:

| Function | What It Detects | Approach |
|----------|----------------|----------|
| `assertNoGoldPlating(response, testCase)` | Extra markdown heading sections beyond what `expectedSections` and `allowedHandoffs` specify | Regex extraction of `##` headings, comparison to expected set |
| `assertConcision(response, maxChars)` | Response exceeding a character budget (default 4000) | Character count comparison |
| `assertNoFalseClaims(response)` | Claims like "all tests pass" without evidence of execution (no code fences, no `$` commands, no `output:`) | Pattern matching with tool-evidence gate |
| `assertDiagnosticDiscipline(response)` | Proposing a fix without any diagnosis (no error reading, no root cause, no hypothesis) | Dual pattern check: has-fix AND lacks-diagnosis |

### 3. Scoring Update (`evaluateResponse()`) — EXTENDED

The scoring system now incorporates behavioral findings:

- **Score 2:** Correct expert + format compliance + no behavioral findings
- **Score 1:** Correct expert + (format issues OR behavioral findings)
- **Score 0:** Wrong expert

Behavioral assertions are opt-in per test case via a new `behavioralAssertions` array field:

```json
{
  "id": "R1",
  "behavioralAssertions": ["noGoldPlating", "concision"]
}
```

The return object now includes a `behavioralFindings` array alongside `notableDrift`.

### 4. Unit Tests for Assertions (`scripts/lib/regression.test.mjs`) — EXTENDED

10 new tests (positive and negative cases for each assertion + integration):

| # | Test | Type |
|---|------|------|
| 1 | `assertNoGoldPlating` flags extra sections | Negative |
| 2 | `assertNoGoldPlating` passes with only expected sections | Positive |
| 3 | `assertConcision` flags responses over limit | Negative |
| 4 | `assertConcision` passes for short responses | Positive |
| 5 | `assertNoFalseClaims` flags unverified success claims | Negative |
| 6 | `assertNoFalseClaims` passes with tool evidence | Positive |
| 7 | `assertDiagnosticDiscipline` flags fix-without-diagnosis | Negative |
| 8 | `assertDiagnosticDiscipline` passes with diagnosis | Positive |
| 9 | `evaluateResponse` incorporates behavioral findings into scoring | Integration |
| 10 | (existing) `evaluateResponse` rejects blended headings | Regression guard |

---

## Validation Criteria Results

| Criterion | Result |
|-----------|--------|
| `prompt-smoke.test.mjs` exists with >= 5 structural tests | **PASS** — 12 tests |
| All smoke tests pass on current generated output | **PASS** — 32/32 |
| Intentionally breaking a prompt causes smoke test failure | **PASS** — 3 tests caught empty `behavioralGuardrails` on Shannon |
| `assertNoGoldPlating` exported from `regression.mjs` | **PASS** |
| `assertConcision` exported from `regression.mjs` | **PASS** |
| `assertNoFalseClaims` exported from `regression.mjs` | **PASS** |
| `assertDiagnosticDiscipline` exported from `regression.mjs` | **PASS** |
| Each assertion has at least one unit test | **PASS** — 2 each (positive + negative) |
| `npm run test:unit` passes with all new tests | **PASS** — 32/32, 0 failures |
| Scoring in `evaluateResponse` incorporates behavioral findings | **PASS** — integration test confirms score drops from 2 to 1 |

---

## Breakage Verification

Intentionally emptied Shannon's `behavioralGuardrails` array. Three tests caught it independently:

1. **"expert prompts contain required structural sections"** — detected missing Behavioral Guardrails heading in generated `.mdc`
2. **"every expert has a non-empty behavioralGuardrails array"** — detected empty array in source JSON
3. **"generated artifacts stay in sync"** — existing sync test detected file content drift

This confirms multi-layer defense: source validation (test 10), structural validation (test 6), and snapshot validation (test 16) all independently catch the same class of error.

---

## Test Count Progression

| Phase | Test File | Tests | Cumulative |
|-------|-----------|:-----:|:----------:|
| Pre-Phase 3 | `prompt-system.test.mjs` | 4 | 4 |
| Pre-Phase 3 | `regression.test.mjs` | 7 | 11 |
| Phase 3 | `prompt-smoke.test.mjs` | 12 | 23 |
| Phase 3 | `regression.test.mjs` (added) | 9 | 32 |

---

## Gap Analysis Items Addressed

| ID | Item | Status Before | Status After |
|----|------|:------------:|:------------:|
| D1 | Prompt smoke tests (structural validation) | MISSING | **DONE** |
| D3 | Behavioral assertion helpers (code-based graders) | PARTIAL | **IMPROVED** — 4 new behavioral dimensions |
| D8 | Behavioral eval dimensions beyond routing | MISSING | **PARTIAL** — 4 of 6 dimensions now have code graders |

### D8 Detail: Behavioral Dimensions Covered

| Dimension | Grader | Status |
|-----------|--------|--------|
| Over-engineering / gold-plating | `assertNoGoldPlating` | **Done** |
| Concision | `assertConcision` | **Done** |
| False claims | `assertNoFalseClaims` | **Done** |
| Diagnostic discipline | `assertDiagnosticDiscipline` | **Done** |
| File-editing quality | — | Deferred (requires tool-use context) |
| Assertiveness / thoroughness | — | Deferred (requires model-based grading, Phase 5) |

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/lib/prompt-smoke.test.mjs` | **NEW** — 12 structural smoke tests |
| `scripts/lib/regression.mjs` | Added 4 behavioral assertion functions + updated `evaluateResponse()` scoring |
| `scripts/lib/regression.test.mjs` | Added 9 new tests for behavioral assertions |

No generated artifacts changed. No expert JSONs changed. No renderers changed.

---

## What Remains for Future Phases

- **D4/D5 (pass@k / pass^k)** — Multiple-trial metrics. Phase 5 scope.
- **D6/D7 (model-based graders)** — LLM-as-judge for soft behavioral dimensions. Phase 5 scope.
- **D10 (expanded regression fixtures)** — Test cases that specifically provoke guardrail violations. Phase 5 scope. The `behavioralAssertions` field is ready for use in new fixtures.
- **D9 (ablation testing)** — Phase 6 scope.

---

*Implementation complete. All validation criteria met. Test count: 11 → 32.*
