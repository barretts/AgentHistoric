import test from "node:test";
import assert from "node:assert/strict";

const HANDSAKE_RE = /^\s*\[rules:loaded\s+init\s+router\s+experts@(\d+)\]/;
const TRAILER_RE = /Announce:\s*"Assimilated:\s*([a-zA-Z0-9_-]+)"/g;
const LOGGING_RE = /(?:>|\| tee)\s*\.logs\//;
const ROUTING_RE = /Selected Expert.*\nReason.*\nConfidence/ms;
const UNCERTAINTY_RE = /\b(VERIFIED|HYPOTHESIS)\b/;

function parseHandshake(s) {
  const m = s.match(HANDSAKE_RE);
  return m ? { present: true, count: parseInt(m[1], 10) } : { present: false, count: 0 };
}

function parseTrailers(s, ids) {
  const found = [...s.matchAll(TRAILER_RE)].map(m => m[1]);
  return {
    present: ids.every(id => found.includes(id)),
    proportion: ids.length > 0 ? found.filter(id => ids.includes(id)).length / ids.length : 0,
    found
  };
}

function parseLogging(tc) {
  if (!tc?.length) return { proportion: 0, compliant: 0, total: 0 };
  const runs = tc.filter(t => t.type === "run_command");
  const total = runs.length;
  const compliant = runs.filter(t => LOGGING_RE.test(t.command)).length;
  return { proportion: total > 0 ? compliant / total : 0, compliant, total };
}

function parseRouting(s) {
  return { present: ROUTING_RE.test(s) };
}

function parseUncertainty(s) {
  const sentences = s.split(/[.!?]/).filter(s => s.trim().length > 10);
  const labeled = sentences.filter(s => UNCERTAINTY_RE.test(s));
  return { proportion: sentences.length > 0 ? labeled.length / sentences.length : 0 };
}

function runAudit(transcripts) {
  const results = transcripts.map(t => ({
    id: t.id,
    handshake_present: parseHandshake(t.result).present,
    logging_compliance: parseLogging(t.toolCalls).proportion,
    routing_block_present: parseRouting(t.result).present,
    uncertainty_labeling: parseUncertainty(t.result).proportion,
  }));
  const n = results.length;
  return {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      handshakePresentRate: results.filter(r => r.handshake_present).length / n,
      loggingComplianceRate: results.reduce((s, r) => s + r.logging_compliance, 0) / n,
      routingBlockPresentRate: results.filter(r => r.routing_block_present).length / n,
      uncertaintyLabelingRate: results.reduce((s, r) => s + r.uncertainty_labeling, 0) / n,
    }
  };
}

const T = {
  compliant: {
    id: "compliant",
    result: `[rules:loaded init router experts@11] Selected Expert: expert-engineer-peirce. Running tests now.
Selected Expert: expert-engineer-peirce
Reason: Implementation task
Confidence: 0.85

VERIFIED: Tests pass.`,
    toolCalls: [
      { type: "run_command", command: "npm test > .logs/run-tests-1699999999.log 2>&1" }
    ]
  },
  noHandshake: {
    id: "noHandshake",
    result: `Selected Expert: expert-engineer-peirce. Running tests.`,
    toolCalls: [
      { type: "run_command", command: "npm test > .logs/run-tests-1699999999.log 2>&1" }
    ]
  },
  noLogging: {
    id: "noLogging",
    result: `[rules:loaded init router experts@11] Selected Expert: expert-engineer-peirce.
Running tests. npm test | tail -20`,
    toolCalls: [
      { type: "run_command", command: "npm test | tail -20" }
    ]
  },
  noRouting: {
    id: "noRouting",
    result: `[rules:loaded init router experts@11] Running the tests now.`,
    toolCalls: [
      { type: "run_command", command: "npm test > .logs/run-tests-1699999999.log 2>&1" }
    ]
  },
  noTrailer: {
    id: "noTrailer",
    result: `[rules:loaded init router experts@11] Expert loaded. Running tests.`,
    toolCalls: [
      { type: "run_command", command: "npm test > .logs/run-tests-1699999999.log 2>&1" }
    ]
  },
  noUncertainty: {
    id: "noUncertainty",
    result: `[rules:loaded init router experts@11] Selected Expert: expert-engineer-peirce.
This is the fix. It works.`,
    toolCalls: [
      { type: "run_command", command: "npm test > .logs/run-tests-1699999999.log 2>&1" }
    ]
  },
  mixed: {
    id: "mixed",
    result: `[rules:loaded init router experts@11] Selected Expert: expert-engineer-peirce
Reason: Implementation
Confidence: 0.80
VERIFIED: The bug is fixed.

Announce: "Assimilated: expert-engineer-peirce"`,
    toolCalls: [
      { type: "run_command", command: "npm test > .logs/run-tests-1699999999.log 2>&1" },
      { type: "run_command", command: "pytest | tail -5" }
    ]
  }
};

