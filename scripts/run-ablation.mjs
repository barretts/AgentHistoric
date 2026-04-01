#!/usr/bin/env node

import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { loadPromptSystemSpec } from "./lib/prompt-system.mjs";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import {
  aggregateTrialResults,
  buildWrappedPrompt,
  createTimestamp,
  ensureLogsDirectory,
  formatAblationReport,
  loadRegressionFixtures,
  parseAgentCliResult,
  parseArgs,
  parseCodexJsonlResult,
  runCommandLogged,
  runTrials,
  scoreCase,
  selectCases
} from "./lib/regression.mjs";

const workspaceRoot = process.cwd();
const system = await loadPromptSystemSpec(workspaceRoot);
const options = parseArgs(process.argv.slice(2));
const trials = Math.max(options.trials, 3);
const timestamp = createTimestamp();
const fixtures = await loadRegressionFixtures(workspaceRoot);
const cases = selectCases(fixtures, options);
const logDir = await ensureLogsDirectory(workspaceRoot);

const manifest = JSON.parse(
  await readFile(
    path.join(workspaceRoot, "regression", "ablation-manifest.json"),
    "utf8"
  )
);

const report = {
  timestamp,
  trialsPerCondition: trials,
  sections: []
};

for (const section of manifest.sections) {
  console.log(`\nAblating: ${section.id} — ${section.description}`);

  const controlArtifacts = generateArtifacts(system, {});
  const ablatedArtifacts = generateArtifacts(system, { ablation: section.id });

  let controlTokens = 0;
  let ablatedTokens = 0;
  for (const [filePath, content] of controlArtifacts) {
    controlTokens += content.length;
  }
  for (const [filePath, content] of ablatedArtifacts) {
    ablatedTokens += content.length;
  }
  const charsSaved = controlTokens - ablatedTokens;

  const controlResults = [];
  const ablatedResults = [];

  for (const testCase of cases) {
    for (const target of options.targets.filter((t) =>
      testCase.targets.includes(t)
    )) {
      const wrappedPrompt = buildWrappedPrompt(testCase);

      const controlTrials = await runTrials(
        async (trialIndex) => {
          const rawLogPath = path.join(
            logDir,
            `ablation-${timestamp}-${section.id}-control-${testCase.id}-${target}-t${trialIndex}.log`
          );
          const response = await runTarget({
            target,
            wrappedPrompt,
            rawLogPath,
            options
          });
          const score = scoreCase(system, testCase, response);
          return {
            score: score.score,
            selectedExpert: score.selectedExpert,
            expectedExpert: testCase.expectedPrimaryExpert,
            behavioralMetrics: score.behavioralMetrics
          };
        },
        { trials, parallel: options.parallel }
      );

      const ablatedTrials = await runTrials(
        async (trialIndex) => {
          const rawLogPath = path.join(
            logDir,
            `ablation-${timestamp}-${section.id}-ablated-${testCase.id}-${target}-t${trialIndex}.log`
          );
          const response = await runTarget({
            target,
            wrappedPrompt,
            rawLogPath,
            options
          });
          const score = scoreCase(system, testCase, response);
          return {
            score: score.score,
            selectedExpert: score.selectedExpert,
            expectedExpert: testCase.expectedPrimaryExpert,
            behavioralMetrics: score.behavioralMetrics
          };
        },
        { trials, parallel: options.parallel }
      );

      controlResults.push(...controlTrials);
      ablatedResults.push(...ablatedTrials);
    }
  }

  const controlAgg = aggregateTrialResults(controlResults);
  const ablatedAgg = aggregateTrialResults(ablatedResults);

  const controlOE = mean(controlResults.map((r) => r.behavioralMetrics?.overEngineering ?? 1));
  const ablatedOE = mean(ablatedResults.map((r) => r.behavioralMetrics?.overEngineering ?? 1));
  const controlConc = mean(controlResults.map((r) => r.behavioralMetrics?.concision ?? 1));
  const ablatedConc = mean(ablatedResults.map((r) => r.behavioralMetrics?.concision ?? 1));

  const passHatKDelta = (ablatedAgg.passHatK ? 1 : 0) - (controlAgg.passHatK ? 1 : 0);

  report.sections.push({
    id: section.id,
    description: section.description,
    charsSaved,
    controlMean: controlAgg.meanScore,
    ablatedMean: ablatedAgg.meanScore,
    passHatKDelta,
    overEngineeringDelta: round(ablatedOE - controlOE),
    concisionDelta: round(ablatedConc - controlConc),
    verdict: deriveVerdict(controlAgg, ablatedAgg, controlOE, ablatedOE, controlConc, ablatedConc)
  });
}

const jsonPath = path.join(logDir, `ablation-report-${timestamp}.json`);
const mdPath = path.join(logDir, `ablation-report-${timestamp}.md`);

await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
await writeFile(mdPath, formatAblationReport(report), "utf8");

console.log(`\nJSON report: ${path.relative(workspaceRoot, jsonPath)}`);
console.log(`Markdown report: ${path.relative(workspaceRoot, mdPath)}`);

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function deriveVerdict(controlAgg, ablatedAgg, controlOE, ablatedOE, controlConc, ablatedConc) {
  const scoreDelta = ablatedAgg.meanScore - controlAgg.meanScore;
  const oeDelta = ablatedOE - controlOE;
  const concDelta = ablatedConc - controlConc;

  if (scoreDelta < -0.15 || oeDelta < -0.1 || concDelta < -0.1) return "KEEP";
  if (scoreDelta > 0.15 || oeDelta > 0.1 || concDelta > 0.1) return "REMOVE";
  return "REVIEW";
}

async function runTarget({ target, wrappedPrompt, rawLogPath }) {
  if (target === "cursor") {
    const cursorArgs = [
      "--print", "--output-format", "json",
      "--mode", "ask", "--trust",
      "--workspace", workspaceRoot
    ];
    if (options.modelByTarget.cursor) {
      cursorArgs.push("--model", options.modelByTarget.cursor);
    }
    cursorArgs.push(wrappedPrompt);

    const result = await runCommandLogged({
      command: "agent",
      args: cursorArgs,
      outputPath: rawLogPath,
      workingDirectory: workspaceRoot
    });

    if (result.code !== 0) {
      throw new Error(`Cursor agent run failed for ${rawLogPath}`);
    }
    return parseAgentCliResult(result.combinedOutput);
  }

  if (target === "codex") {
    const codexArgs = [
      "exec", "--skip-git-repo-check",
      "-C", workspaceRoot,
      "--sandbox", "read-only", "--json",
      "--output-schema", path.join(workspaceRoot, "regression", "output-schema.json")
    ];
    if (options.modelByTarget.codex) {
      codexArgs.push("--model", options.modelByTarget.codex);
    }
    const result = await runCommandLogged({
      command: "codex",
      args: codexArgs,
      stdinText: wrappedPrompt,
      outputPath: rawLogPath,
      workingDirectory: workspaceRoot
    });
    if (result.code !== 0) {
      throw new Error(`Codex run failed for ${rawLogPath}`);
    }
    return parseCodexJsonlResult(result.combinedOutput);
  }

  throw new Error(`Unsupported target: ${target}`);
}
