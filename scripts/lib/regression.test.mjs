import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  aggregateTrialResults,
  assertConcision,
  assertDiagnosticDiscipline,
  assertNoFalseClaims,
  assertNoGoldPlating,
  assertRoutingFirst,
  buildWrappedPrompt,
  computeBehavioralMetrics,
  evaluateResponse,
  expectedResponseSections,
  formatAblationReport,
  loadRegressionFixtures,
  parseArgs,
  routePrompt,
  runTrials
} from "./regression.mjs";
import { loadPromptSystemSpec } from "./prompt-system.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const globalSystem = await loadPromptSystemSpec(workspaceRoot);

async function loadCase(caseId) {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  return fixtures.cases.find((testCase) => testCase.id === caseId);
}

test("expectedResponseSections prepends routing headings", () => {
  const sections = expectedResponseSections({
    expectedSections: ["Assumptions", "Failure Modes"]
  });

  assert.deepEqual(sections, [
    "Selected Expert",
    "Reason",
    "Confidence",
    "Assumptions",
    "Failure Modes"
  ]);
});

test("buildWrappedPrompt includes exact required headings guidance", () => {
  const prompt = buildWrappedPrompt({
    prompt: "Design the data model and trust boundaries for this feature.",
    expectedSections: ["Assumptions", "Failure Modes", "Fallbacks"]
  });

  assert.match(
    prompt,
    /Use these exact response headings for this case when they apply: Selected Expert, Reason, Confidence, Assumptions, Failure Modes, Fallbacks\./
  );
  assert.match(
    prompt,
    /The response body itself must begin with Selected Expert, then Reason, then Confidence, before any other content\./
  );
});

test("parseArgs supports case filters", () => {
  const options = parseArgs(["--case", "R1,C2"]);

  assert.deepEqual(options.caseIds, ["R1", "C2"]);
});

test("routePrompt matches fixture expectations for representative cases", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const caseIds = ["R1", "R2", "R3", "R4", "R5", "R6", "C2"];

  for (const caseId of caseIds) {
    const testCase = fixtures.cases.find((item) => item.id === caseId);
    assert.ok(testCase, `Missing fixture ${caseId}`);
    assert.strictEqual(
      routePrompt(system, testCase.prompt),
      testCase.expectedPrimaryExpert,
      `Unexpected route for ${caseId}`
    );
  }
});

test("routePrompt handles negative routing examples", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const caseIds = ["NE1", "NE2", "NE4"];

  for (const caseId of caseIds) {
    const testCase = fixtures.cases.find((item) => item.id === caseId);
    assert.ok(testCase, `Missing fixture ${caseId}`);
    assert.strictEqual(
      routePrompt(system, testCase.prompt),
      testCase.expectedPrimaryExpert,
      `Unexpected route for ${caseId}: ${testCase.name}`
    );
  }
});

test("routePrompt routes diversity cases to correct experts", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const caseIds = ["RB1", "RB2", "RB3", "RB4", "RB5", "RB6", "RB7", "RB8"];

  for (const caseId of caseIds) {
    const testCase = fixtures.cases.find((item) => item.id === caseId);
    assert.ok(testCase, `Missing fixture ${caseId}`);
    assert.strictEqual(
      routePrompt(system, testCase.prompt),
      testCase.expectedPrimaryExpert,
      `Unexpected route for ${caseId}: ${testCase.name}`
    );
  }
});

test("evaluateResponse accepts a valid architecture response", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const testCase = await loadCase("R2");
  const response = {
    routingDecision: {
      domain: "Foundational Architecture",
      selectedExpert: "expert-architect-descartes",
      reason: "The request asks for a data model and trust boundaries.",
      confidence: "High"
    },
    activeExpert: "expert-architect-descartes",
    handoffs: [],
    outputSections: [
      "Selected Expert",
      "Reason",
      "Confidence",
      "Assumptions",
      "Failure Modes",
      "Fallbacks",
      "Foundation",
      "Verification Flags"
    ],
    confidenceLabeled: true,
    personaBlend: false,
    domainStayedInScope: true,
    summary: "Architecture is primary.",
    response: [
      "Selected Expert: expert-architect-descartes",
      "Reason: VERIFIED this is a design and trust-boundary request.",
      "Confidence: High",
      "Assumptions: VERIFIED inputs and roles are not fully specified.",
      "Failure Modes: HYPOTHESIS weak permission boundaries could leak data.",
      "Fallbacks: VERIFIED default-deny access until role checks pass.",
      "Foundation: VERIFIED define the schema, ownership model, and validation path before business logic.",
      "Verification Flags: HYPOTHESIS validate tenant and permission invariants with tests."
    ].join("\n")
  };

  const result = evaluateResponse(system, testCase, response);
  assert.strictEqual(result.score, 2);
  assert.deepEqual(result.missingSections, []);
  assert.deepEqual(result.notableDrift, []);
});

