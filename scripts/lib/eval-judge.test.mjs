import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  resolveRubricsForCase,
  judgeResponse,
  judgeResponseMulti,
  attachJudgeResults,
  loadCustomRubrics,
  BUILTIN_RUBRICS
} from "./eval-judge.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

// ── Rubric Resolution ──────────────────────────────────────────────

test("resolveRubricsForCase returns rubrics applicable to given expert", () => {
  const rubrics = resolveRubricsForCase(
    {},
    "expert-architect-descartes"
  );
  assert.ok(rubrics.some(r => r.id === "factual-grounding"));
  assert.ok(rubrics.some(r => r.id === "failure-mode-analysis"));
  assert.ok(rubrics.some(r => r.id === "contract-explicitness"));
});

test("resolveRubricsForCase returns rubrics for UX expert", () => {
  const rubrics = resolveRubricsForCase({}, "expert-ux-rogers");
  assert.ok(rubrics.some(r => r.id === "factual-grounding"));
  assert.ok(rubrics.some(r => r.id === "human-cost-awareness"));
  assert.ok(!rubrics.some(r => r.id === "draft-diversity"));
});

test("resolveRubricsForCase returns all rubrics when judgeRubrics explicitly set", () => {
  const rubrics = resolveRubricsForCase(
    { judgeRubrics: ["draft-diversity", "factual-grounding"] },
    "expert-architect-descartes"
  );
  assert.strictEqual(rubrics.length, 2);
  assert.deepEqual(rubrics.map(r => r.id).sort(), ["draft-diversity", "factual-grounding"]);
});

test("resolveRubricsForCase includes custom rubrics", () => {
  const custom = [{ id: "custom-one", applicableTo: "all", prompt: () => "test" }];
  const rubrics = resolveRubricsForCase({}, "expert-architect-descartes", custom);
  assert.ok(rubrics.some(r => r.id === "custom-one"));
});

// ── Heuristic Judge: Factual Grounding ─────────────────────────────

test("judgeResponse heuristic: factual grounding scores 2 with VERIFIED", async () => {
  const result = await judgeResponse({
    response: "VERIFIED: the null check on line 42 prevents the crash.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "factual-grounding"),
    local: true
  });
  assert.strictEqual(result.score, 2);
  assert.strictEqual(result.mode, "heuristic");
});

test("judgeResponse heuristic: factual grounding scores 0 without evidence", async () => {
  const result = await judgeResponse({
    response: "This is a great solution that works perfectly.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "factual-grounding"),
    local: true
  });
  assert.strictEqual(result.score, 0);
});

// ── Heuristic Judge: Failure Mode Analysis ─────────────────────────

test("judgeResponse heuristic: failure mode analysis scores 2 with multiple concepts", async () => {
  const result = await judgeResponse({
    response: "Failure modes: network timeout triggers fallback to cached data. Degraded mode uses boundary checks.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "failure-mode-analysis"),
    local: true
  });
  assert.strictEqual(result.score, 2);
});

test("judgeResponse heuristic: failure mode analysis scores 0 without any", async () => {
  const result = await judgeResponse({
    response: "The happy path works fine. Just add the feature.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "failure-mode-analysis"),
    local: true
  });
  assert.strictEqual(result.score, 0);
});

// ── Heuristic Judge: Diagnostic Before Fix ─────────────────────────

test("judgeResponse heuristic: diagnosis before fix scores 2", async () => {
  const result = await judgeResponse({
    response: "Reading the error stack shows the null pointer at line 42. Root cause is a missing null check. Fix: add a guard clause.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "diagnostic-before-fix"),
    local: true
  });
  assert.strictEqual(result.score, 2);
});

test("judgeResponse heuristic: fix without diagnosis scores 0", async () => {
  const result = await judgeResponse({
    response: "Replace the function with this new implementation.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "diagnostic-before-fix"),
    local: true
  });
  assert.strictEqual(result.score, 0);
});

// ── Heuristic Judge: Draft Diversity ────────────────────────────────

