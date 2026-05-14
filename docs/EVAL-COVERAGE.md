# AgentHistoric Eval Coverage

This is the index of what we currently evaluate, the command surface to run each, and the planned next wave of methodologies (Phase 8). It is the runtime companion to the phase plans in [`plans/README.md`](plans/README.md).

> **Naming note.** "Phase 8" in this document refers to **Eval Methodology Continuation** — the deferred items from Phase 7 (`plans/PHASE-7-STATS-AND-JUDGE-CALIBRATION.md`) plus the deferred routing experiments from `research-notes.md`. A separate parallel plan at `plans/PHASE-8-SCION-CROSS-POLLINATION.md` covers target/harness expansion and is unrelated to this roadmap.

---

## At a Glance

| Coverage type | Layer | Primary command | Output / report |
|---|---|---|---|
| Prompt build & render smoke | Pre-flight | `npm run build:prompts` | `dot-claude/`, `dot-cursor/`, `dot-windsurf/`, `dot-codex/` |
| Unit tests (libs + stats) | Pre-flight | `npm run test:unit` | Node `--test` TAP output |
| Behavioral regressions (single-trial) | Offline eval | `npm run test:regressions:smoke` / `npm run test:regressions` | `.logs/regressions-*/` |
| Multi-trial pass@k / pass^k | Offline eval | `npm run test:regressions -- --trials N` | `pass@k`, `pass^k` per case |
| CLR (real-LLM) regressions | Offline eval | `npm run test:regressions:clr` / `:smoke` | `.logs/regressions-*/run.json` |
| Model parity | Cross-model | `npm run test:model-parity` / `:real` / `:strict` | `parity` section in regression summary |
| LLM-as-judge (pointwise) | Grading | `npm run test:regressions:smoke -- --judge` | `judge` rubric scores per response |
| LLM-as-judge (pairwise, position-swap) | Grading | `... --judge --judge-mode pairwise` | Normalized winner + position-bias flag |
| Cross-family judge enforcement | Grading | default; opt out with `--allow-same-family` | Run aborts on same-family judge/subject |
| Judge calibration (Cohen's κ) | Grading guardrail | `npm run calibrate:judge` | `regression/judge-calibration/report.{json,md}` |
| Calibration gate | CI | `... --judge --require-calibrated-judge` | Non-zero exit on κ below floor |
| Ablation testing | Prompt architecture | `npm run test:ablation` | `.logs/ablation-*/ablation-report.md` |
| Paired ablation statistics | Prompt architecture | `npm run test:ablation:stats` | Adds `p (Holm)` + `95% CI` columns |
| Integrity gate (SRM + null/missing) | Run validation | implicit on regressions & ablations | Run flagged as `invalid` if checks fail |
| Compliance audit (transcripts) | Post-hoc | `node scripts/run-compliance-audit.mjs --input <dir>` | `.logs/compliance-<ts>/` |
| Distribution-shift detection | Drift | `npm run analyze:shift` | TF-IDF / LR divergence vs. fixtures |
| Trace analysis | Observability | `node scripts/analyze-traces.mjs` | Failure clustering, trend lines |
| Experiments harness | Research | `npm run test:experiment` and `scripts/run-*-experiment.mjs` | Per-experiment `.logs/experiments-*/` |

All commands honor the **Non-Destructive Logging Protocol**: each writes a full transcript under `.logs/` before any summary is printed. Inspect the log file, do not re-run, when triaging.

---

## 1. Pre-Flight: Build & Unit

### 1.1 Prompt build / render smoke
`npm run build:prompts` rebuilds the per-IDE artifacts (`dot-claude/`, `dot-cursor/`, `dot-windsurf/`, `dot-codex/`) from `prompt-system/` JSON. The build itself is the structural smoke: missing references, malformed rubrics, or expert-id collisions fail here before any LLM is called.

Variants:

- `npm run build:prompts:release` — debug commentary stripped.
- `npm run build:prompts:debug` — verbose render with section-level diagnostics.

### 1.2 Unit tests
`npm run test:unit` runs every `scripts/lib/*.test.mjs`, which currently covers:

- `stats.test.mjs` — McNemar, Wilcoxon, percentile bootstrap, Holm/BH, SRM, Cohen's κ.
- `regression.test.mjs` — paired record construction, integrity checks, ablation verdicts.
- `eval-judge.test.mjs` — pairwise normalization, position-bias detection, cross-family enforcement.
- Other library tests (router, behavioral metrics, distribution shift, tracer).

This layer is fast (single-digit seconds) and is the only gate that must pass before anything below it.

---

## 2. Offline Behavioral Regressions

### 2.1 Single-trial regression suite
`npm run test:regressions:smoke` (quick) and `npm run test:regressions` (full) execute `regression/fixtures/cases.json` against the configured targets, scoring each response with:

- Expert routing checks.
- Behavioral guardrail metrics (over-engineering, concision, anchor-word presence).
- Optional LLM-as-judge rubrics (`--judge`).

Useful flags:

- `--targets cursor,codex,claude` — limit / expand harness coverage.
- `--suite smoke|full|model-parity` — pick a fixture subset.
- `--local` — synthetic responses, no API calls (good for routing-only diffs).
- `--trace` — write `.logs/traces/traces-<runId>.ndjson` for downstream tools.

### 2.2 Multi-trial: pass@k and pass^k
Adding `--trials N` (typical: 3–10) runs each case `N` times and reports:

- **`pass@k`** — fraction of cases where at least one trial passes (capability ceiling).
- **`pass^k`** — fraction of cases where every trial passes (consistency floor).

`pass^k` is the more honest production proxy; `pass@k - pass^k` is the non-determinism band.

### 2.3 CLR-driven real-LLM regressions
`npm run test:regressions:clr[:smoke]` swaps the synthetic runner for `cli-runner-learner`, exercising real CLIs (Cursor, Codex, Claude Code, etc.) with retry/healing. Use this when validating end-to-end harness behavior, not just prompt logic.

### 2.4 Model parity
`npm run test:model-parity` (local), `:real`, and `:strict` run the parity fixture across two or more targets and surface routing or behavior drift. `--parity-only` constrains the summary to comparable cases.

---

## 3. LLM-as-Judge Grading

### 3.1 Pointwise rubrics
`--judge` attaches the built-in rubrics (`factual-grounding`, `instruction-following`, etc., defined in `scripts/lib/eval-judge.mjs`) to each response. Each rubric returns a 0/1 verdict plus a critique.

### 3.2 Pairwise with position swap
`--judge-mode pairwise` runs control vs. treatment in both orderings (A vs. B and B vs. A). `judgePairwise()` normalizes back to original-response coordinates and returns one of:

- `{ winner: "control" | "treatment" | "tie", swapConsistent: true }` — trust this result.
- `{ winner: "tie", positionBiasDetected: true }` — order matters, do not credit either side.

### 3.3 Cross-family enforcement
By default the judge model must come from a different family than the subject model (configured in `regression/judge-config.json`). Same-family combinations fail closed to prevent self-enhancement bias. Override with `--allow-same-family` for exploratory runs only.

### 3.4 Critique-Shadowing few-shot
When `regression/judge-calibration/gold/<rubric>.jsonl` exists, the judge prompt is augmented with up to N human-labeled critiques per rubric. This is the calibration mechanism for the judges — see §4.

---

## 4. Judge Calibration

### 4.1 Why
LLM-as-judge has known biases: position, verbosity, self-enhancement, and provenance/recency. We mitigate via pairwise position-swap (§3.2), cross-family routing (§3.3), and Critique-Shadowing few-shot injection (§3.4). Calibration quantifies how well the judge agrees with human labels.

### 4.2 How
1. Domain expert labels gold examples under `regression/judge-calibration/gold/<rubric>.jsonl` following `regression/judge-calibration/protocol.md` (binary pass/fail + critique).
2. `npm run calibrate:judge` runs the judge against gold and writes:
   - `regression/judge-calibration/report.json` — per-rubric Cohen's κ and confusion matrix.
   - `regression/judge-calibration/report.md` — reviewer-friendly summary.
3. `regression/judge-config.json` declares the kappa floor (default `0.4`).

### 4.3 Gates
- Default: regression runs **warn** if calibration is missing or below floor.
- CI: pass `--require-calibrated-judge` to make missing or sub-floor calibration **fail the run**.

---

## 5. Ablation Testing

### 5.1 Mechanic
`npm run test:ablation` re-runs the configured target set with one prompt section removed at a time (the section catalogue lives in `scripts/lib/regression.mjs`). The output (`.logs/ablation-*/ablation-report.md`) shows per-section deltas and a verdict (`KEEP` / `REMOVE` / `REVIEW`).

Common flags:

- `--local` — synthetic mode; structural deltas only (no behavioral signal).
- `--sections behavioral-guardrails,uncertainty-rules` — limit to specific sections.
- `--targets cursor` and `--trials N` — match the regression surface.

### 5.2 Paired statistics — `--paired-stats`
`npm run test:ablation:stats` enables the statistical pipeline:

1. Build explicit paired records keyed by `{caseId, trialIndex, target, model, seed}`. Unpaired observations are dropped and reported.
2. **McNemar** (exact, with Chi-square fallback) on strict pass/fail outcomes.
3. **Wilcoxon signed-rank** + **percentile bootstrap CI** on continuous behavioral deltas.
4. **Holm correction** of the primary p-values across ablated sections.
5. Verdict logic: a section earns `KEEP` only when the Holm-adjusted primary test is significant *and* removing the section worsens strict pass behavior or guardrails. Otherwise it stays `REVIEW`.

The report adds `p (Holm)` and `95% CI` columns. Noise no longer promotes or removes sections.

---

## 6. Integrity Gate

`runIntegrityChecks()` runs implicitly inside both `run-regressions.mjs` and `run-ablation.mjs` before any statistical interpretation is performed. It invalidates a run when:

- **SRM**: variant allocations diverge from expected ratios (default uniform).
- **Missing trials**: requested `N` trials did not all materialize for a case.
- **Malformed score envelopes**: required fields missing or wrong types.
- **Mixed null/numeric judge scores**: a rubric has both `null` and numeric verdicts in the same run.

When the gate fires, the summary is marked `invalid` and stats/verdicts are suppressed. This is a pre-condition for trustworthy reporting downstream.

---

## 7. Compliance Audit (Transcript-Based)

`node scripts/run-compliance-audit.mjs --input <transcripts-dir>` scans a directory of recorded transcripts (e.g., a CLR run output, an `agent-transcripts/` slice, or a CI artifact directory) and grades each session against the active compliance ruleset. It writes to `.logs/compliance-<ts>/` by default (override with `--output`).

Use this when you already have transcripts and want to retroactively grade compliance with new rules — without re-running any LLM.

---

## 8. Drift & Observability

### 8.1 Distribution-shift detection
`npm run analyze:shift` extracts user prompts from `.logs/traces/*.ndjson` and compares them against the fixture corpus using TF-IDF + logistic regression. The report highlights:

- **Novel prompts** — high-divergence inputs not represented in fixtures.
- **Repetitive prompts** — clusters that may be over-represented in production.

This is the early-warning signal that fixtures are going stale.

### 8.2 Trace analysis
`node scripts/analyze-traces.mjs [--all | --run-id <id> | <file>]` reads `.logs/traces/*.ndjson` and clusters failures by routing target, expert, and metric. Use it to triage a regression-run blip without rerunning.

### 8.3 Producing traces
Any regression or ablation run with `--trace` emits NDJSON traces under `.logs/traces/` keyed by run id. The same traces feed §8.1 and §8.2.

---

## 9. Experiments Harness

Scripts under `scripts/run-*-experiment.mjs` plus `npm run test:experiment` exist for one-off research:

- `run-experiment.mjs` — single experiment runner with custom prompt overlay.
- `run-batch-experiment.mjs` — sweeps over experiment manifests.
- `run-compliance-experiment.mjs` — compliance-rule perturbation studies.

These are not part of the promotion gate; they live in `.logs/experiments-*/` and feed `docs/experiments/`.

---

## Promotion Decision Policy

A prompt change is eligible for promotion only when **all** of the following hold:

1. `npm run test:unit` passes.
2. `npm run build:prompts` passes on every target.
3. `npm run test:regressions` (or the appropriate suite) passes with no integrity-gate violations.
4. If `--judge` is used: judge calibration is current and κ ≥ floor for every rubric scored.
5. If ablation evidence is being claimed: `--paired-stats` shows Holm-adjusted significance on the primary metric and no guardrail regression.
6. Distribution-shift report shows no unaddressed novel-prompt cluster relative to fixtures.

Anything below this bar lands as **REVIEW**, not REMOVE/KEEP.

---

# Phase 8 — Eval Methodology Continuation

The methodologies below are explicitly out of scope for Phase 7 and form the next wave. Each entry lists trigger, intended location, and an exit criterion. Sequencing is suggested, not strict — items inside a slice can parallelize.

> Disambiguation: `plans/PHASE-8-SCION-CROSS-POLLINATION.md` is a separate Phase 8 about renderer/harness expansion (claude, gemini, opencode). This Phase 8 is about evaluation methodology.

## Slice C — Statistical Depth

| Item | What | Why now | Exit criterion |
|---|---|---|---|
| C1. BCa bootstrap intervals | Replace percentile bootstrap with bias-corrected accelerated intervals in `scripts/lib/stats.mjs`. | Percentile CIs are loose on skewed metrics like over-engineering deltas. | `bootstrapCI(..., { method: "bca" })` covered by unit tests + adopted in ablation report. |
| C2. CUPED / variance reduction | Pre-period covariate adjustment for behavioral deltas. | Sharpens CIs without more trials when historical signal exists. | CUPED adjustment plumbed through `applyAblationStatistics`, opt-in via flag. |
| C3. Sequential testing (SPRT / mSPRT) | Early-stop regression runs once an effect is clearly (in)significant. | Wall-clock and token cost of full sweeps. | `scripts/lib/sequential.mjs` + `--sequential` flag on `run-regressions.mjs`. |
| C4. Live-traffic A/B harness | Move from offline ablation to shadow / canary comparisons on production transcripts. | Phase 7 gates promote candidates; we still cannot watch them in vivo. | `scripts/run-shadow-eval.mjs` consuming `.logs/traces/` with paired-trial accounting. |

## Slice D — Judge & Grading Depth

| Item | What | Why now | Exit criterion |
|---|---|---|---|
| D1. Verbalized Sampling | When the router is ambiguous, force the model to emit a probability distribution over candidate experts and sample from tails. | `research-notes.md` §5 — 1.6–2.1× diversity gain, training-free. | Router config flag + regression cases that assert tail sampling under ambiguity. |
| D2. Panel / multi-judge selection | Aggregate independent judges with a meta-judge; majority + critique. | `research-notes.md` §7 — win-rate 0.810 vs. blended committee. | `--judge-panel <model-list>` and a panel aggregator with kappa-aware weights. |
| D3. Adaptive rubrics | Have the judge propose rubric refinements when calibration drifts, gated by human review. | Static rubrics drift as model behavior changes. | Calibration report includes proposed rubric deltas + reviewer approval workflow. |
| D4. Stateful / multi-turn eval | Score dialogue trajectories, not just single responses. | Today's judge is single-turn. | Multi-turn fixture format + judge that consumes the trajectory. |

## Slice E — Prompt Optimization & Synthesis

| Item | What | Why now | Exit criterion |
|---|---|---|---|
| E1. DSPy / GEPA / AdalFlow auto-optimization | Treat prompts as parameters; optimize against the regression score. | Phase 7 makes the score trustworthy enough to optimize against. | A reproducible optimizer run that improves `pass^k` on the smoke suite without guardrail regression. |
| E2. Renewable benchmark synthesis | Generate new fixtures from `.logs/traces/` and the distribution-shift "novel" cluster. | §8.1 already names the gap; synthesis closes it. | `scripts/synthesize-fixtures.mjs` + human-review queue. |
| E3. Thin vs. Rich persona ablation | Use Phase 6/7 ablation infra to A/B thin (name + 3 axioms + 2 guardrails) vs. rich personas. | `research-notes.md` §8 — irrelevant persona details cost ~30 pts. | Paired-stats ablation showing per-expert verdict. |
| E4. Dynamic micro-roles | Generate task-specific sub-roles under existing archetypes. | `research-notes.md` §9 — fine-grained > fixed coarse. | Two-pass router emits micro-role + parent expert; regression cases enforce both. |

## Slice F — Robustness & Red-Team

| Item | What | Why now | Exit criterion |
|---|---|---|---|
| F1. Prompt-injection suite | Adversarial inputs embedded in user content / file content. | Coverage gap called out in Phase 7 deferred. | Dedicated fixture file + judge rubric for refusal / extraction behavior. |
| F2. Metamorphic testing | Mutate inputs (paraphrase, reorder, casing, redundant fluff) and assert routing/behavior invariance. | Catches brittleness that smoke cannot. | `scripts/run-metamorphic.mjs` + invariance report. |
| F3. Negative-constraint / ROSE prompting | Suppress mainstream/personae by subtracting reverse-prompt overlap. | `research-notes.md` §10 — up to +13.98% safety score. | Two-generation pipeline + paired-stats win on the bias fixture slice. |
| F4. Selective debate routing (iMAD-style) | Hesitation classifier triggers debate only when needed. | `research-notes.md` §6 — 92% token saving, +13.5% accuracy. | Classifier-gated council fixture with paired-stats showing net positive. |

## Slice G — Operational & Cost

| Item | What | Why now | Exit criterion |
|---|---|---|---|
| G1. Per-eval cost & latency budget | Track tokens, USD, and wall-clock per case and surface them next to scores. | We currently report quality without cost; tradeoffs are invisible. | Cost columns in regression and ablation reports + budget-violation gate. |
| G2. Eval-gate CI workflow | Wire smoke + judge + integrity-gate into a GitHub Actions / equivalent stage. | The infra exists; CI doesn't enforce it yet. | A required CI check that fails on integrity, judge-κ, or paired-stats regression. |
| G3. Production telemetry hooks | Define what counts as a "live failure" and how it flows back into fixtures. | Closes the loop from prod -> distribution-shift -> synthesis (E2). | Schema for telemetry events + ingestion script populating `.logs/traces/`. |

## Sequencing Suggestion

```
C1, C2 ──┐
C3       │
C4 ──────┼─► G2 (CI eval gate)
D1, D2 ──┤
D3, D4   │
E1, E2 ──┴─► E3, E4 ──► F1..F4 ──► G1, G3
```

C and D are independent and unlock E. F depends on F's own primitives (mutation, classifier) but does not block E. G2 is the integration capstone that turns all of the above into a default promotion gate.

---

## Cross-References

- Phase 5 — Eval Maturity: `plans/PHASE-5-EVAL-MATURITY.md`
- Phase 6 — Ablation Testing: `plans/PHASE-6-ABLATION-TESTING.md`
- Phase 7 — Statistical Rigor & Judge Calibration: `plans/PHASE-7-STATS-AND-JUDGE-CALIBRATION.md`
- Phase 8 (parallel track, target/harness expansion): `plans/PHASE-8-SCION-CROSS-POLLINATION.md`
- Research backbone: `research/02-EVAL-STACK-RECONSTRUCTION.md`, `research-notes.md`
- Judge protocol: `regression/judge-calibration/protocol.md`
- Judge runtime config: `regression/judge-config.json`
