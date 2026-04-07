#!/usr/bin/env node

/**
 * Batch experiment runner — loops through suites, models, and phases.
 *
 * Usage:
 *   node scripts/run-batch-experiment.mjs                    # all phases
 *   node scripts/run-batch-experiment.mjs --phase 2          # single phase
 *   node scripts/run-batch-experiment.mjs --phase 2 --dry    # preview commands
 *   node scripts/run-batch-experiment.mjs --phase 3 --model claude-4.6-opus-high
 *
 * Phases:
 *   1  Local accuracy check (no API calls)
 *   2  Full specialist-pressure + mixed-intent (both models)
 *   3  A/B anti-triggers on real LLMs
 *   4  Two-pass routing validation (TP1-TP6)
 *   5  Persona vs neutral baseline (PN1-PN4)
 */

import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { execSync, spawn } from "node:child_process";
import { loadPromptSystemSpec } from "./lib/prompt-system.mjs";
import {
  loadRegressionFixtures,
  selectCases,
  routePrompt,
  createTimestamp
} from "./lib/regression.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const MODELS = ["claude-4.6-opus-high", "gpt-5.4-medium"];
const RESULTS_DIR = path.join(workspaceRoot, ".logs", "batch-experiments");

function parseArgs(argv) {
  const opts = { phase: null, dry: false, model: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--phase") opts.phase = parseInt(argv[++i], 10);
    if (argv[i] === "--dry") opts.dry = true;
    if (argv[i] === "--model") opts.model = argv[++i];
  }
  return opts;
}

function runAgent(caseId, model, suite) {
  const args = [
    "scripts/run-regressions.mjs",
    "--suite", suite,
    "--targets", "cursor",
    "--cursor-model", model,
    "--case", caseId
  ];
  const result = execSync(`node ${args.join(" ")}`, {
    cwd: workspaceRoot,
    encoding: "utf8",
    timeout: 120_000
  });
  return result;
}

function extractResult(summaryDir, caseId) {
  try {
    const files = execSync(`ls -t ${summaryDir}/regression-summary-*.json`, {
      encoding: "utf8",
      cwd: workspaceRoot
    }).trim().split("\n");
    const latest = files[0];
    const data = JSON.parse(execSync(`cat ${latest}`, { encoding: "utf8" }));
    const match = data.results?.find((r) => r.caseId === caseId);
    if (match) {
      return {
        caseId: match.caseId,
        score: match.score?.score,
        expert: match.selectedExpert,
        expected: match.expectedExpert,
        pass: match.selectedExpert === match.expectedExpert
      };
    }
  } catch { /* ignore */ }
  return null;
}

async function phase1(system, fixtures) {
  console.log("\n=== PHASE 1: Local Accuracy Check (no API calls) ===\n");
  const suites = ["specialist-pressure", "mixed-intent", "twopass", "persona-vs-neutral"];
  const rows = [];

  for (const suiteName of suites) {
    const cases = selectCases(fixtures, { suite: suiteName, targets: ["cursor", "codex"] });
    let correct = 0;
    const misses = [];
    for (const c of cases) {
      const routed = routePrompt(system, c.prompt);
      if (routed === c.expectedPrimaryExpert) {
        correct++;
      } else {
        misses.push({ id: c.id, expected: c.expectedPrimaryExpert, got: routed });
      }
    }
    const accuracy = cases.length > 0 ? (correct / cases.length * 100).toFixed(1) : "n/a";
    rows.push({ suite: suiteName, total: cases.length, correct, accuracy: `${accuracy}%`, misses });
    console.log(`  ${suiteName}: ${correct}/${cases.length} (${accuracy}%)`);
    for (const m of misses) {
      console.log(`    MISS ${m.id}: expected ${m.expected}, got ${m.got}`);
    }
  }

  // Full suite
  const fullCases = selectCases(fixtures, { suite: "full", targets: ["cursor", "codex"] });
  let fullCorrect = 0;
  for (const c of fullCases) {
    if (routePrompt(system, c.prompt) === c.expectedPrimaryExpert) fullCorrect++;
  }
  console.log(`\n  FULL: ${fullCorrect}/${fullCases.length} (${(fullCorrect / fullCases.length * 100).toFixed(1)}%)`);
  return rows;
}

