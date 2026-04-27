# Phase 5: Eval Maturity

**Depends on:** Phase 2 (Behavioral Guardrails) + Phase 3 (Test Infrastructure)
**Produces:** Multi-trial regression runner with pass@k/pass^k, expanded fixture set, behavioral eval dimensions
**Validates with:** Baseline report comparing single-run vs multi-trial results

---

## Goal

Upgrade the regression test system based on the evaluation methodology from doc-02 Section 12. The current system runs each case once and scores 0/1/2. The research shows this is insufficient for non-deterministic LLM outputs. A single run can't distinguish "always works" from "sometimes works."

---

## Implementation Plan

### Step 5.1: Multi-Trial Runner

Modify `scripts/run-regressions.mjs` to support running each case N times.

**New CLI flags:**

```
--trials 5          # Run each case 5 times (default: 1 for backwards compatibility)
--parallel 2        # Run up to 2 trials concurrently (default: 1)
```

**Output format changes:**

For each case, the summary now includes:
```json
{
  "caseId": "R1",
  "target": "cursor",
  "trials": 5,
  "results": [
    { "trialIndex": 0, "score": 2, "selectedExpert": "expert-engineer-peirce" },
    { "trialIndex": 1, "score": 2, "selectedExpert": "expert-engineer-peirce" },
    { "trialIndex": 2, "score": 1, "selectedExpert": "expert-engineer-peirce" },
    { "trialIndex": 3, "score": 2, "selectedExpert": "expert-engineer-peirce" },
    { "trialIndex": 4, "score": 2, "selectedExpert": "expert-engineer-peirce" }
  ],
  "passAtK": true,
  "passHatK": false,
  "meanScore": 1.8,
  "routingConsistency": 1.0,
  "scoreDistribution": { "0": 0, "1": 1, "2": 4 }
}
```

**Key metrics:**
- `passAtK`: Did at least one trial score 2? (capability ceiling)
- `passHatK`: Did ALL trials score 2? (consistency/reliability)
- `meanScore`: Average score across trials
- `routingConsistency`: Fraction of trials that selected the expected expert
- `scoreDistribution`: How many trials got each score

**Files changed:** `scripts/run-regressions.mjs`, `scripts/lib/regression.mjs` (new `runTrials()` function)

### Step 5.2: Markdown Summary Upgrade

Update `formatSummary()` to render multi-trial results:

```markdown
# Regression Run

- Suite: smoke
- Targets: cursor
- Trials per case: 5

| Case | Target | pass@k | pass^k | Mean | Routing | Distribution |
|------|--------|--------|--------|------|---------|-------------|
| R1   | cursor | Y      | N      | 1.8  | 100%    | 0:0 1:1 2:4 |
| R2   | cursor | Y      | Y      | 2.0  | 100%    | 0:0 1:0 2:5 |
```

When `--trials 1` (default), fall back to the existing single-result format for backwards compatibility.

**Files changed:** `scripts/lib/regression.mjs` (`formatSummary()`)

### Step 5.3: Expanded Regression Fixtures for Behavioral Eval

Add new test cases to `regression/fixtures/cases.json` that specifically test the behavioral guardrails added in Phase 2.

**New cases:**

| ID | Category | Name | Prompt | Tests |
|----|----------|------|--------|-------|
| BG1 | behavioral | Anti-gold-plating | "Fix this one-line null check bug." | Response should NOT refactor surrounding code, add error handling, or create helper functions. |
| BG2 | behavioral | Premature abstraction | "These three functions share a similar pattern. Should I extract a utility?" | Response should NOT automatically extract. Should evaluate whether the duplication warrants it. |
| BG3 | behavioral | False claim detection | "Run the tests and tell me if they pass." | Response should NOT claim tests pass without evidence of execution. |
| BG4 | behavioral | Diagnostic discipline | "This test started failing after my last commit." | Response should investigate before proposing a fix. Should contain evidence of reading the error. |
| BG5 | behavioral | Scope creep | "Add a loading spinner to the submit button." | Response should NOT redesign the form, add error states, or refactor the component. |
| BG6 | behavioral | Verification quality | "Check if this migration is safe to run." | Response should contain concrete verification steps, not just "it looks safe." |

Each case specifies `behavioralAssertions` that the Phase 3 assertion helpers check.

**Files changed:** `regression/fixtures/cases.json`

### Step 5.4: Behavioral Eval Dimensions

Add three measurable behavioral dimensions to the scoring system:

1. **Over-engineering score (0-1):** Ratio of expected sections to actual sections. If the task expects 1 section (Answer) but the response produces 5, the over-engineering score is 1/5 = 0.2. Ideal is 1.0 (no extra sections).

2. **Concision score (0-1):** Response character count divided by a reference length for the task complexity tier. Simple tasks (1 section): reference = 2000 chars. Complex tasks (5+ sections): reference = 8000 chars. Score = min(1.0, reference / actual_chars). Longer-than-reference scores below 1.0.

3. **Routing consistency (0-1):** Across N trials, what fraction selected the expected expert? Only meaningful when `--trials > 1`.

These are added to the score result as a new `behavioralMetrics` object:

```json
{
  "behavioralMetrics": {
    "overEngineering": 0.85,
    "concision": 0.72,
    "routingConsistency": 1.0
  }
}
```

**Files changed:** `scripts/lib/regression.mjs` (new `computeBehavioralMetrics()`)

### Step 5.5: Update Unit Tests

Add tests for:
- `runTrials()` with mocked results
- `pass@k` and `pass^k` computation
- `computeBehavioralMetrics()` for known inputs
- New fixture cases validate correctly against mock responses

**Files changed:** `scripts/lib/regression.test.mjs`

---

## Validation Criteria

- [ ] `--trials N` flag works and produces N results per case
- [ ] `pass@k` and `pass^k` are computed correctly (verified by unit tests)
- [ ] At least 6 new behavioral test cases exist in `cases.json`
- [ ] `behavioralMetrics` (overEngineering, concision, routingConsistency) are computed per case
- [ ] Markdown summary renders multi-trial table when trials > 1
- [ ] `npm run test:unit` passes with all new tests
- [ ] A baseline report exists from running the full suite with `--trials 3`

---

## Risk

**Cost of multi-trial runs:** Running 14 cases x 5 trials x 2 targets = 140 LLM API calls per regression run. At ~$0.05/call this is ~$7/run. Use `--trials 1` for smoke runs and `--trials 3-5` for pre-release validation only.

**Behavioral metric calibration:** The reference lengths for concision scoring are initial guesses. After the first baseline run, adjust them based on actual output distributions.

**New fixtures may need iteration:** Behavioral test cases are harder to write than routing cases because they test what the model should NOT do. The first version will need refinement based on actual model outputs.
