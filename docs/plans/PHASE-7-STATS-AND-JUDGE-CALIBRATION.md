# Phase 7: Statistical Rigor and Judge Calibration

**Depends on:** Phase 5 (Eval Maturity) + Phase 6 (Ablation Testing)
**Produces:** Paired statistical tests, ablation confidence intervals, SRM/integrity gates, calibrated LLM-as-judge workflow
**Validates with:** Unit tests, local ablation smoke runs, judge calibration report

---

## Goal

Make AgentHistoric prompt-evaluation results harder to over-interpret. Phase 5 introduced multi-trial pass@k/pass^k and Phase 6 introduced ablation. Phase 7 adds the statistical and judge-calibration controls needed before those reports can be used as promotion evidence.

---

## Implemented Capabilities

### Paired Statistics

`scripts/lib/stats.mjs` provides:

- McNemar exact and chi-square tests for paired binary outcomes.
- Wilcoxon signed-rank tests for paired behavioral deltas.
- Percentile bootstrap confidence intervals.
- Holm and Benjamini-Hochberg p-value correction.
- Sample Ratio Mismatch checks.
- Cohen's kappa for judge calibration.

### Ablation Statistics

`scripts/run-ablation.mjs --paired-stats` now:

1. Builds explicit paired records by `{caseId, trialIndex, target, model, seed}`.
2. Drops and reports unpaired observations.
3. Computes McNemar on strict pass/fail outcomes.
4. Computes Wilcoxon and bootstrap CIs on behavioral deltas.
5. Holm-adjusts primary p-values across ablated sections.
6. Uses the adjusted primary result plus guardrail deltas to produce `KEEP`, `REMOVE`, or `REVIEW`.

### Integrity Gate

`runIntegrityChecks()` invalidates runs before interpretation when:

- SRM is detected for variant allocations.
- Expected trials are missing.
- Score envelopes are malformed.
- Judge score arrays mix nulls and numeric scores.

### Judge Calibration

Judge configuration lives in `regression/judge-config.json`, not in rendered prompt-system JSON.

`scripts/calibrate-judge.mjs` reads `regression/judge-calibration/gold/*.jsonl`, runs the judge, computes Cohen's kappa per rubric, and writes:

- `regression/judge-calibration/report.json`
- `regression/judge-calibration/report.md`

Regression runs warn when calibration is missing. CI can enforce calibration with `--require-calibrated-judge`.

### Pairwise Judge Mode

`judgePairwise()` runs a position-swap pairwise comparison and normalizes raw `A`/`B` answers back to original response coordinates:

- `(A,B)->A` and `(B,A)->B` means original response A won consistently.
- `(A,B)->A` and `(B,A)->A` indicates first-position bias and becomes a tie.

---

## Commands

```bash
npm run test:unit
npm run calibrate:judge
npm run test:ablation:stats -- --local --suite smoke --targets cursor --trials 3
```

---

## Decision Policy

An ablation section earns `KEEP` only when the Holm-adjusted primary test is significant and removing the section worsens strict pass behavior or guardrails. Sections without significant evidence stay `REVIEW` rather than being promoted or removed by noise.

---

## Deferred

- BCa bootstrap intervals.
- CUPED, SPRT, and live-traffic sequential tests.
- DSPy, GEPA, AdalFlow, or other prompt auto-optimizers.
- Synthetic benchmark generation from production traces.
- Dedicated prompt-injection and metamorphic red-team suites.
