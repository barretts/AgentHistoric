# Model Update Scorecard — 2026-05-13

Use this scorecard as the evidence record for finishing philosopher-maintenance validation in `plan-680c08`.

## Update Context

- **Host target:** Cursor / Codex / Crush
- **Old model:** not recorded
- **New model:** Cursor default `gpt-5.4-medium`; Codex default failed on `gpt-5.5`; Crush default via CLR
- **Validation reason:** prompt release / philosopher-maintenance workflow validation
- **Operator:** Cascade
- **Branch/worktree:** `plan-680c08` at `/home/barrett/code/AgentHistoric-680c08`

## Commands and Logs

| Gate | Command | Log | Result |
|------|---------|-----|--------|
| Baseline status | `git status --short --untracked-files=all` | `.logs/final-status-baseline-2.log` | PASS |
| Build prompts | `npm run build:prompts` | `.logs/final-build-prompts-1.log` | PASS |
| Unit tests | `npm run test:unit` | `.logs/final-test-unit-1.log` | PASS |
| Local parity | `npm run test:model-parity` | `.logs/final-model-parity-local-1.log` | PASS |
| Trace analysis | `node scripts/analyze-traces.mjs --all` | `.logs/final-trace-analysis-3.log` | REVIEW |
| Shift analysis | `node scripts/analyze-distribution-shift.mjs --all --output .logs/final-shift-report-2.md` | `.logs/final-shift-analysis-2.log` | PASS |
| Real sample | `node scripts/run-regressions.mjs --suite full --targets cursor --case SP-Li1,SP-Kn2,MI3,TP3b,TP5b,PN1,PN4 --trials 1 --trace --judge` | `.logs/final-real-sample-cursor-2.log` | REVIEW |
| Real sample rescore | updated evaluator against `.logs/regression-summary-2026-05-13T05-36-30-882Z.json` | `.logs/final-real-sample-cursor-rescore-1.log` | REVIEW |
| Direct real parity | `npm run test:model-parity:real` | `.logs/final-model-parity-real-1.log` | BLOCKED |
| CLR parity fallback | `CLR_ROOT=/home/barrett/code/cli-runner-learner node scripts/run-via-clr.mjs --suite model-parity --targets cursor,crush --timeout-sec 300` | `.logs/final-clr-model-parity-2.log` | REVIEW |
| Parser fix targeted test | `node --test scripts/lib/regression.test.mjs` | `.logs/final-regression-targeted-after-parser-fix-1.log` | PASS |
| Parser fix full unit test | `npm run test:unit` | `.logs/final-test-unit-after-parser-fix-1.log` | PASS |

## Score Summary

| Suite | Target | Model | Cases | pass@k | pass^k | Mean Score | Routing Consistency |
|-------|--------|-------|-------|--------|--------|------------|---------------------|
| model-parity | local cursor,codex | synthetic local | 17 | PASS | PASS | not recorded | not recorded |
| real sample | cursor | `gpt-5.4-medium` | 7 | 6 strict pass, 1 partial | REVIEW | not recorded | 7/7 after parser fix |
| model-parity | cursor via CLR | `gpt-5.4-medium` | 17 | PASS | PASS | not recorded | 17/17 |
| model-parity | crush via CLR | default | 17 | REVIEW | REVIEW | not recorded | 16/17 extracted; 16/16 routed after extraction |
| model-parity | codex direct | default `gpt-5.5` | 1 attempted | BLOCKED | BLOCKED | n/a | n/a |

## Routing Misses

| Case | Expected | Got | Model | Evidence | Triage Action |
|------|----------|-----|-------|----------|---------------|
| PN1 | `expert-engineer-peirce` | `expert-engineer-peirce [rules:loaded init router experts@12]` before parser fix | Cursor `gpt-5.4-medium` | `.logs/regression-summary-2026-05-13T05-36-30-882Z.md` | Evaluator normalization fixed in `scripts/lib/regression.mjs`; rescore passes in `.logs/final-real-sample-cursor-rescore-1.log` |
| MI3b | `expert-orchestrator-simon` | JSON parse failed | Crush via CLR | `.logs/clr-summary-2026-05-13T05-44-05-031Z.md` | Treat as extraction/tooling issue, not routing miss; rerun or harden CLR extraction before prompt tuning |

## Output-Contract Drift

| Case | Expert | Drift Type | Evidence | Triage Action |
|------|--------|------------|----------|---------------|
| PN4 | `expert-visionary-dennett` | Draft C exceeded soft 150-word limit by 13 words | `.logs/final-real-sample-cursor-rescore-1.log` | Document as minor Dennett concision drift; do not tune broad voice rules from one sample |
| MI3b | `expert-orchestrator-simon` | Malformed JSON escaping in Crush output | `.logs/final-clr-model-parity-2.log` | Document as extraction issue; no prompt-system change yet |
| Codex R1 | n/a | CLI/model compatibility failure | `.logs/final-model-parity-codex-r1-error-1.log` | Upgrade Codex CLI or select compatible model before using direct Codex parity gate |

## Novel Prompt Coverage

| Prompt | Novelty Score | Add Fixture? | Rationale |
|--------|---------------|--------------|-----------|
| There's too much context in this prompt. What can we drop without losing signal? | 1 | No | Already represented by model-parity/RB1 style prompt; no shift detected |
| Should we build this new notification service? Design the system from scratch. | 1 | No | Existing architecture/new-service coverage is present; no shift detected |
| Webhook callback contract for third-party integrators | 1 | No | Existing `TP5b` coverage |
| Payment provider rollout with gates and rollback | 1 | No | Existing `MI3b` coverage |

## Decision

- **Decision:** TUNE LATER / ACCEPT CURRENT MAINTENANCE INFRASTRUCTURE
- **Reason:** Local gates pass, Cursor real sample routes correctly after evaluator normalization, Cursor CLR parity is 17/17, and distribution shift reports no shift. Remaining issues are one minor Dennett length drift, one Crush JSON extraction failure, and one Codex CLI/model compatibility blocker.
- **Follow-up issues:** upgrade or pin Codex CLI/model; rerun Crush `MI3b` or harden CLR extraction for malformed JSON escaping; investigate PN4 concision drift only if repeated.
- **Prompt-system files changed:** `prompt-system/router.json` gained narrow Descartes boost signals for `trust boundaries`, `data constraints`, and `bedrock`; generated router artifacts were rebuilt.
- **Verification logs after changes:** `.logs/final-test-unit-after-parser-fix-1.log`, `.logs/final-real-sample-cursor-rescore-1.log`, `.logs/final-clr-model-parity-2.log`, `.logs/final-shift-report-2.md`.

## Follow-up: PR Review Fixes

- **Local parity semantics:** `npm run test:model-parity` now runs as a parity-only equivalence gate. Strict score quality remains available through `npm run test:model-parity:strict` and is informational for this scorecard unless the update explicitly requires strict local quality gating.
- **Novel prompt semantics:** distribution-shift reporting now separates novel candidates from well-covered prompts. Re-evaluate the table above with `node scripts/analyze-distribution-shift.mjs --all --view both --output .logs/final-shift-report-both-1.md`; prompts copied from existing fixtures should appear as well-covered, not novel.
