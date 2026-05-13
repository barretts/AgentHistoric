---
description: Validate philosopher personas after model or host updates
---
# Model Update Validation

Use this workflow when Cursor, Codex, Claude, Crush, Gemini, Windsurf, or an underlying model version changes. The goal is to detect drift before tuning prompts.

## 1. Capture the update context

Record the date, host target, old model, new model, reason for validation, and expected blast radius in a scorecard under `docs/experiments/`.

## 2. Run the local invariant gate

```bash
mkdir -p .logs
npm run build:prompts > .logs/model-update-build-prompts-1.log 2>&1
npm run test:unit > .logs/model-update-test-unit-1.log 2>&1
```

Stop if either command fails. Inspect the logs before making prompt changes.

## 3. Run cheap local behavioral checks

```bash
node scripts/run-regressions.mjs --local --suite smoke --targets cursor,codex --trials 3 --trace > .logs/model-update-local-smoke-1.log 2>&1
node scripts/run-regressions.mjs --local --suite model-parity --targets cursor,codex --trials 3 --trace > .logs/model-update-local-parity-1.log 2>&1
```

Use local results to verify the harness and fixtures. Do not treat local accuracy as proof that real models are safe.

## 4. Run a real-model sample

Choose 4-8 cases covering `specialist-pressure`, `mixed-intent`, `twopass`, and `persona-vs-neutral`.

```bash
node scripts/run-regressions.mjs --suite full --targets cursor --case SP-Li1,SP-Kn2,MI3,TP3b,TP5b,PN1,PN4 --trials 1 --trace --judge > .logs/model-update-real-sample-1.log 2>&1
```

For CLR-backed hosts, use:

```bash
node scripts/run-via-clr.mjs --suite model-parity --targets cursor,crush --timeout-sec 300 > .logs/model-update-clr-parity-1.log 2>&1
```

## 5. Analyze trace failures

```bash
node scripts/analyze-traces.mjs --all > .logs/model-update-trace-analysis-1.log 2>&1
node scripts/analyze-distribution-shift.mjs --all > .logs/model-update-shift-analysis-1.log 2>&1
```

Add novel prompts to fixtures only when they represent repeated real usage or uncovered task shapes.

## 6. Apply the triage ladder

Use `docs/experiments/failure-triage-ladder.md` before changing prompts:

1. Mark genuine ambiguity with `ambiguousBetween`.
2. Add a narrow boost signal for under-selected experts.
3. Add an anti-trigger for clear over-selection.
4. Adjust expert guardrails when routing is correct but behavior drifts.
5. Add fixtures for recurring uncovered prompt shapes.

## 7. Run full validation only when warranted

Run full real-model validation before release, after major model updates, or when the sample finds repeated failures.

```bash
node scripts/run-batch-experiment.mjs --phase 1 > .logs/model-update-batch-local-1.log 2>&1
node scripts/run-batch-experiment.mjs --phase 2 > .logs/model-update-batch-specialist-1.log 2>&1
node scripts/run-batch-experiment.mjs --phase 4 > .logs/model-update-batch-twopass-1.log 2>&1
node scripts/run-batch-experiment.mjs --phase 5 > .logs/model-update-batch-persona-1.log 2>&1
```

## 8. Use ablation only for prompt-cost or compliance regressions

```bash
node scripts/run-ablation.mjs --local --suite model-parity --trials 3 > .logs/model-update-ablation-local-1.log 2>&1
```

Use real ablation runs sparingly because they are expensive.

## Stop/go criteria

- **Accept:** unit tests pass, local smoke/parity pass, real-model sample has no repeated high-risk drift, and trace analysis has no recurring contract failures.
- **Tune:** repeated failures share one router or expert cause.
- **Rollback:** model update causes broad extraction failures, schema failures, or cross-target contract breakage.