test("evaluateResponse ignores inline uncertainty labels that are not headings", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const testCase = await loadCase("R2");
  const response = {
    routingDecision: {
      domain: "Foundational Architecture",
      selectedExpert: "expert-architect-descartes",
      reason: "The request is architecture-first.",
      confidence: "Medium"
    },
    activeExpert: "expert-architect-descartes",
    handoffs: [],
    outputSections: [
      "Selected Expert",
      "Reason",
      "Confidence",
      "Assumptions",
      "Failure Modes",
      "Fallbacks",
      "Foundation",
      "Verification Flags"
    ],
    confidenceLabeled: true,
    personaBlend: false,
    domainStayedInScope: true,
    summary: "Architecture remained primary.",
    response: [
      "## Selected Expert",
      "`expert-architect-descartes`",
      "",
      "## Reason",
      "The request asks for contracts and trust boundaries before implementation.",
      "",
      "## Confidence",
      "HYPOTHESIS: Medium confidence because the feature details are incomplete.",
      "",
      "## Assumptions",
      "- VERIFIED actor roles are not fully specified yet.",
      "",
      "## Failure Modes",
      "- HYPOTHESIS implicit trust between components could leak privileges.",
      "",
      "## Fallbacks",
      "- VERIFIED default-deny boundaries limit damage while details are clarified.",
      "",
      "## Foundation",
      "Define schemas, ownership, and validation boundaries first.",
      "",
      "## Verification Flags",
      "Verification should confirm tenant and permission invariants."
    ].join("\n")
  };

  const result = evaluateResponse(system, testCase, response);
  assert.strictEqual(result.score, 2);
  assert.strictEqual(result.personaBlend, false);
  assert.deepEqual(result.notableDrift, []);
});

// ── Behavioral Assertion Tests ─────────────────────────────────────

test("assertNoGoldPlating flags extra sections beyond expected", () => {
  const response = {
    response: [
      "## Selected Expert",
      "expert-engineer-peirce",
      "## Reason",
      "Clear implementation request.",
      "## Confidence",
      "High",
      "## Answer",
      "Here is the implementation.",
      "## Refactoring Suggestions",
      "Here are some bonus improvements."
    ].join("\n")
  };
  const testCase = { expectedSections: ["Answer"], allowedHandoffs: [] };

  const result = assertNoGoldPlating(response, testCase);
  assert.strictEqual(result.pass, false);
  assert.match(result.finding, /gold-plating/i);
  assert.match(result.finding, /Refactoring Suggestions/);
});

test("assertNoGoldPlating passes when only expected sections present", () => {
  const response = {
    response: [
      "## Selected Expert",
      "expert-engineer-peirce",
      "## Reason",
      "Implementation request.",
      "## Confidence",
      "High",
      "## Answer",
      "Done."
    ].join("\n")
  };
  const testCase = { expectedSections: ["Answer"], allowedHandoffs: [] };

  const result = assertNoGoldPlating(response, testCase);
  assert.strictEqual(result.pass, true);
});

test("assertConcision flags responses over the limit", () => {
  const response = { response: "x".repeat(5000) };
  const result = assertConcision(response, 4000);
  assert.strictEqual(result.pass, false);
  assert.match(result.finding, /concision/i);
});

test("assertConcision passes for short responses", () => {
  const response = { response: "Short answer." };
  const result = assertConcision(response, 4000);
  assert.strictEqual(result.pass, true);
});

test("assertNoFalseClaims flags 'all tests pass' without evidence", () => {
  const response = {
    response: "I reviewed the code and all tests pass. The implementation looks correct."
  };
  const result = assertNoFalseClaims(response);
  assert.strictEqual(result.pass, false);
  assert.match(result.finding, /false claim/i);
});

test("assertNoFalseClaims passes when tool evidence is present", () => {
  const response = {
    response: "```\n$ npm test\nall tests pass\n```\nAll tests pass."
  };
  const result = assertNoFalseClaims(response);
  assert.strictEqual(result.pass, true);
});