test("judgeResponse heuristic: diverse drafts score 2", async () => {
  const result = await judgeResponse({
    response: "Draft A\nUse a Redis cache layer with TTL eviction for session data.\n\nDraft B\nImplement server-side session storage with PostgreSQL row-level locking.\n\nDraft C\nUse JWT tokens embedded in HTTP headers with cryptographic signing.\n\nRecommendation\nDraft A is simplest.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "draft-diversity"),
    local: true
  });
  assert.strictEqual(result.score, 2);
});

// ── Heuristic Judge: Human Cost Awareness ──────────────────────────

test("judgeResponse heuristic: human cost awareness scores 2", async () => {
  const result = await judgeResponse({
    response: "The modal confusion comes from cognitive overload. Users feel lost when accessibility is ignored. Add keyboard navigation.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "human-cost-awareness"),
    local: true
  });
  assert.strictEqual(result.score, 2);
});

// ── Heuristic Judge: Measurement Before Optimization ───────────────

test("judgeResponse heuristic: measurement before optimization scores 2", async () => {
  const result = await judgeResponse({
    response: "Profiling shows the bottleneck is at 450ms latency. The O(n^2) query needs an index. Benchmark confirms improvement.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "measurement-before-optimization"),
    local: true
  });
  assert.strictEqual(result.score, 2);
});

test("judgeResponse heuristic: optimization without measurement scores 0", async () => {
  const result = await judgeResponse({
    response: "We should optimize by adding a cache layer and batching requests.",
    rubric: BUILTIN_RUBRICS.find(r => r.id === "measurement-before-optimization"),
    local: true
  });
  assert.strictEqual(result.score, 0);
});

// ── Multi-Rubric Evaluation ─────────────────────────────────────────

test("judgeResponseMulti evaluates all applicable rubrics", async () => {
  const mockSystem = { experts: [], router: {} };
  const testCase = { prompt: "Test prompt" };
  const response = "VERIFIED: The failure mode shows a fallback path. The contract uses a schema for input validation.";
  const result = await judgeResponseMulti({
    system: mockSystem,
    testCase,
    response,
    expertId: "expert-architect-descartes",
    context: testCase.prompt,
    local: true
  });
  assert.ok(result.rubricCount >= 2);
  assert.ok(result.results.every(r => typeof r.score === "number"));
});

// ── Attach Judge Results ───────────────────────────────────────────

test("attachJudgeResults integrates judge findings into scoreResult", async () => {
  const mockSystem = { experts: [], router: {} };
  const testCase = {
    expectedPrimaryExpert: "expert-engineer-peirce",
    prompt: "Fix the null pointer."
  };
  const response = {
    response: "Reading the error shows the root cause. Fix: add null check.",
    routingDecision: { selectedExpert: "expert-engineer-peirce" }
  };
  const scoreResult = {
    score: 2,
    selectedExpert: "expert-engineer-peirce",
    missingSections: [],
    notableDrift: [],
    behavioralFindings: []
  };

  const result = await attachJudgeResults(mockSystem, testCase, response, {
    scoreResult,
    local: true
  });

  assert.ok(result.judgeResult);
  assert.ok(typeof result.score === "number");
});

test("attachJudgeResults handles errors gracefully", async () => {
  const result = await attachJudgeResults(null, null, null, {
    scoreResult: { score: 2, selectedExpert: "test" },
    local: true
  });
  // Should still return the scoreResult even if judge evaluation fails
  assert.ok(result.score !== undefined);
});

// ── Builtin Rubric Structure ────────────────────────────────────────

test("BUILTIN_RUBRICS has at least 6 rubrics", () => {
  assert.ok(BUILTIN_RUBRICS.length >= 6);
});

test("every builtin rubric has id, name, description, prompt, and applicableTo", () => {
  for (const r of BUILTIN_RUBRICS) {
    assert.ok(r.id, `Rubric missing id`);
    assert.ok(r.name, `${r.id}: missing name`);
    assert.ok(r.description, `${r.id}: missing description`);
    assert.ok(typeof r.prompt === "function", `${r.id}: prompt must be a function`);
    assert.ok(r.applicableTo, `${r.id}: missing applicableTo`);
  }
});