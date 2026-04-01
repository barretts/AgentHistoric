# Phase 3: Test Infrastructure Hardening

**Depends on:** Phase 1 (Gap Analysis). Can run in parallel with Phase 2.
**Produces:** Prompt smoke tests, behavioral assertion helpers, expanded unit test coverage
**Validates with:** `npm run test:unit` catches intentional breakage

---

## Goal

Add two new test layers that the research identifies as missing (doc-02 Section 12, Tier 1): structural smoke tests for generated prompts, and behavioral assertion helpers for the regression system. These create the safety net needed before Phases 4-6 make further prompt changes.

Note: Prompt snapshot tests (D2) are already implemented via `prompt-system.test.mjs` line 44's generated-artifact sync check.

---

## Implementation Plan

### Step 3.1: Prompt Smoke Tests

Create `scripts/lib/prompt-smoke.test.mjs` that validates structural properties of every generated artifact.

**What to test:**

1. **Frontmatter validity:** Every `.mdc` file has valid YAML frontmatter with required fields (`description`, `alwaysApply`). Every `.md` file with frontmatter has `trigger` and `description`.

2. **Required sections present:** Init prompts must contain: Logging Protocol, Definition of Done, Foundational Constraints, Swarm Registry. Router prompts must contain: Routing Heuristics, Pipeline Sequences. Expert prompts must contain: Core Philosophy (if defined), Method, Voice, Deliverables, Output Contract.

3. **Expert ID consistency:** Every expert ID referenced in the router heuristics exists in the generated expert files. Every expert in the swarm registry has a corresponding generated file.

4. **No orphaned cross-references:** If an expert's handoff rules reference another expert, that expert exists.

5. **Token budget (approximate):** Each generated file is under a configurable character limit (e.g., 15,000 chars as a starting guard). This prevents unbounded prompt growth as we add guardrails.

**Implementation approach:**

```javascript
import test from "node:test";
import { generateArtifacts } from "./build-prompt-system.mjs";
import { loadPromptSystemSpec } from "./prompt-system.mjs";

const system = await loadPromptSystemSpec(workspaceRoot);
const artifacts = generateArtifacts(system);

test("every cursor artifact has valid frontmatter", () => {
  for (const [path, content] of artifacts) {
    if (!path.endsWith(".mdc")) continue;
    assert.match(content, /^---\n/);
    assert.match(content, /description:/);
    assert.match(content, /alwaysApply:/);
  }
});

test("init prompts contain required sections", () => {
  // Check for Logging, Definition of Done, Foundational Constraints, Swarm Registry
});

test("every expert referenced in router heuristics has a generated file", () => {
  // Cross-reference router.routingHeuristics[].experts against artifact keys
});

test("no generated artifact exceeds token budget", () => {
  const MAX_CHARS = 15000;
  for (const [path, content] of artifacts) {
    assert.ok(content.length <= MAX_CHARS, `${path} is ${content.length} chars (max ${MAX_CHARS})`);
  }
});
```

**Files created:** `scripts/lib/prompt-smoke.test.mjs`

### Step 3.2: Behavioral Assertion Helpers

Extend `scripts/lib/regression.mjs` with new grader functions that check behavioral dimensions beyond routing correctness. These are code-based graders (deterministic, no LLM calls).

**New assertions:**

1. **`assertNoGoldPlating(response, testCase)`** -- Check that the response body does not contain sections or content that go beyond the scope of the test case prompt. Implementation: count the number of distinct topics/sections in the response vs the expected sections. Flag if extra sections appear that aren't in `expectedSections` or `allowedHandoffs`.

2. **`assertConcision(response, maxChars)`** -- Check that `response.response` is under a character limit relative to the task complexity. Simple tasks (1 expected section) should produce shorter responses than complex tasks (5+ sections).

3. **`assertNoFalseClaims(response)`** -- Check for known false-claim patterns: "all tests pass" without evidence of running tests, "verified" claims without tool output, "no issues found" without investigation evidence. This is a heuristic check using regex patterns.

4. **`assertDiagnosticDiscipline(response)`** -- For QA/debug cases: check that the response contains evidence of investigation (file reading, error analysis) before proposing a fix. Flag responses that jump straight to a solution without diagnosis.

**Implementation approach:**

Add these as exported functions in `regression.mjs` that return `{ pass: boolean, finding: string }`. They are opt-in per test case -- each case in `cases.json` can specify which behavioral assertions to run via a new `behavioralAssertions` field.

```json
{
  "id": "R1",
  "behavioralAssertions": ["noGoldPlating", "concision"]
}
```

The `evaluateResponse()` function calls each specified assertion and includes findings in the score.

**Files changed:** `scripts/lib/regression.mjs`

### Step 3.3: Update evaluateResponse() Scoring

Currently scoring is: 2 (perfect), 1 (right expert, some issues), 0 (wrong expert).

Add a `behavioralFindings` array to the score result alongside the existing `notableDrift`. Behavioral findings reduce the score but don't override routing correctness:

- Score 2: correct expert + format + no behavioral findings
- Score 1: correct expert + (format issues OR behavioral findings)
- Score 0: wrong expert

**Files changed:** `scripts/lib/regression.mjs` (`evaluateResponse()`, `scoreCase()`)

### Step 3.4: Update Regression Test Unit Tests

Add test cases for the new assertions in `scripts/lib/regression.test.mjs`:

- Test that `assertNoGoldPlating` flags a response with extra sections
- Test that `assertConcision` flags a response over the limit
- Test that `assertNoFalseClaims` flags "all tests pass" without evidence
- Test that `assertDiagnosticDiscipline` flags a jump-to-solution response

**Files changed:** `scripts/lib/regression.test.mjs`

### Step 3.5: Wire Into npm Scripts

No new scripts needed. The smoke tests are picked up by `npm run test:unit` (which runs `node --test scripts/lib/*.test.mjs`). The behavioral assertions are used by the existing `npm run test:regressions` runner.

---

## Validation Criteria

- [ ] `scripts/lib/prompt-smoke.test.mjs` exists with >= 5 structural tests
- [ ] All smoke tests pass on current generated output
- [ ] Intentionally breaking a prompt (e.g., removing a required section from an expert JSON) causes a smoke test failure
- [ ] `assertNoGoldPlating`, `assertConcision`, `assertNoFalseClaims`, `assertDiagnosticDiscipline` are exported from `regression.mjs`
- [ ] Each assertion has at least one unit test in `regression.test.mjs`
- [ ] `npm run test:unit` passes with all new tests
- [ ] Scoring in `evaluateResponse` incorporates behavioral findings

---

## Risk

**False positives in behavioral assertions:** Regex-based heuristics for false claims and gold-plating will have false positives. Start with conservative patterns (high confidence matches only) and expand over time.

**Smoke test brittleness:** Character budget tests will need updating as we add guardrails in Phase 2. Set the initial budget with headroom (e.g., 15,000 chars when the current max is ~8,000).
