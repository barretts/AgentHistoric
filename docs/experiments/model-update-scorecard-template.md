# Model Update Scorecard — YYYY-MM-DD

Use this template for each model or host update validation run.

## Update Context

- **Host target:** Cursor / Codex / Claude / Crush / Gemini / Windsurf
- **Old model:**
- **New model:**
- **Validation reason:** model release / host update / prompt release / regression investigation
- **Operator:**
- **Branch/worktree:**

## Commands and Logs

| Gate | Command | Log | Result |
|------|---------|-----|--------|
| Build prompts | `npm run build:prompts` | `.logs/...` | PASS / FAIL |
| Unit tests | `npm run test:unit` | `.logs/...` | PASS / FAIL |
| Local smoke | `node scripts/run-regressions.mjs --local --suite smoke ...` | `.logs/...` | PASS / FAIL |
| Local parity | `node scripts/run-regressions.mjs --local --suite model-parity ...` | `.logs/...` | PASS / FAIL |
| Real sample | `node scripts/run-regressions.mjs ...` | `.logs/...` | PASS / FAIL |
| Trace analysis | `node scripts/analyze-traces.mjs ...` | `.logs/...` | PASS / FAIL |
| Shift analysis | `node scripts/analyze-distribution-shift.mjs ...` | `.logs/...` | PASS / FAIL |

## Score Summary

| Suite | Target | Model | Cases | pass@k | pass^k | Mean Score | Routing Consistency |
|-------|--------|-------|-------|--------|--------|------------|---------------------|
| smoke | | | | | | | |
| model-parity | | | | | | | |
| specialist-pressure | | | | | | | |
| mixed-intent | | | | | | | |
| twopass | | | | | | | |
| persona-vs-neutral | | | | | | | |

## Routing Misses

| Case | Expected | Got | Model | Evidence | Triage Action |
|------|----------|-----|-------|----------|---------------|
| | | | | | |

## Output-Contract Drift

| Case | Expert | Drift Type | Evidence | Triage Action |
|------|--------|------------|----------|---------------|
| | | | | |

## Novel Prompt Coverage

| Prompt | Novelty Score | Add Fixture? | Rationale |
|--------|---------------|--------------|-----------|
| | | Yes / No | |

## Decision

- **Decision:** ACCEPT / TUNE / ROLLBACK
- **Reason:**
- **Follow-up issues:**
- **Prompt-system files changed:**
- **Verification logs after changes:**