test("assertDiagnosticDiscipline flags fix-without-diagnosis", () => {
  const response = {
    response: "Replace the function with this new implementation. Also add error handling."
  };
  const result = assertDiagnosticDiscipline(response);
  assert.strictEqual(result.pass, false);
  assert.match(result.finding, /diagnostic discipline/i);
});

test("assertDiagnosticDiscipline passes when diagnosis precedes fix", () => {
  const response = {
    response:
      "Reading the error stack trace shows the null pointer originates from line 42. " +
      "The root cause is a missing null check. Fix: add a guard clause."
  };
  const result = assertDiagnosticDiscipline(response);
  assert.strictEqual(result.pass, true);
});

test("assertRoutingFirst flags preamble before routing headings", () => {
  const response = {
    response: [
      "I will inspect the files first.",
      "",
      "## Selected Expert",
      "expert-engineer-peirce",
      "",
      "## Reason",
      "Implementation request.",
      "",
      "## Confidence",
      "High",
      "",
      "## Answer",
      "Done."
    ].join("\n")
  };
  const result = assertRoutingFirst(response);
  assert.strictEqual(result.pass, false);
  assert.match(result.finding, /preamble content before the routing decision/i);
});

test("assertRoutingFirst passes when routing headings come first in order", () => {
  const response = {
    response: [
      "## Selected Expert",
      "expert-engineer-peirce",
      "",
      "## Reason",
      "Implementation request.",
      "",
      "## Confidence",
      "High",
      "",
      "## Answer",
      "Done."
    ].join("\n")
  };
  const result = assertRoutingFirst(response);
  assert.strictEqual(result.pass, true);
});

test("evaluateResponse incorporates routing-first findings into scoring", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const testCase = {
    ...await loadCase("BG7"),
    behavioralAssertions: ["routingFirst"]
  };
  const response = {
    routingDecision: {
      domain: "Foundational Architecture",
      selectedExpert: "expert-architect-descartes",
      reason: "The request asks for trust boundaries and contracts.",
      confidence: "High"
    },
    activeExpert: "expert-architect-descartes",
    handoffs: [],
    outputSections: [
      "Selected Expert",
      "Reason",
      "Confidence",
      "Assumptions",
      "Failure Modes",
      "Fallbacks",
      "Foundation",
      "Verification Flags"
    ],
    confidenceLabeled: true,
    personaBlend: false,
    domainStayedInScope: true,
    summary: "Architecture remained primary.",
    response: [
      "Let me inspect the architecture skill first.",
      "",
      "## Selected Expert",
      "expert-architect-descartes",
      "",
      "## Reason",
      "VERIFIED the prompt asks for trust boundaries.",
      "",
      "## Confidence",
      "High",
      "",
      "## Assumptions",
      "VERIFIED some implementation details are unspecified.",
      "",
      "## Failure Modes",
      "HYPOTHESIS unclear trust boundaries leak privileges.",
      "",
      "## Fallbacks",
      "VERIFIED default-deny reduces blast radius.",
      "",
      "## Foundation",
      "VERIFIED contracts come before implementation.",
      "",
      "## Verification Flags",
      "HYPOTHESIS validate role boundaries with tests."
    ].join("\n")
  };

  const result = evaluateResponse(system, testCase, response);
  assert.strictEqual(result.score, 1);
  assert.ok(result.behavioralFindings.length > 0);
  assert.match(result.behavioralFindings[0], /routing discipline/i);
});

test("evaluateResponse incorporates behavioral findings into scoring", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const testCase = {
    ...await loadCase("R1"),
    behavioralAssertions: ["concision"]
  };
  const response = {
    routingDecision: {
      domain: "Implementation",
      selectedExpert: "expert-engineer-peirce",
      reason: "Clear implementation request.",
      confidence: "High"
    },
    activeExpert: "expert-engineer-peirce",
    handoffs: [],
    outputSections: ["Answer"],
    confidenceLabeled: true,
    personaBlend: false,
    domainStayedInScope: true,
    summary: "Implementation is primary.",
    response: "Selected Expert: expert-engineer-peirce\nReason: impl\nConfidence: High\n\n## Answer\n" + "x".repeat(5000)
  };

  const result = evaluateResponse(system, testCase, response);
  assert.strictEqual(result.score, 1);
  assert.ok(result.behavioralFindings.length > 0);
  assert.match(result.behavioralFindings[0], /concision/i);
});

