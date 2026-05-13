# Philosopher Maintenance PR #31 Feature Guide

This document explains each feature in PR #31, why it matters, and how it works. The PR turns philosopher maintenance from an informal practice into a repeatable operating workflow with concrete validation gates, trace evidence, model-parity checks, scorecards, and failure triage.

PR #31: `https://github.com/barretts/AgentHistoric/pull/31`

## 1. Model Update Validation Workflow

### What it adds

The PR adds a Windsurf workflow for validating philosopher personas after model or host updates.

Relevant file:

- `.windsurf/workflows/model-update-validation.md`

### Why it is important

The philosopher personas are prompt-driven. New model versions, CLI host changes, or prompt-system changes can alter routing, output contracts, extraction behavior, and persona fidelity even when the repository code has not changed.

The workflow gives operators a fixed procedure instead of relying on memory. It prevents reactive prompt tuning by requiring local gates, real-model samples, trace analysis, and explicit stop/go criteria before changing prompts.

### How it works

The workflow defines an ordered validation path:

1. Record update context.
2. Run local invariant gates.
3. Run cheap local behavioral checks.
4. Run a bounded real-model sample.
5. Analyze trace failures and distribution shift.
6. Apply the failure triage ladder before editing prompts.
7. Run full validation only when warranted.
8. Use ablation only for prompt-cost or compliance regressions.

It also defines stop/go outcomes:

- **Accept:** local gates pass, real sample has no repeated high-risk drift, and traces show no recurring contract failures.
- **Tune:** repeated failures share one router or expert cause.
- **Rollback:** the update causes broad extraction, schema, or cross-target contract breakage.

## 2. Model Update Scorecard Template

### What it adds

The PR adds a reusable scorecard template for every model or host update validation run.

Relevant file:

- `docs/experiments/model-update-scorecard-template.md`

### Why it is important

Model validation without a scorecard tends to scatter evidence across terminal output, memory, and ad hoc notes. That makes it hard to tell whether a model update was accepted, tuned, or rolled back for a principled reason.

The template forces each validation pass to capture the same evidence categories. This makes later comparisons possible and gives reviewers a concise audit trail.

### How it works

The template records:

- update context
- commands and log paths
- score summaries
- routing misses
- output-contract drift
- novel prompt coverage
- final decision and follow-up issues

Operators copy the template into a dated scorecard and fill it during validation.

## 3. Dated Scorecard Evidence for This PR

### What it adds

The PR includes the completed scorecard for the validation run that finished this branch.

Relevant file:

- `docs/experiments/model-update-scorecard-2026-05-13.md`

### Why it is important

This PR does not merely add process docs; it exercises the new process against real evidence. The dated scorecard shows what passed, what blocked, what was fixed, and what should be deferred.

That gives reviewers confidence that the maintenance workflow is practical, not just theoretical.

### How it works

The scorecard records:

- local build/test/model-parity gates
- real Cursor sample results
- direct Codex parity blocker
- CLR fallback results for Cursor and Crush
- evaluator normalization fix for handshake-contaminated selected expert lines
- minor Dennett draft-length drift
- distribution-shift result
- final decision: accept the current maintenance infrastructure and tune later for external/tooling issues

## 4. Failure Triage Ladder

### What it adds

The PR adds a documented ladder for diagnosing and fixing philosopher drift.

Relevant file:

- `docs/experiments/failure-triage-ladder.md`

### Why it is important

When a model update changes behavior, the tempting response is to edit prompts immediately. That can create broad overcorrections, regress unrelated experts, or mask fixture ambiguity as a router failure.

The triage ladder protects the system by enforcing the least invasive evidence-backed fix first.

### How it works

The ladder orders possible fixes from smallest to broadest:

1. **Fixture ambiguity:** mark defensible alternates with `ambiguousBetween`.
2. **Narrow boost signal:** raise confidence for an under-selected expert on specific phrases.
3. **Anti-trigger:** reduce over-selection when a misleading signal dominates.
4. **Expert guardrail adjustment:** fix behavior after correct routing.
5. **New regression fixture:** add recurring uncovered prompt shapes.
6. **Ablation or rewrite:** use measured deltas before broad prompt pruning or restructuring.

It also requires rebuild and unit-test verification after prompt-system or renderer edits.

## 5. Trace Prompt Capture

### What it adds

The PR updates trace records to include the original user prompt, not just a wrapped regression prompt snippet.

Relevant files:

- `scripts/lib/tracer.mjs`
- `scripts/lib/tracer.test.mjs`
- `scripts/run-regressions.mjs`

### Why it is important

Trace files are only useful for drift analysis if they preserve the prompt shape users actually asked. Wrapped regression prompts contain harness instructions, output schema requirements, and evaluation boilerplate. Those wrappers are not the real distribution of user requests.

Capturing `userPrompt` makes trace records useful for distribution-shift detection, fixture expansion, and post-run analysis.

### How it works

`run-regressions.mjs` passes `testCase.prompt` into trace creation. `tracer.mjs` stores it under:

```json
"prompt": {
  "userPrompt": "...",
  "wrappedSnippet": "..."
}
```

If an explicit user prompt is not supplied, the tracer can extract it from a wrapped prompt line matching `User prompt: ...`.

Unit tests verify that prompt extraction and trace serialization continue to work.

## 6. Distribution Shift Extraction Helpers

### What it adds

The PR adds helpers to extract prompts from both fixtures and traces.

Relevant files:

- `scripts/lib/distribution-shift.mjs`
- `scripts/lib/distribution-shift.test.mjs`

### Why it is important

Distribution-shift detection needs two sets of prompts:

- existing fixture prompts
- newly observed trace prompts

Without extraction helpers, shift analysis would require one-off scripts or fragile manual parsing. The helpers make trace ingestion a first-class library feature.

### How it works

The new helpers include:

- `promptsFromFixtures(fixtures)`: returns fixture prompts from `regression/fixtures/cases.json`.
- `extractUserPromptFromWrappedPrompt(prompt)`: recovers the user prompt from wrapped harness text.
- `extractUserPromptsFromTraces(traces)`: extracts and deduplicates prompts from trace records.

`formatShiftReport()` also includes trace file paths so reports can be traced back to their evidence source.

## 7. Distribution Shift CLI

### What it adds

The PR adds a command-line tool for analyzing prompt distribution shift from trace files.

Relevant file:

- `scripts/analyze-distribution-shift.mjs`

Package script:

- `npm run analyze:shift`

### Why it is important

As models and users change, the prompt shapes seen in real use may drift away from the regression fixtures. If fixtures do not represent real usage, a green test suite can become misleading.

The CLI helps detect when new traces contain prompt shapes that are novel relative to the current fixture set.

### How it works

The CLI:

1. Loads regression fixtures.
2. Finds trace files from `.logs/traces/`.
3. Extracts user prompts from traces.
4. Runs distribution-shift detection against fixture prompts.
5. Writes or prints a Markdown report.

It supports:

- positional trace files
- `--all`
- `--run-id`
- `--output` / `-o`

The report includes whether shift was detected, classifier accuracy, novel prompts, and source trace files.

## 8. Local Regression Mode

### What it adds

The PR adds local synthetic execution support to the regression runner.

Relevant files:

- `scripts/run-regressions.mjs`
- `scripts/lib/regression.mjs`

### Why it is important

Real-model validation is slow, expensive, and subject to CLI/network failures. Local mode gives operators a cheap way to verify that the regression harness, trace logging, summary generation, and score formatting all work before spending real-model budget.

Local mode is not meant to prove model behavior. It is a scaffolding and invariant check.

### How it works

When `--local` is passed, `run-regressions.mjs` calls `buildLocalResponse()` instead of invoking Cursor or Codex. The synthetic response mirrors the shape expected from a real model and can be scored, traced, judged, and summarized by the same harness.

The model-update workflow uses local smoke/parity gates before real sampling.

## 9. Model-Parity Package Scripts

### What it adds

The PR adds first-class package scripts for model-parity validation.

Relevant file:

- `package.json`

Scripts:

- `test:model-parity`
- `test:model-parity:real`
- `analyze:shift`

### Why it is important

A validation command that is easy to run is more likely to be run consistently. Package scripts also encode the intended defaults so operators do not have to remember long command lines.

This makes model parity part of the normal maintenance surface instead of an expert-only workflow.

### How it works

`test:model-parity` runs the model-parity suite locally with tracing and judge attachment.

`test:model-parity:real` runs the same suite against real configured targets.

`analyze:shift` invokes the distribution-shift CLI.

## 10. Evaluator Normalization for Real-Model Handshake Drift

### What it adds

The PR hardens expert-id normalization so a selected expert line can include extra real-model text after the canonical expert id.

Relevant files:

- `scripts/lib/regression.mjs`
- `scripts/lib/regression.test.mjs`

### Why it is important

Real models sometimes include local rule handshakes or explanatory text in fields that the harness expects to be clean. During validation, Cursor produced:

```text
Selected Expert: expert-engineer-peirce [rules:loaded init router experts@12]
```

The selected expert was semantically correct, but the evaluator initially scored it as a routing miss because the string did not exactly equal `expert-engineer-peirce`.

This was a harness robustness bug, not a philosopher failure.

### How it works

`normalizeExpertId()` now extracts the first canonical-looking `expert-*` id from the value. This preserves strict canonical ids while tolerating appended handshake tokens or harmless suffix text.

A regression test verifies that `evaluateResponse()` treats the handshake-contaminated line as a correct routing match.

## 11. Narrow Descartes Boost Signals

### What it adds

The PR adds targeted boost signals for Descartes routing.

Relevant files:

- `prompt-system/router.json`
- generated router artifacts under `compiled/*`

Boost signals:

- `trust boundaries`
- `data constraints`
- `bedrock`

### Why it is important

Validation exposed a case where foundational architecture prompts could fall toward a more generic engineering route. Descartes should win when a prompt is asking for foundational constraints, trust boundaries, or bedrock assumptions.

