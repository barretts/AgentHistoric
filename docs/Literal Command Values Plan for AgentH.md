# Literal Command Values Plan for AgentHistoric

## Goal

Update AgentHistoric's non-destructive logging protocol so it does not instruct agents to use command substitution such as `$(date +%s)` in generated shell commands.

Empirical Claude behavior from the 3pp-skill investigation:

- `echo "$(pwd)"` surfaces `Unhandled node type: string`.
- `echo ok > .agent/logs/gate-$(date +%s).log` surfaces `Contains command_substitution`.
- Literal log filenames such as `.logs/run-test-1.log` execute cleanly.

AgentHistoric should use the same contract: **agent-generated literal values, not shell-generated values**.

## Files to Change

### Source of Truth

- `prompt-system/system.json`
  - Replace logging patterns that use `$(date +%s)` with literal, agent-chosen examples.
  - Update `globalRuntime.logging.pattern`.
  - Update `globalRuntime.logging.mandate`.
  - Update intensity variants under `globalRuntime.intensity.loggingMandate`.

Current problematic shapes:

```bash
LOG_FILE=".logs/run-$(date +%s).log"
```

```text
> .logs/run-<slug>-$(date +%s).log 2>&1
```

Target shape:

```bash
mkdir -p .logs
your_command > .logs/run-<slug>-1.log 2>&1
```

Add prose:

- Before running a logged command, choose a literal log filename.
- On retry, choose a new literal suffix such as `-2.log`.
- Do not use `$(date)`, `$(pwd)`, `mktemp`, backticks, or any shell-generated value to construct log filenames.

### Hook Nudges

- `hooks/opencode-log-shell-output.js`
- `hooks/opencode-log-shell-output-evaluator.js`
- `hooks/log-shell-output.sh`

Update nudge examples so they recommend literal filenames:

```text
mkdir -p .logs && your command > .logs/run-<slug>-1.log 2>&1
```

If a hook currently accepts or recommends timestamp substitution, change that guidance to:

```text
Choose a literal filename before re-running, for example .logs/run-test-1.log.
For retries, use .logs/run-test-2.log.
```

Do not weaken the requirement that full output be persisted before inspection.

### Tests

- `scripts/lib/hooks-smoke.test.mjs`
  - Replace test command fixtures containing `$(date +%s)` with literal examples.
  - Add or adjust assertions so hook compliance recognizes literal `.logs/...-1.log` paths.
  - Add a negative test for `$(date +%s)` if the hook is meant to discourage command substitution.

- `scripts/lib/prompt-smoke.test.mjs`
  - Update compliance tests that expect the old `$(date +%s)` suffix.
  - Assert the mandate mentions `.logs/`, `2>&1`, and literal filename selection.
  - Assert the mandate forbids `$(date)`, `$(pwd)`, `mktemp`, and backticks for log filename construction.

- `scripts/lib/compliance-audit.mjs` if needed
  - The current logging regex appears to check for `> .logs/` or `| tee .logs/`.
  - Keep that behavior if it already accepts literal filenames.
  - Only change it if tests show it specifically requires timestamp substitution.

### Rendered Artifacts

After source/test updates, regenerate compiled outputs through the repository's normal build/render command.

Likely affected generated files include:

- `compiled/claude/rules/00-init.md`
- `compiled/cursor/rules/00-init.mdc`
- `compiled/codex/AGENTS.md`
- `compiled/windsurf/rules/00-init.md`
- `compiled/gemini/rules/00-init.md`
- `compiled/crush/rules/00-init.md`
- any other rendered target generated from `prompt-system/system.json`

Do not hand-edit generated outputs unless the repository has no render command; prefer the source-of-truth render path.

## Implementation Steps

1. Inspect package scripts in `package.json` to identify the render/build/test commands.
2. Update `prompt-system/system.json` logging pattern and mandates.
3. Update hook nudge messages to literal filename examples.
4. Update tests that hard-code `$(date +%s)` examples.
5. Run focused hook and prompt smoke tests.
6. Regenerate compiled outputs.
7. Run full local validation.
8. Commit with a detailed message explaining the empirical Claude command-substitution gate behavior.

## Suggested Wording

Use this wording in the core logging contract:

```text
Before issuing a logged command, choose a literal log filename yourself, such as `.logs/run-test-1.log`. If retrying, choose a new literal filename such as `.logs/run-test-2.log`. Do not use `$(date)`, `$(pwd)`, `mktemp`, backticks, or any shell-generated value to construct log filenames; Claude may flag those as command substitution before the shell runs.
```

Suggested POSIX pattern:

```bash
mkdir -p .logs
your_command > .logs/run-<slug>-1.log 2>&1
```

Suggested post-failure inspection:

```bash
tail -n 50 .logs/run-<slug>-1.log
```

## Verification

Run the repository's normal validation suite. At minimum:

```bash
npm test
```

Also run focused tests for:

```bash
node --test scripts/lib/hooks-smoke.test.mjs
node --test scripts/lib/prompt-smoke.test.mjs
```

If this repo uses a custom runner instead of `node --test`, use the existing package script.

## Acceptance Criteria

- No source-of-truth logging instruction recommends `$(date +%s)`.
- No hook nudge recommends command substitution for log filenames.
- Rendered `00-init` / `AGENTS.md` artifacts show literal log filename examples.
- Tests assert literal log filename behavior.
- Tests still enforce persistent `.logs/` capture and `2>&1` stderr capture.
- The contract remains fail-closed: commands without persistent log redirection are still non-compliant.