test("evaluateResponse rejects blended headings from another expert", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const testCase = await loadCase("R2");
  const response = {
    routingDecision: {
      domain: "Foundational Architecture",
      selectedExpert: "expert-architect-descartes",
      reason: "The request is architectural.",
      confidence: "High"
    },
    activeExpert: "expert-architect-descartes",
    handoffs: [],
    outputSections: [
      "Selected Expert",
      "Reason",
      "Confidence",
      "Assumptions",
      "Failure Modes",
      "Fallbacks",
      "Foundation",
      "Verification Flags",
      "Draft A"
    ],
    confidenceLabeled: true,
    personaBlend: false,
    domainStayedInScope: true,
    summary: "Architecture remained primary.",
    response: [
      "## Selected Expert",
      "expert-architect-descartes",
      "",
      "## Reason",
      "VERIFIED the prompt asks for contracts.",
      "",
      "## Confidence",
      "High",
      "",
      "## Assumptions",
      "VERIFIED some interfaces are unknown.",
      "",
      "## Failure Modes",
      "VERIFIED missing auth rules break the design.",
      "",
      "## Fallbacks",
      "VERIFIED default-deny boundaries reduce blast radius.",
      "",
      "## Foundation",
      "VERIFIED schemas and trust boundaries come before implementation.",
      "",
      "## Verification Flags",
      "HYPOTHESIS validate permission edges with tests.",
      "",
      "## Draft A",
      "Explore a looser API-first option."
    ].join("\n")
  };

  const result = evaluateResponse(system, testCase, response);
  assert.strictEqual(result.score, 1);
  assert.match(result.notableDrift.join(" "), /persona blending/i);
});

// ── Multi-Trial Runner ──────────────────────────────────────────────

test("runTrials executes the correct number of trials", async () => {
  let count = 0;
  const results = await runTrials(
    async (idx) => {
      count++;
      return { trialIndex: idx, score: 2, selectedExpert: "expert-engineer-peirce" };
    },
    { trials: 5, parallel: 2 }
  );
  assert.strictEqual(results.length, 5);
  assert.strictEqual(count, 5);
});

test("aggregateTrialResults computes pass@k and pass^k correctly", () => {
  const mixed = aggregateTrialResults([
    { score: 2, selectedExpert: "expert-engineer-peirce", expectedExpert: "expert-engineer-peirce" },
    { score: 1, selectedExpert: "expert-engineer-peirce", expectedExpert: "expert-engineer-peirce" },
    { score: 2, selectedExpert: "expert-engineer-peirce", expectedExpert: "expert-engineer-peirce" }
  ]);
  assert.strictEqual(mixed.passAtK, true);
  assert.strictEqual(mixed.passHatK, false);
  assert.strictEqual(mixed.meanScore, 1.67);
  assert.strictEqual(mixed.routingConsistency, 1.0);
  assert.deepStrictEqual(mixed.scoreDistribution, { 0: 0, 1: 1, 2: 2 });

  const perfect = aggregateTrialResults([
    { score: 2, selectedExpert: "expert-qa-popper", expectedExpert: "expert-qa-popper" },
    { score: 2, selectedExpert: "expert-qa-popper", expectedExpert: "expert-qa-popper" }
  ]);
  assert.strictEqual(perfect.passAtK, true);
  assert.strictEqual(perfect.passHatK, true);
  assert.strictEqual(perfect.meanScore, 2);
});

test("aggregateTrialResults detects routing inconsistency", () => {
  const inconsistent = aggregateTrialResults([
    { score: 2, selectedExpert: "expert-engineer-peirce", expectedExpert: "expert-qa-popper" },
    { score: 1, selectedExpert: "expert-qa-popper", expectedExpert: "expert-qa-popper" },
    { score: 2, selectedExpert: "expert-qa-popper", expectedExpert: "expert-qa-popper" }
  ]);
  assert.strictEqual(inconsistent.routingConsistency, 0.67);
});

// ── Behavioral Metrics ──────────────────────────────────────────────

test("computeBehavioralMetrics detects over-engineering", () => {
  const response = {
    response: "## Answer\nDo the thing.\n\n## Extra Section\nBonus.\n\n## Another\nMore bonus."
  };
  const testCase = { expectedSections: ["Answer"] };
  const metrics = computeBehavioralMetrics(response, testCase);
  assert.ok(metrics.overEngineering < 1.0, `Expected <1.0, got ${metrics.overEngineering}`);
  assert.strictEqual(metrics.overEngineering, 0.33);
});

