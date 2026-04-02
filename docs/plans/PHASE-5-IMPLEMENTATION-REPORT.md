# Phase 5: Eval Maturity — Implementation Report

**Date:** 2026-03-31
**Status:** Complete
**Depends on:** Phase 2 (Behavioral Guardrails) + Phase 3 (Test Infrastructure)

---

## Summary

The regression evaluation system now supports multi-trial execution with pass@k/pass^k metrics, quantitative behavioral dimensions (over-engineering and concision scores), and 6 new behavioral test fixtures. The test count increased from 36 to 45. The regression runner supports `--trials N` and `--parallel N` CLI flags.

---

## What Was Done

### 1. Multi-Trial Runner

Added two new exported functions in `regression.mjs`:

**`runTrials(runSingleTrial, { trials, parallel })`**
- Executes a trial function N times with configurable parallelism
- Batches parallel trials using `Promise.all`
- Returns an array of trial results

**`aggregateTrialResults(trialResults)`**
- Computes pass@k (at least one trial scored 2), pass^k (all trials scored 2)
- Calculates meanScore, routingConsistency, and scoreDistribution
- Returns a structured summary object matching the Phase 5 specification

### 2. CLI Flag Support

Updated `parseArgs()` to support two new flags:

| Flag | Default | Effect |
|------|:-------:|--------|
| `--trials N` | 1 | Run each case N times |
| `--parallel N` | 1 | Run up to N trials concurrently |

When `--trials 1` (default), the output format is fully backwards compatible.

### 3. Updated run-regressions.mjs

The main regression runner now:
- Imports `runTrials` and `aggregateTrialResults`
- Wraps each case/target execution in `runTrials()`
- Generates per-case aggregated results when `--trials > 1`
- Appends trial index suffixes to log filenames (`-t0`, `-t1`, etc.)
- Populates `run.aggregated` and `run.trialsPerCase` for downstream formatting

### 4. Markdown Summary Upgrade

`formatSummary()` now renders:
- A multi-trial summary table when `trialsPerCase > 1` with columns: Case, Target, pass@k, pass^k, Mean, Routing, Distribution
- Behavioral findings per result (when present)
- Behavioral metrics per result (overEngineering, concision)
- Single-run format when `trialsPerCase === 1` for backwards compatibility

### 5. Behavioral Eval Dimensions

Added `computeBehavioralMetrics(response, testCase)`:

| Metric | Formula | Ideal |
|--------|---------|:-----:|
| overEngineering | min(1.0, expectedSections / actualSections) | 1.0 |
| concision | min(1.0, referenceChars / actualChars) | 1.0 |

Reference lengths: 2,000 chars for simple tasks (1-4 sections), 8,000 chars for complex tasks (5+ sections).

`evaluateResponse()` now includes `behavioralMetrics` in every score result, enabling trend tracking across runs.

### 6. Behavioral Regression Fixtures

Added 6 new test cases to `regression/fixtures/cases.json`:

| ID | Name | Expert | Behavioral Assertions |
|----|------|--------|-----------------------|
| BG1 | Anti-gold-plating | Peirce | noGoldPlating, concision |
| BG2 | Premature abstraction | Peirce | noGoldPlating |
| BG3 | False claim detection | Popper | noFalseClaims |
| BG4 | Diagnostic discipline | Popper | diagnosticDiscipline |
| BG5 | Scope creep | Peirce | noGoldPlating, concision |
| BG6 | Verification quality | Popper | noFalseClaims, diagnosticDiscipline |

All 6 cases are included in the `full` suite. Total regression cases: 14 → 20.

---

## New Unit Tests (9 tests)

| Test | Validates |
|------|-----------|
| `runTrials executes the correct number of trials` | Trial count and parallel batching |
| `aggregateTrialResults computes pass@k and pass^k correctly` | Mixed and perfect results |
| `aggregateTrialResults detects routing inconsistency` | Misrouted trials reduce consistency |
| `computeBehavioralMetrics detects over-engineering` | 3 sections when 1 expected → 0.33 |
| `computeBehavioralMetrics returns 1.0 for well-scoped response` | 1 section when 1 expected → 1.0 |
| `computeBehavioralMetrics concision penalizes verbose responses` | 5,000 chars vs 2,000 reference |
| `parseArgs supports --trials and --parallel flags` | CLI parsing |
| `parseArgs defaults trials to 1 and parallel to 1` | Backward compatibility |
| `evaluateResponse includes behavioralMetrics in result` | Integration test |

---

## Validation Criteria Results

| Criterion | Result |
|-----------|--------|
| `--trials N` flag works and produces N results per case | **PASS** — unit test verifies |
| `pass@k` and `pass^k` computed correctly | **PASS** — tested with mixed/perfect/inconsistent inputs |
| At least 6 new behavioral test cases in `cases.json` | **PASS** — BG1-BG6 |
| `behavioralMetrics` computed per case | **PASS** — integrated into evaluateResponse |
| Markdown summary renders multi-trial table when trials > 1 | **PASS** — formatSummary updated |
| `npm run test:unit` passes with all new tests | **PASS** — 45/45 |
| Baseline report from `--trials 3` run | DEFERRED — requires LLM API calls; framework is ready |

---

## Gap Analysis Items Addressed

| ID | Item | Status |
|----|------|:------:|
| D4 | pass@k metric | **DONE** |
| D5 | pass^k metric | **DONE** |
| D10 | Behavioral provocation fixtures | **DONE** (6 cases) |
| D6 | Quantitative behavioral dimensions | **DONE** (overEngineering, concision) |

---

## Test Count Progression

| Phase | Cumulative Tests |
|-------|:----------------:|
| Pre-Phase 3 | 11 |
| Phase 3 | 32 |
| Phase 4 | 36 |
| Phase 5 | **45** |

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/lib/regression.mjs` | Added `runTrials`, `aggregateTrialResults`, `computeBehavioralMetrics`; updated `parseArgs`, `evaluateResponse`, `formatSummary` |
| `scripts/run-regressions.mjs` | Multi-trial execution loop, aggregation, new imports |
| `scripts/lib/regression.test.mjs` | 9 new tests |
| `regression/fixtures/cases.json` | 6 new behavioral test cases (BG1-BG6), updated `full` suite |

---

*Implementation complete. All validation criteria met except the baseline report, which requires API access.*
