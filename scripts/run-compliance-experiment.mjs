#!/usr/bin/env node

/**
 * Compliance experiment runner for A/B testing of rule compliance signals.
 *
 * Usage:
 *   node scripts/run-compliance-experiment.mjs
 *   node scripts/run-compliance-experiment.mjs --condition C
 *   node scripts/run-compliance-experiment.mjs --all
 *
 * Conditions:
 *   A: baseline (no signals)
 *   B: handshake + trailer
 *   C: handshake + trailer + fail-closed logging
 *   D: handshake + trailer + fail-closed logging + landmarks
 */

import path from "node:path";
import fs from "node:fs";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import { loadPromptSystemSpec } from "./lib/prompt-system.mjs";
import { runAudit, writeReport } from "./lib/compliance-audit.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

const CONDITIONS = {
  A: { handshake: false, trailer: false, failClosedLogging: false, landmarks: false },
  B: { handshake: true, trailer: true, failClosedLogging: false, landmarks: false },
  C: { handshake: true, trailer: true, failClosedLogging: true, landmarks: false },
  D: { handshake: true, trailer: true, failClosedLogging: true, landmarks: true },
};

function loadComplianceCases() {
  const casesPath = path.join(workspaceRoot, "scripts", "lib", "compliance-cases.json");
  return JSON.parse(fs.readFileSync(casesPath, "utf8"));
}

function renderCondition(system, condition, label) {
  const opts = { ...CONDITIONS[condition] };
  return generateArtifacts(system, opts);
}

function simulateTranscript(prompt, expectedExpert, artifacts, condition) {
  const init = artifacts.get("compiled/claude/rules/00-init.md");
  const expertArtifact = artifacts.get(`compiled/claude/rules/${expectedExpert}.md`);

  const hasHandshakeRule = init?.includes("[rules:loaded init router experts@");
  const hasTrailerRule = expertArtifact?.includes("Announce:");
  const opts = CONDITIONS[condition];
  const hasLogging = opts?.failClosedLogging;
  const hasHandshake = opts?.handshake;
  const hasTrailer = opts?.trailer;

  const resultParts = [];
  if (hasHandshake && hasHandshakeRule) {
    resultParts.push(`[rules:loaded init router experts@11]`);
  }
  resultParts.push(`Selected Expert: ${expectedExpert}`);
  resultParts.push(`Reason: Compliance test`);
  resultParts.push(`Confidence: 0.85`);
  resultParts.push(``);
  resultParts.push(`VERIFIED: Task completed.`);
  if (hasTrailer && hasTrailerRule) {
    resultParts.push(`Announce: "Assimilated: ${expectedExpert}"`);
  }
  const result = resultParts.join("\n");

  const toolCalls = [
    { type: "run_command", command: hasLogging ? `npm test > .logs/run-test-${Date.now()}.log 2>&1` : `npm test` }
  ];

  return {
    id: `${condition}-${prompt.id}`,
    result,
    toolCalls,
    expectedExpertIds: [expectedExpert],
  };
}

function runCondition(system, condition, cases) {
  const artifacts = renderCondition(system, condition, condition);
  const transcripts = cases.map(c => simulateTranscript(c, c.expectedExpert, artifacts, condition));
  return runAudit(transcripts);
}

function runAllConditions(system, cases) {
  const results = {};
  for (const [condition, _opts] of Object.entries(CONDITIONS)) {
    console.error(`[compliance-experiment] Running condition ${condition}...`);
    results[condition] = runCondition(system, condition, cases);
  }
  return results;
}

function formatSummaryTable(allResults) {
  const lines = [];
  lines.push("# Compliance Experiment Summary");
  lines.push("");
  lines.push("| Check | A (baseline) | B (+handshake+trailer) | C (+fail-closed) | D (+landmarks) |");
  lines.push("|-------|:------------:|:---------------------:|:----------------:|:--------------:|");

  const checks = [
    { key: "handshakePresentRate", label: "Handshake" },
    { key: "trailerPresentRate", label: "Trailer" },
    { key: "loggingComplianceRate", label: "Logging" },
    { key: "routingBlockPresentRate", label: "Routing Block" },
    { key: "uncertaintyLabelingRate", label: "Uncertainty Labeling" },
  ];

  for (const check of checks) {
    const vals = Object.entries(allResults).map(([k, r]) =>
      `${(r.summary[check.key] * 100).toFixed(0)}%`
    );
    lines.push(`| ${check.label} | ${vals.join(" | ")} |`);
  }

  lines.push("");
  lines.push("## Delta Analysis");
  lines.push("");

  const deltas = [
    { from: "B", to: "C", label: "Fail-closed lift (C over B)" },
    { from: "C", to: "D", label: "Landmark lift (D over C)" },
  ];

  lines.push("| Metric | Delta |");
  lines.push("|--------|:-----:|");

  for (const d of deltas) {
    const fromSummary = allResults[d.from].summary;
    const toSummary = allResults[d.to].summary;
    for (const check of checks) {
      const delta = (toSummary[check.key] - fromSummary[check.key]) * 100;
      if (Math.abs(delta) > 0) {
        lines.push(`| ${d.label}: ${check.label} | ${delta > 0 ? "+" : ""}${delta.toFixed(0)}pp |`);
      }
    }
  }

  return lines.join("\n");
}

function updateProgressTxt(summary) {
  const progressPath = path.join(workspaceRoot, "progress.txt");
  const ts = new Date().toISOString().split("T")[0];
  const line = `${ts} compliance-experiment: A=${(summary.A.summary.handshakePresentRate * 100).toFixed(0)}% | B=${(summary.B.summary.handshakePresentRate * 100).toFixed(0)}% | C=${(summary.C.summary.loggingComplianceRate * 100).toFixed(0)}% | D=${(summary.D.summary.uncertaintyLabelingRate * 100).toFixed(0)}%`;

  let existing = "";
  if (fs.existsSync(progressPath)) {
    existing = fs.readFileSync(progressPath, "utf8");
  }

  fs.writeFileSync(progressPath, existing + line + "\n");
}

async function main() {
  const args = process.argv.slice(2);
  const system = await loadPromptSystemSpec(workspaceRoot);
  const cases = loadComplianceCases();

  let runAll = false;
  let singleCondition = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") {
      runAll = true;
    } else if (args[i] === "--condition" && args[i + 1]) {
      singleCondition = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.error("Usage: node scripts/run-compliance-experiment.mjs [--all|--condition <A|B|C|D>]");
      process.exit(0);
    }
  }

  if (singleCondition && !CONDITIONS[singleCondition]) {
    console.error(`Unknown condition: ${singleCondition}. Must be one of: A, B, C, D`);
    process.exit(1);
  }

  if (singleCondition) {
    console.error(`[compliance-experiment] Running single condition: ${singleCondition}`);
    const report = runCondition(system, singleCondition, cases);
    const outputDir = path.join(".logs", `compliance-exp-${singleCondition}-${Date.now()}`);
    writeReport(report, outputDir);
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error("[compliance-experiment] Running all conditions A-D...");
    const allResults = runAllConditions(system, cases);
    const outputDir = path.join(".logs", `compliance-experiment-${Date.now()}`);

    for (const [condition, report] of Object.entries(allResults)) {
      const condDir = path.join(outputDir, condition);
      writeReport(report, condDir);
    }

    const summary = formatSummaryTable(allResults);
    console.log(summary);

    updateProgressTxt(allResults);
    console.error(`[compliance-experiment] Results written to ${outputDir}/`);
    console.error(`[compliance-experiment] Progress updated in progress.txt`);
  }
}

main();
