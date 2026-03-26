# Dual-Target Philosopher Prompt System

This repo maintains a philosopher-based prompt system that can be rendered to both Cursor and Codex targets from one canonical source, then regression-tested against both runtimes.

## Layout

- `prompt-system/philosopher-system.json`: canonical source of truth
- `.cursor/rules/*.mdc`: generated Cursor rules
- `.codex/AGENTS.md`: generated Codex runtime
- `.codex/skills/*/SKILL.md`: generated Codex skills
- `regression/fixtures/cases.json`: machine-readable regression cases
- `regression/output-schema.json`: enforced structured output contract for Codex runs
- `scripts/build-prompt-system.mjs`: generator for Cursor and Codex bundles
- `scripts/run-regressions.mjs`: shared regression runner
- `.logs/`: raw run logs and generated summaries

## Generate Targets

```bash
npm run build:prompts
```

This regenerates:

- `.cursor/rules/`
- `.codex/AGENTS.md`
- `.codex/skills/`

Make prompt-system changes in the canonical JSON first, then regenerate.

## Fast Verification

Run the deterministic verification layer before any live target regressions:

```bash
npm run test:unit
```

This covers:

- generated artifact drift for `.codex/AGENTS.md`, `.cursor/rules/*.mdc`, and `.codex/skills/*/SKILL.md`
- fixture-driven routing expectations
- evaluator behavior against canned responses

Use this to prove prompt-layer changes are structurally safe before running expensive Cursor or Codex regressions.

## Run Regressions

Smoke suite:

```bash
npm run test:regressions:smoke
```

Full suite:

```bash
npm run test:regressions
```

Target filtering:

```bash
node scripts/run-regressions.mjs --suite smoke --targets cursor
node scripts/run-regressions.mjs --suite full --targets codex
```

Model overrides:

```bash
node scripts/run-regressions.mjs --suite smoke --cursor-model gpt-5.4-medium --codex-model gpt-5.3-codex-low
```

## What The Runner Checks

For each case and target, the runner records and evaluates:

- selected expert
- output sections used
- confidence or uncertainty labeling
- whether persona blending occurred
- whether the answer stayed in scope
- a 0/1/2 score
- explicit evaluator findings such as wrong expert selection, missing sections, invalid handoffs, and blended headings

Structured output validity is still required, but the final score is now backed by an evaluator that checks the actual response body against fixture expectations and expert contracts.

It also produces a parity comparison between Cursor and Codex for the same case.

## Output

Each run writes:

- raw per-case logs to `.logs/regression-*.log`
- a machine-readable summary to `.logs/regression-summary-*.json`
- a human-readable summary to `.logs/regression-summary-*.md`

## Interpreting Scores

- `2`: correct expert, correct structure, correct depth
- `1`: mostly correct but drifted
- `0`: wrong expert or wrong structure

Failures should generally be fixed in the prompt layer first, not by weakening the regression expectations.

## Adding A New Expert

1. Add the expert to `prompt-system/philosopher-system.json`.
2. Regenerate the target artifacts with `npm run build:prompts`.
3. Add or update regression cases in `regression/fixtures/cases.json`.
4. Run at least the smoke suite.

## Adding A New Regression Case

Add a new object to `regression/fixtures/cases.json` with:

- `id`
- `category`
- `name`
- `targets`
- `prompt`
- `expectedPrimaryExpert`
- `expectedSections`
- `allowedHandoffs`
- `forbiddenBehaviors`

Then include the case id in `suites.smoke` or `suites.full`.

## Current Verification Workflow

1. Regenerate prompt bundles from the canonical spec.
2. Run `npm run test:unit`.
3. Run the smoke suite first.
4. Inspect `.logs/regression-summary-*.md`.
5. Run the full suite.
6. Compare parity deltas and adjust the prompt layer if drift is systematic.