test("computeBehavioralMetrics returns 1.0 for well-scoped response", () => {
  const response = { response: "## Answer\nThe fix is to use optional chaining." };
  const testCase = { expectedSections: ["Answer"] };
  const metrics = computeBehavioralMetrics(response, testCase);
  assert.strictEqual(metrics.overEngineering, 1.0);
});

test("computeBehavioralMetrics concision penalizes verbose responses", () => {
  const longText = "x".repeat(5000);
  const response = { response: longText };
  const testCase = { expectedSections: ["Answer"] };
  const metrics = computeBehavioralMetrics(response, testCase);
  assert.ok(metrics.concision < 1.0, `Expected <1.0, got ${metrics.concision}`);
});

test("parseArgs supports --trials and --parallel flags", () => {
  const opts = parseArgs(["--trials", "5", "--parallel", "3"]);
  assert.strictEqual(opts.trials, 5);
  assert.strictEqual(opts.parallel, 3);
});

test("parseArgs defaults trials to 1 and parallel to 1", () => {
  const opts = parseArgs([]);
  assert.strictEqual(opts.trials, 1);
  assert.strictEqual(opts.parallel, 1);
});

test("evaluateResponse includes behavioralMetrics in result", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const testCase = {
    expectedPrimaryExpert: "expert-engineer-peirce",
    expectedSections: ["Answer"],
    allowedHandoffs: [],
    forbiddenBehaviors: [],
    behavioralAssertions: []
  };

  const response = {
    routingDecision: { selectedExpert: "expert-engineer-peirce" },
    activeExpert: "expert-engineer-peirce",
    handoffs: [],
    outputSections: ["Answer"],
    confidenceLabeled: true,
    personaBlend: false,
    domainStayedInScope: true,
    response: "## Answer\nUse optional chaining: user?.name"
  };

  const result = evaluateResponse(system, testCase, response);
  assert.ok(result.behavioralMetrics, "Missing behavioralMetrics");
  assert.ok(typeof result.behavioralMetrics.overEngineering === "number");
  assert.ok(typeof result.behavioralMetrics.concision === "number");
});

// ── Ablation Report ─────────────────────────────────────────────────

test("formatAblationReport renders table with all sections", () => {
  const report = {
    timestamp: "2026-03-31",
    trialsPerCondition: 3,
    sections: [
      {
        id: "logging-protocol",
        description: "Logging Protocol",
        charsSaved: 350,
        controlMean: 1.8,
        ablatedMean: 1.7,
        passHatKDelta: 0,
        overEngineeringDelta: 0.0,
        concisionDelta: 0.0,
        verdict: "KEEP"
      },
      {
        id: "expert-philosophy",
        description: "Core Philosophy",
        charsSaved: 200,
        controlMean: 1.9,
        ablatedMean: 1.9,
        passHatKDelta: 0,
        overEngineeringDelta: 0.0,
        concisionDelta: 0.0,
        verdict: "REVIEW"
      }
    ]
  };

  const md = formatAblationReport(report);
  assert.match(md, /# Ablation Report/);
  assert.match(md, /logging-protocol/);
  assert.match(md, /expert-philosophy/);
  assert.match(md, /KEEP/);
  assert.match(md, /REVIEW/);
  assert.match(md, /Trials per condition: 3/);
});

// ── Ablation Build ──────────────────────────────────────────────────

import { generateArtifacts } from "./build-prompt-system.mjs";

test("ablation mode produces artifacts without the ablated section", () => {
  const system = JSON.parse(JSON.stringify(globalSystem));
  const control = generateArtifacts(system, {});
  const ablated = generateArtifacts(system, { ablation: "behavioral-guardrails" });

  for (const [filePath, content] of control) {
    if (filePath.includes("expert-") && !filePath.includes("00-init") && !filePath.includes("01-router")) {
      const ablatedContent = ablated.get(filePath);
      if (content.includes("Behavioral Guardrails")) {
        assert.ok(
          !ablatedContent.includes("Behavioral Guardrails"),
          `${filePath}: behavioral guardrails should be ablated`
        );
      }
    }
  }
});

test("ablation mode produces smaller artifacts than control", () => {
  const system = JSON.parse(JSON.stringify(globalSystem));
  const control = generateArtifacts(system, {});
  const ablated = generateArtifacts(system, { ablation: "logging-protocol" });

  let controlSize = 0;
  let ablatedSize = 0;
  for (const [, content] of control) controlSize += content.length;
  for (const [, content] of ablated) ablatedSize += content.length;

  assert.ok(
    ablatedSize < controlSize,
    `Ablated (${ablatedSize}) should be smaller than control (${controlSize})`
  );
});
