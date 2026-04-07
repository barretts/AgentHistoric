#!/usr/bin/env node

/**
 * Experiment runner for A/B comparison of routing configurations.
 *
 * Usage:
 *   node scripts/run-experiment.mjs --suite specialist-pressure
 *   node scripts/run-experiment.mjs --suite specialist-pressure --disable antiTriggers
 *   node scripts/run-experiment.mjs --suite persona-vs-neutral
 *   node scripts/run-experiment.mjs --ab antiTriggers --suite full
 *   node scripts/run-experiment.mjs --ab boostSignals --suite mixed-intent
 *
 * --ab <flag>       Run A/B comparison: config-A has flag=true, config-B has flag=false
 * --suite <name>    Suite to run (default: full)
 * --disable <flag>  Disable a specific experiment flag for a single run
 */

import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { loadPromptSystemSpec } from "./lib/prompt-system.mjs";
import {
  loadRegressionFixtures,
  selectCases,
  routePrompt,
  createTimestamp
} from "./lib/regression.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

function parseExperimentArgs(argv) {
  const options = {
    suite: "full",
    ab: null,
    disable: [],
    caseIds: []
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--suite") {
      options.suite = argv[++i];
    } else if (arg === "--ab") {
      options.ab = argv[++i];
    } else if (arg === "--disable") {
      options.disable.push(argv[++i]);
    } else if (arg === "--case") {
      options.caseIds = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  return options;
}

function runLocalRouting(system, cases, flagOverrides = {}) {
  const original = { ...system.router.experimentFlags };

  // Apply overrides
  system.router.experimentFlags = {
    ...system.router.experimentFlags,
    ...flagOverrides
  };

  const results = [];
  for (const testCase of cases) {
    const routed = routePrompt(system, testCase.prompt);
    const expected = testCase.expectedPrimaryExpert;
    const match = routed === expected;
    results.push({
      id: testCase.id,
      name: testCase.name,
      category: testCase.category,
      prompt: testCase.prompt,
      expected,
      routed,
      match
    });
  }

  // Restore original flags
  system.router.experimentFlags = original;
  return results;
}

function computeMetrics(results) {
  const total = results.length;
  const correct = results.filter((r) => r.match).length;
  const accuracy = total > 0 ? correct / total : 0;

  // Per-expert breakdown
  const byExpert = {};
  for (const r of results) {
    if (!byExpert[r.expected]) {
      byExpert[r.expected] = { total: 0, correct: 0 };
    }
    byExpert[r.expected].total++;
    if (r.match) byExpert[r.expected].correct++;
  }

  // Diversity: how many unique experts were correctly routed to
  const uniqueCorrect = new Set(results.filter((r) => r.match).map((r) => r.routed));

  return {
    total,
    correct,
    accuracy: Math.round(accuracy * 1000) / 1000,
    uniqueExpertsHit: uniqueCorrect.size,
    byExpert
  };
}

function formatVerdictTable(configA, configB, metricsA, metricsB, label) {
  const lines = [];
  lines.push(`# Experiment Verdict: ${label}`);
  lines.push("");
  lines.push(`| Metric | Config A (${label}=ON) | Config B (${label}=OFF) | Delta |`);
  lines.push("|--------|:---------------------:|:----------------------:|:-----:|");

  const accDelta = metricsA.accuracy - metricsB.accuracy;
  lines.push(`| Accuracy | ${metricsA.accuracy} (${metricsA.correct}/${metricsA.total}) | ${metricsB.accuracy} (${metricsB.correct}/${metricsB.total}) | ${formatDelta(accDelta)} |`);
  lines.push(`| Unique Experts Hit | ${metricsA.uniqueExpertsHit} | ${metricsB.uniqueExpertsHit} | ${formatDelta(metricsA.uniqueExpertsHit - metricsB.uniqueExpertsHit)} |`);

  // Per-expert comparison
  const allExperts = new Set([
    ...Object.keys(metricsA.byExpert),
    ...Object.keys(metricsB.byExpert)
  ]);

  lines.push("");
  lines.push("## Per-Expert Breakdown");
  lines.push("");
  lines.push("| Expert | A correct/total | B correct/total | Delta |");
  lines.push("|--------|:--------------:|:--------------:|:-----:|");

  for (const expert of [...allExperts].sort()) {
    const a = metricsA.byExpert[expert] || { correct: 0, total: 0 };
    const b = metricsB.byExpert[expert] || { correct: 0, total: 0 };
    const aRate = a.total > 0 ? a.correct / a.total : 0;
    const bRate = b.total > 0 ? b.correct / b.total : 0;
    lines.push(`| ${expert} | ${a.correct}/${a.total} | ${b.correct}/${b.total} | ${formatDelta(aRate - bRate)} |`);
  }

  // Mismatches
  const misA = configA.filter((r) => !r.match);
  const misB = configB.filter((r) => !r.match);

  if (misA.length > 0 || misB.length > 0) {
    lines.push("");
    lines.push("## Misrouted Cases");
    lines.push("");

    const allMisIds = new Set([...misA.map((r) => r.id), ...misB.map((r) => r.id)]);
    lines.push("| Case | Config A | Config B | Expected |");
    lines.push("|------|----------|----------|----------|");

    for (const id of allMisIds) {
      const a = configA.find((r) => r.id === id);
      const b = configB.find((r) => r.id === id);
      const aStatus = a?.match ? "PASS" : `MISS -> ${a?.routed || "?"}`;
      const bStatus = b?.match ? "PASS" : `MISS -> ${b?.routed || "?"}`;
      lines.push(`| ${id} | ${aStatus} | ${bStatus} | ${a?.expected || b?.expected} |`);
    }
  }

  // Verdict
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  if (accDelta > 0.01) {
    lines.push(`**KEEP ${label}**: Config A (ON) outperforms Config B (OFF) by ${formatDelta(accDelta)} accuracy.`);
  } else if (accDelta < -0.01) {
    lines.push(`**REMOVE ${label}**: Config B (OFF) outperforms Config A (ON) by ${formatDelta(-accDelta)} accuracy.`);
  } else {
    lines.push(`**NEUTRAL**: No significant accuracy difference. Check diversity metrics and per-expert breakdown.`);
  }

  return lines.join("\n") + "\n";
}

function formatSingleRun(results, metrics, suite, flagOverrides) {
  const lines = [];
  lines.push(`# Experiment Run: ${suite}`);
  lines.push("");
  lines.push(`Flags: ${JSON.stringify(flagOverrides)}`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Accuracy | ${metrics.accuracy} (${metrics.correct}/${metrics.total}) |`);
  lines.push(`| Unique Experts Hit | ${metrics.uniqueExpertsHit} |`);
  lines.push("");

  const misses = results.filter((r) => !r.match);
  if (misses.length > 0) {
    lines.push("## Misrouted Cases");
    lines.push("");
    lines.push("| Case | Expected | Got |");
    lines.push("|------|----------|-----|");
    for (const m of misses) {
      lines.push(`| ${m.id} (${m.name}) | ${m.expected} | ${m.routed} |`);
    }
  } else {
    lines.push("All cases routed correctly.");
  }

  return lines.join("\n") + "\n";
}

function formatDelta(value) {
  if (Math.abs(value) < 0.001) return "+0.000";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(3)}`;
}

async function main() {
  const args = parseExperimentArgs(process.argv.slice(2));
  const system = await loadPromptSystemSpec(workspaceRoot);
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const cases = selectCases(fixtures, {
    suite: args.suite,
    targets: ["cursor", "codex"],
    caseIds: args.caseIds
  });

  if (cases.length === 0) {
    console.error(`No cases found for suite "${args.suite}".`);
    process.exit(1);
  }

  console.log(`Running experiment: suite=${args.suite}, cases=${cases.length}`);

  const outputDir = path.join(workspaceRoot, ".logs", "experiments");
  await mkdir(outputDir, { recursive: true });
  const timestamp = createTimestamp();

  if (args.ab) {
    // A/B comparison mode
    const flagName = args.ab;
    console.log(`A/B mode: comparing ${flagName}=true vs ${flagName}=false`);

    const configA = runLocalRouting(system, cases, { [flagName]: true });
    const configB = runLocalRouting(system, cases, { [flagName]: false });
    const metricsA = computeMetrics(configA);
    const metricsB = computeMetrics(configB);

    const report = formatVerdictTable(configA, configB, metricsA, metricsB, flagName);
    const outPath = path.join(outputDir, `ab-${flagName}-${args.suite}-${timestamp}.md`);
    await writeFile(outPath, report, "utf8");

    console.log(report);
    console.log(`Saved to ${outPath}`);
  } else {
    // Single run mode
    const flagOverrides = {};
    for (const flag of args.disable) {
      flagOverrides[flag] = false;
    }

    const results = runLocalRouting(system, cases, flagOverrides);
    const metrics = computeMetrics(results);
    const report = formatSingleRun(results, metrics, args.suite, flagOverrides);
    const outPath = path.join(outputDir, `run-${args.suite}-${timestamp}.md`);
    await writeFile(outPath, report, "utf8");

    console.log(report);
    console.log(`Saved to ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
