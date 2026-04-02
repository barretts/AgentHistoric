#!/usr/bin/env node

import path from "node:path";
import { writeFile } from "node:fs/promises";
import { loadPromptSystemSpec } from "./lib/prompt-system.mjs";
import {
  aggregateTrialResults,
  buildWrappedPrompt,
  compareTargets,
  createTimestamp,
  ensureLogsDirectory,
  formatSummary,
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
const timestamp = createTimestamp();
const fixtures = await loadRegressionFixtures(workspaceRoot);
const cases = selectCases(fixtures, options);
const logDir = await ensureLogsDirectory(workspaceRoot);

const run = {
  suite: options.suite,
  targets: options.targets,
  timestamp,
  trialsPerCase: options.trials,
  caseCount: cases.length,
  results: [],
  aggregated: [],
  parity: []
};

for (const testCase of cases) {
  const resultsByTarget = {};

  for (const target of options.targets.filter((item) =>
    testCase.targets.includes(item)
  )) {
    const trialResults = await runTrials(
      async (trialIndex) => {
        const wrappedPrompt = buildWrappedPrompt(testCase);
        const trialSuffix = options.trials > 1 ? `-t${trialIndex}` : "";
        const rawLogPath = path.join(
          logDir,
          `regression-${timestamp}-${testCase.id}-${target}${trialSuffix}.log`
        );

        const response = await runTarget({
          target,
          wrappedPrompt,
          rawLogPath
        });

        const score = scoreCase(system, testCase, response);
        return {
          caseId: testCase.id,
          caseName: testCase.name,
          target,
          trialIndex,
          rawLogPath: path.relative(workspaceRoot, rawLogPath),
          response,
          score,
          selectedExpert: score.selectedExpert,
          expectedExpert: testCase.expectedPrimaryExpert
        };
      },
      { trials: options.trials, parallel: options.parallel }
    );

    for (const result of trialResults) {
      run.results.push(result);
    }

    if (options.trials > 1) {
      const agg = aggregateTrialResults(
        trialResults.map((r) => ({
          score: r.score.score,
          selectedExpert: r.score.selectedExpert,
          expectedExpert: testCase.expectedPrimaryExpert
        }))
      );
      run.aggregated.push({
        caseId: testCase.id,
        target,
        ...agg
      });
    }

    resultsByTarget[target] = trialResults[0];
  }

  const parity = compareTargets(resultsByTarget);
  if (parity) {
    run.parity.push({
      caseId: testCase.id,
      ...parity
    });
  }
}

const jsonPath = path.join(logDir, `regression-summary-${timestamp}.json`);
const mdPath = path.join(logDir, `regression-summary-${timestamp}.md`);

await writeFile(jsonPath, JSON.stringify(run, null, 2) + "\n", "utf8");
await writeFile(mdPath, formatSummary(run), "utf8");

console.log(`JSON summary: ${path.relative(workspaceRoot, jsonPath)}`);
console.log(`Markdown summary: ${path.relative(workspaceRoot, mdPath)}`);

async function runTarget({ target, wrappedPrompt, rawLogPath }) {
  if (target === "cursor") {
    const cursorArgs = [
      "--print",
      "--output-format",
      "json",
      "--mode",
      "ask",
      "--trust",
      "--workspace",
      workspaceRoot
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
      "exec",
      "--skip-git-repo-check",
      "-C",
      workspaceRoot,
      "--sandbox",
      "read-only",
      "--json",
      "--output-schema",
      path.join(workspaceRoot, "regression", "output-schema.json")
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