The fix is intentionally narrow to avoid creating a Descartes attractor that steals unrelated implementation work.

### How it works

The boost signals are added to the Foundational Architecture routing heuristic. When these phrases appear, they raise confidence for `expert-architect-descartes` without changing the broader routing architecture.

The generated artifacts are rebuilt so every host target receives the updated router text.

## 12. Generated Router Artifacts

### What it adds

The PR includes regenerated router artifacts for supported targets.

Relevant paths:

- `compiled/claude/rules/01-router.md`
- `compiled/codex/AGENTS.md`
- `compiled/crush/rules/01-router.md`
- `compiled/cursor/rules/01-router.mdc`
- `compiled/gemini/rules/01-router.md`
- `compiled/windsurf/rules/01-router.md`

### Why it is important

The canonical router source is `prompt-system/router.json`, but host tools consume generated artifacts. Including the generated files keeps the PR reviewable and immediately runnable.

It also satisfies the project convention that prompt-system changes should be followed by prompt rebuilds and tests.

### How it works

After updating `prompt-system/router.json`, `npm run build:prompts` regenerates each host-specific output target. The generated router files reflect the new Descartes boost signals.

## 13. Trace Failure Analysis Integration

### What it adds

The workflow and scorecard now make trace analysis part of the model-update validation loop.

Relevant files:

- `.windsurf/workflows/model-update-validation.md`
- `docs/experiments/model-update-scorecard-template.md`
- `docs/experiments/model-update-scorecard-2026-05-13.md`
- existing `scripts/analyze-traces.mjs`

### Why it is important

Raw regression summaries show individual pass/fail outcomes. Trace analysis groups recurring failure patterns so operators can distinguish isolated failures from systematic drift.

This is critical for avoiding overreaction to one-off model quirks.

### How it works

The workflow directs operators to run trace analysis after real sampling. The scorecard records trace-analysis logs and classifies failures before prompt changes are made.

In the PR #31 validation run, trace analysis surfaced:

- a parser issue for handshake-contaminated selected expert output, fixed in the evaluator
- a minor Dennett draft-length drift, documented but not tuned from a single occurrence

## 14. Real-Model Validation Evidence

### What it adds

The PR includes a completed validation record from both local and real-model paths.

Relevant file:

- `docs/experiments/model-update-scorecard-2026-05-13.md`

### Why it is important

A maintenance workflow should prove that it can handle real model behavior, including messy partial failures and host-specific blockers.

This PR records real validation rather than only local tests.

### How it works

The scorecard records:

- Cursor bounded real sample: 7 cases, routing correct after evaluator normalization, one minor Dennett concision drift.
- Direct Codex parity: blocked because the installed Codex CLI rejected default `gpt-5.5`.
- CLR fallback: Cursor `17/17`; Crush `16/17` extracted/routed with one JSON escaping extraction failure.

The decision is to accept the maintenance infrastructure and defer tuning for external/tooling issues unless failures repeat.

## 15. Follow-Up Tracking

### What it adds

The PR explicitly records non-blocking follow-up work.

Relevant file:

- `docs/experiments/model-update-scorecard-2026-05-13.md`

### Why it is important

Not every observed issue should block landing. Some are environment/tooling problems, and some are isolated model behavior that needs repetition before prompt tuning.

Documenting follow-ups keeps the PR honest without expanding its scope.

### How it works

The scorecard lists follow-ups:

- upgrade or pin Codex CLI/model before relying on direct Codex parity
- rerun or harden Crush `MI3b` extraction
- investigate PN4 Dennett concision only if repeated

## Current Status

### Completed

- Maintenance workflow added.
- Scorecard template added.
- Dated scorecard evidence added.
- Failure triage ladder added.
- Trace prompt capture added.
- Distribution-shift helpers and CLI added.
- Local regression mode added.
- Model-parity scripts added.
- Evaluator normalization fixed for real handshake suffixes.
- Narrow Descartes boost signals added.
- Generated router artifacts rebuilt.
- PR #31 created and pushed.

### Known limitations

- Direct Codex real parity is blocked by installed CLI/model compatibility.
- Crush CLR parity had one JSON extraction failure.
- PN4 showed one minor Dennett draft-length drift.
- The scorecard recommends tuning later only if these issues repeat or become release blockers.

## Recommended Reviewer Reading Order

1. `.windsurf/workflows/model-update-validation.md`
2. `docs/experiments/model-update-scorecard-2026-05-13.md`
3. `docs/experiments/failure-triage-ladder.md`
4. `scripts/analyze-distribution-shift.mjs`
5. `scripts/lib/tracer.mjs`
6. `scripts/lib/distribution-shift.mjs`
7. `scripts/run-regressions.mjs`
8. `scripts/lib/regression.mjs`
9. `prompt-system/router.json`
10. generated `compiled/*` router artifacts

## Summary

PR #31 makes philosopher maintenance observable and repeatable. Its main contribution is not a single prompt tweak; it is an operating system for future model updates: run fixed gates, collect traces, detect shift, classify failures, apply the smallest justified fix, and record the decision in a scorecard.