async function runRealPhase(phaseName, caseIds, suite, models, dry) {
  console.log(`\n=== ${phaseName} ===\n`);
  const allResults = [];

  for (const model of models) {
    console.log(`  Model: ${model}`);
    for (const caseId of caseIds) {
      if (dry) {
        console.log(`    [DRY] would run: ${caseId} with ${model}`);
        continue;
      }
      process.stdout.write(`    ${caseId}...`);
      try {
        runAgent(caseId, model, suite);
        const result = extractResult(path.join(workspaceRoot, ".logs"), caseId);
        if (result) {
          const status = result.pass ? "PASS" : `MISS (got ${result.expert})`;
          console.log(` score=${result.score} ${status}`);
          allResults.push({ ...result, model });
        } else {
          console.log(` (no result parsed)`);
          allResults.push({ caseId, model, pass: false, error: "parse-failed" });
        }
      } catch (err) {
        console.log(` ERROR: ${err.message?.slice(0, 80)}`);
        allResults.push({ caseId, model, pass: false, error: err.message?.slice(0, 120) });
      }
    }
  }

  return allResults;
}

function generateReport(phaseResults, timestamp) {
  const lines = [`# Batch Experiment Results\n`, `Timestamp: ${timestamp}\n`];

  for (const [phaseName, results] of Object.entries(phaseResults)) {
    if (!results || results.length === 0) continue;
    lines.push(`\n## ${phaseName}\n`);

    // Group by model
    const byModel = {};
    for (const r of results) {
      const model = r.model || "local";
      if (!byModel[model]) byModel[model] = [];
      byModel[model].push(r);
    }

    for (const [model, modelResults] of Object.entries(byModel)) {
      const total = modelResults.length;
      const passed = modelResults.filter((r) => r.pass).length;
      lines.push(`### ${model}: ${passed}/${total} (${(passed / total * 100).toFixed(1)}%)\n`);
      lines.push(`| Case | Expected | Got | Score | Status |`);
      lines.push(`|------|----------|-----|-------|--------|`);
      for (const r of modelResults) {
        const status = r.pass ? "PASS" : r.error ? `ERROR` : "MISS";
        lines.push(`| ${r.caseId} | ${r.expected || "-"} | ${r.expert || r.error || "-"} | ${r.score ?? "-"} | ${status} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const system = await loadPromptSystemSpec(workspaceRoot);
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const timestamp = createTimestamp();
  const models = args.model ? [args.model] : MODELS;

  await mkdir(RESULTS_DIR, { recursive: true });

  const phaseResults = {};

  // Phase 1: Local accuracy
  if (!args.phase || args.phase === 1) {
    phaseResults["Phase 1: Local Accuracy"] = await phase1(system, fixtures);
  }

  // Phase 2: Full specialist-pressure + mixed-intent
  if (!args.phase || args.phase === 2) {
    const spCases = selectCases(fixtures, { suite: "specialist-pressure", targets: ["cursor"] });
    const miCases = selectCases(fixtures, { suite: "mixed-intent", targets: ["cursor"] });
    const caseIds = [...spCases, ...miCases].map((c) => c.id);
    phaseResults["Phase 2: Specialist + Mixed-Intent"] = await runRealPhase(
      "PHASE 2: Specialist-Pressure + Mixed-Intent (real LLM)",
      caseIds, "full", models, args.dry
    );
  }

  // Phase 3: A/B anti-triggers — run same cases with flags toggled
  if (!args.phase || args.phase === 3) {
    // This phase uses the experiment runner, not the regression runner
    console.log(`\n=== PHASE 3: A/B Anti-Triggers (real LLM) ===\n`);
    const spCases = selectCases(fixtures, { suite: "specialist-pressure", targets: ["cursor"] });
    const caseIds = spCases.map((c) => c.id);
    phaseResults["Phase 3: A/B Anti-Triggers"] = await runRealPhase(
      "PHASE 3: Anti-Trigger A/B",
      caseIds, "specialist-pressure", models, args.dry
    );
  }

  // Phase 4: Two-pass routing (TP1-TP6)
  if (!args.phase || args.phase === 4) {
    const tpCases = selectCases(fixtures, { suite: "twopass", targets: ["cursor"] });
    const caseIds = tpCases.map((c) => c.id);
    phaseResults["Phase 4: Two-Pass Routing"] = await runRealPhase(
      "PHASE 4: Two-Pass Routing (TP1-TP6)",
      caseIds, "twopass", models, args.dry
    );
  }

  // Phase 5: Persona vs neutral (PN1-PN4)
  if (!args.phase || args.phase === 5) {
    const pnCases = selectCases(fixtures, { suite: "persona-vs-neutral", targets: ["cursor"] });
    const caseIds = pnCases.map((c) => c.id);
    phaseResults["Phase 5: Persona vs Neutral"] = await runRealPhase(
      "PHASE 5: Persona vs Neutral (PN1-PN4)",
      caseIds, "persona-vs-neutral", models, args.dry
    );
  }

  // Generate combined report
  const report = generateReport(phaseResults, timestamp);
  const reportPath = path.join(RESULTS_DIR, `batch-${timestamp}.md`);
  await writeFile(reportPath, report, "utf8");
  console.log(`\nReport saved to ${path.relative(workspaceRoot, reportPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
