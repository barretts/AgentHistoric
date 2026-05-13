# Philosophical Steering Experiment State

This document captures the current state of the philosophical steering experiment after adding two-axis persona/philosophy scoring and beginning real CLI trials.

## Branch and Worktree

- **Worktree:** `/home/barrett/code/AgentHistoric-philosophy-680c08`
- **Branch:** `philosophy-steering-680c08`
- **Purpose:** Isolate the philosophical-steering implementation from the shared worktree.

## Implemented Changes

- **Persona axis:** Added `persona-stance-fidelity` as a built-in judge rubric.
- **Philosophy axis:** Philosophical-steering fixtures now include both `persona-stance-fidelity` and the matching philosopher rubric.
- **Ablation reporting:** `scripts/run-ablation.mjs` now records persona and philosophy judge axes and emits `Persona Delta` and `Philosophy Delta` in reports.
- **Positive variant:** Added `persona-intro` as a positive ablation-manifest condition that renders `personaIntro` as a Persona Stance section.
- **Local routing fix:** Adjusted local routing so Descartes philosophical steering prompts route to `expert-architect-descartes` instead of falling through to Peirce.
- **CLR import fix:** `run-ablation.mjs` now imports CLR lazily so `--local` mode works without `cli-runner-learner` installed.
- **Direct real mode fix:** Non-local, non-CLR ablation runs now install control artifacts before control trials, install variant artifacts before variant trials, and restore control artifacts afterward.
- **Helper script:** Added `scripts/add-persona-rubrics-to-fixtures.mjs` to update philosophical-steering fixture rubrics without inline shell scripts.

## Verification Completed

- **Build:** `npm run build:prompts` passed.
  - Log: `.logs/philosophy-build-prompts-3.log`
- **Unit tests:** `npm run test:unit` passed with 292 passing tests and 0 failures.
  - Log: `.logs/philosophy-test-unit-4.log`
- **Local worse/off scaffold:** `expert-philosophy` local ablation generated reports with axis columns.
  - Log: `.logs/philosophy-local-ablation-worse-3.log`
- **Local better/on scaffold:** `persona-intro` local positive variant generated reports with axis columns.
  - Log: `.logs/philosophy-local-ablation-better-2.log`

## Real Trial Evidence So Far

### Worse/off pilot: completed

- **Command shape:** `node scripts/run-ablation.mjs --suite philosophical-steering --targets cursor --sections expert-philosophy --cases PS-Po1,PS-De1,PS-Ro1,PS-Sh1 --trials 3`
- **Main log:** `.logs/philosophy-real-direct-worse-pilot-1.log`
- **Report:** `.logs/ablation-report-2026-05-13T05-41-46-401Z.md`
- **Raw trial logs:** 24 logs, covering 4 cases x 2 conditions x 3 trials.
- **Result:** `expert-philosophy` removal produced `Philosophy Delta: -0.08`, `Persona Delta: +0.00`, and `Verdict: KEEP`.
- **Interpretation:** Directionally supports the worse/off philosophy hypothesis, but the effect is small and does not show persona degradation.

### Better/on cursor run: blocked

- **Command shape:** `node scripts/run-ablation.mjs --suite philosophical-steering --targets cursor --sections persona-intro --trials 3`
- **Main log:** `.logs/philosophy-real-direct-better-all-1.log`
- **Failure:** Cursor agent failed during `PS-De2` ablated trial with `getaddrinfo ENOTFOUND api2.cursor.sh`.
- **Partial artifacts:** 23/48 expected trial logs were produced before failure.
- **Interpretation:** Network/DNS failure, not an experiment scoring failure.
- **Recovery:** Control artifacts were rebuilt and restored afterward.

### Better/on codex run: blocked

- **Command shape:** `node scripts/run-ablation.mjs --suite philosophical-steering --targets codex --sections persona-intro --trials 3`
- **Main log:** `.logs/philosophy-real-direct-better-all-codex-1.log`
- **Failure:** Codex CLI rejected the default model with `gpt-5.5 requires a newer version of Codex`.
- **Follow-up smoke:** `--codex-model gpt-5.3-codex-low-fast` still failed on the first trial.
- **Interpretation:** Codex is not currently the best path for these trials on this machine.

### Opencode smoke: working

- **Smoke command:** `opencode run --format default --dir /home/barrett/code/AgentHistoric-philosophy-680c08 'Return only this JSON object: {"ok":true}'`
- **Log:** `.logs/philosophy-opencode-json-smoke-1.log`
- **Result:** Returned `{"ok":true}`.
- **Interpretation:** `opencode` is currently the most promising working CLI path for continuing real trials.

## Current Constraints

- **CLR unavailable:** `cli-runner-learner` is not installed and `CLR_ROOT` is unset in this worktree.
- **Cursor unreliable:** Cursor CLI exists, but the better/on run hit a DNS failure against `api2.cursor.sh`.
- **Codex blocked:** Installed Codex CLI is incompatible with the default model and did not complete the explicit older-model smoke.
- **Claude uncertain:** `claude` is installed, but prior wrappers note `claude -p` can hang on this machine.
- **Opencode works:** `opencode run` works in this worktree and is the recommended next real-trial path.

## Recommended Next Step

Patch `scripts/run-ablation.mjs` to support an `opencode` target directly, treating it as cursor-equivalent for fixture selection, invoking `opencode run --format default --dir <workspace>`, and parsing the returned JSON response. Then rerun the all-case `persona-intro` better/on pilot against `opencode` with 3 trials.

## Acceptance Criteria Remaining

- Complete the better/on `persona-intro` real run across all eight philosophical-steering cases.
- Produce a Markdown/JSON ablation report with persona and philosophy deltas.
- Compare the better/on report against the completed worse/off report.
- Write the final experiment conclusion describing whether steering was shown on philosophy, persona, or both axes.
