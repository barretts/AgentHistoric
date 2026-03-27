import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildWrappedPrompt,
  evaluateResponse,
  expectedResponseSections,
  loadRegressionFixtures,
  parseArgs,
  routePrompt
} from "./regression.mjs";
import { loadPromptSystemSpec } from "./prompt-system.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

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
