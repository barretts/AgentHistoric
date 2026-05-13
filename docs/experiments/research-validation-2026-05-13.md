# Research Validation — 2026-05-13

Validated the current research-feature scaffolding for verbalized sampling and variable substitution, then added a safe local regression path so future smoke checks do not accidentally invoke external CLIs.

## Baseline

- Unit tests: `npm run test:unit` passed, **283/283** tests.
- Prompt build: `npm run build:prompts` passed with variable substitution enabled.
- Initial repo state: clean before implementation.

Logs:

- `.logs/research-baseline-test-unit-1.log`
- `.logs/research-baseline-build-prompts-1.log`
- `.logs/research-after-local-regression-test-unit-1.log`

## Implementation change

`node scripts/run-regressions.mjs --local ...` now uses the existing synthetic `buildLocalResponse()` path instead of invoking Cursor/Codex.

Reason:

- The first smoke attempt used `npm run test:regressions:smoke`, which invoked Codex and failed before producing a useful local validation baseline.
- `parseArgs()` already exposed `--local`, but `run-regressions.mjs` did not honor it.
- The local path writes the synthetic response envelope to the same raw log path and scores it through the normal evaluator.

Verified with:

- `node scripts/run-regressions.mjs --local --suite smoke --targets cursor,codex --trials 3`
- `node scripts/run-regressions.mjs --local --suite full --targets cursor --cases TP5,SP-Li1,SP-Si1,SP-Si2 --trials 3 --verbalized-sampling`
- `npm run test:unit`

## Verbalized Sampling validation

Local A/B command:

```bash
node scripts/run-ablation.mjs --local --suite full --trials 3 --targets cursor --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
```

Result:

- Report: `.logs/ablation-report-2026-05-13T03-42-53-633Z.md`
- Control mean: **2.0**
- VS-on mean: **2.0**
- pass^k delta: **0.00**
- verdict: **REVIEW**
- added prompt cost: **4,991 chars** (`charsSaved: -4991`)

Interpretation:

- Local mode proves the scaffolding works, but it cannot prove behavioral lift because the synthetic router does not depend on rendered prompt artifacts.
- The real `crush` run below is the decision gate for behavioral impact.

Schema check:

```bash
node scripts/run-regressions.mjs --local --suite full --targets cursor --cases TP5,SP-Li1,SP-Si1,SP-Si2 --trials 3 --verbalized-sampling
```

Result:

- Report: `.logs/regression-summary-2026-05-13T03-43-51-624Z.md`
- Cases: **4**
- Trials: **12** total
- Score sum: **24/24**
- Behavioral/schema findings: **none**

Real-LLM A/B command:

```bash
node scripts/run-ablation.mjs --via-clr --suite full --trials 3 --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
```

Result:

- Report: `.logs/ablation-report-2026-05-13T03-44-44-591Z.md`
- Control mean: **2.0**
- VS-on mean: **1.92**
- pass^k delta: **-1.00**
- over-engineering delta: **+0.02**
- concision delta: **0.00**
- verdict: **REVIEW**
- added prompt cost: **4,991 chars** (`charsSaved: -4991`)

Interpretation:

- Verbalized sampling did **not** improve the targeted Descartes-attractor cases in this `crush` run.
- The VS-on condition was slightly worse by mean score and pass^k while increasing prompt size.
- Current evidence does not support enabling verbalized sampling by default.

## Variable Substitution validation

Measurement command compared VS-on generated artifacts against VS-off generated artifacts.

Result:

```json
{
  "vsOnChars": 435657,
  "vsOffChars": 442262,
  "charsSaved": 6605,
  "percentSaved": 1.49,
  "artifactCount": 83
}
```

Interpretation:

- Current variable substitution saves **1.49%**, far below the project target of **>10%**.
- This does not justify claiming token-cost success yet.
- Either expand substitution/compression substantially or reclassify it as a minor maintainability mechanism rather than a token-saving research win.

## Local regression baseline

Command:

```bash
node scripts/run-regressions.mjs --local --suite smoke --targets cursor,codex --trials 3
```

Result:

- Report: `.logs/regression-summary-2026-05-13T03-43-22-586Z.md`
- Cases: **4**
- Targets: **cursor, codex**
- Trials/results: **24**
- Score sum: **48/48**
- Target parity: **4/4 equivalent**

## Distribution shift analysis

Command:

```bash
node scripts/analyze-distribution-shift.mjs --all --output .logs/implement-plan-shift-report-2.md
```

Result:

- Shift detected: **No**
- Shift score: **marginal**
- Classifier accuracy: **63.6%**
- New prompts analyzed: **17**
- Novel prompts found: **4**
- Trace file: `.logs/traces/traces-2026-05-13.ndjson`

Novel prompt candidates for future fixture coverage:

- `Refactor this function to remove duplication and add tests.`
- `Memory usage is high in the worker process. Benchmark this and find the allocation hotspot.`
- `Should we build this new notification service? Design the system from scratch.`
- `Refactor the auth module to extract the token validation into a separate module and reduce coupling.`

## Decision record

- **Keep local regression mode:** yes. It closes a validation safety gap and prevents accidental external CLI runs when a local baseline is intended.
- **Verbalized Sampling:** do not enable by default. Scaffolding and schema pass locally, but the real `crush` A/B did not show lift and carried a 4,991-character prompt cost.
- **Variable Substitution:** not a token-saving win in current form. At **1.49%**, it fails the `>10%` ship criterion.

## Recommended next research direction

- Do not add another routing mechanism until the current prompt-cost work has a stronger target.
- Treat variable substitution as below threshold unless a follow-up compression pass can move savings from **1.49%** toward the **>10%** criterion.
- Use the four distribution-shift novel prompts as candidates for fixture expansion before the next real-LLM experiment.
- If pursuing a new research feature, prefer thin-vs-rich persona ablation or selective debate routing over further verbalized-sampling expansion.