test("handshake regex detects valid handshake token", () => {
  const r = parseHandshake(`[rules:loaded init router experts@11] Selected Expert: ...`);
  assert.strictEqual(r.present, true);
  assert.strictEqual(r.count, 11);
});

test("handshake regex rejects missing handshake", () => {
  const r = parseHandshake(`Selected Expert: expert-engineer-peirce.`);
  assert.strictEqual(r.present, false);
});

test("handshake regex rejects wrong format", () => {
  const r = parseHandshake(`[rules: loaded init router experts@11] Selected Expert: ...`);
  assert.strictEqual(r.present, false);
});

test("trailer regex extracts expert id", () => {
  const r = parseTrailers(`Announce: "Assimilated: expert-engineer-peirce"`, ["expert-engineer-peirce"]);
  assert.strictEqual(r.present, true);
  assert.deepEqual(r.found, ["expert-engineer-peirce"]);
});

test("trailer regex returns proportion when no match", () => {
  const r = parseTrailers(`No trailer here`, ["expert-engineer-peirce"]);
  assert.strictEqual(r.present, false);
  assert.strictEqual(r.proportion, 0);
});

test("logging regex detects > .logs/ suffix", () => {
  assert.match(`npm test > .logs/run-tests-1699999999.log 2>&1`, LOGGING_RE);
  assert.match(`echo "hi" | tee .logs/output.log`, LOGGING_RE);
});

test("logging regex rejects piped filter", () => {
  assert.ok(!LOGGING_RE.test(`npm test | tail -20`));
  assert.ok(!LOGGING_RE.test(`pytest | grep fail`));
});

test("routing block regex detects standard routing block", () => {
  const c = `Selected Expert: expert-engineer-peirce
Reason: Implementation
Confidence: 0.85`;
  assert.strictEqual(parseRouting(c).present, true);
});

test("routing block regex rejects missing routing block", () => {
  assert.strictEqual(parseRouting(`Running the tests now.`).present, false);
});

test("uncertainty label regex finds VERIFIED", () => {
  assert.ok(parseUncertainty(`VERIFIED: The bug is fixed. It works correctly.`).proportion > 0);
});

test("uncertainty label regex finds HYPOTHESIS", () => {
  assert.ok(parseUncertainty(`This might be a race condition. HYPOTHESIS: needs testing.`).proportion > 0);
});

test("compliant transcript passes all checks", () => {
  const t = T.compliant;
  assert.strictEqual(parseHandshake(t.result).present, true);
  assert.strictEqual(parseLogging(t.toolCalls).proportion, 1);
});

test("noHandshake transcript fails handshake check", () => {
  assert.strictEqual(parseHandshake(T.noHandshake.result).present, false);
});

test("noLogging transcript fails logging compliance", () => {
  assert.strictEqual(parseLogging(T.noLogging.toolCalls).proportion, 0);
});

test("noRoutingBlock transcript fails routing block check", () => {
  assert.strictEqual(parseRouting(T.noRouting.result).present, false);
});

test("noUncertaintyLabel transcript fails uncertainty labeling", () => {
  assert.strictEqual(parseUncertainty(T.noUncertainty.result).proportion, 0);
});

test("mixed transcript has partial logging compliance", () => {
  assert.strictEqual(parseLogging(T.mixed.toolCalls).proportion, 0.5);
});

test("auditReport generates correct JSON structure", () => {
  const report = runAudit(Object.values(T));
  assert.ok(report.timestamp);
  assert.ok(Array.isArray(report.results));
  assert.ok(report.summary);
  assert.strictEqual(typeof report.summary.handshakePresentRate, "number");
  assert.strictEqual(typeof report.summary.loggingComplianceRate, "number");
});

test("auditReport computes aggregate proportions correctly", () => {
  const report = runAudit([T.compliant, T.noHandshake]);
  assert.strictEqual(report.summary.handshakePresentRate, 0.5);
  assert.strictEqual(report.summary.loggingComplianceRate, 1.0);
});
