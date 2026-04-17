#!/usr/bin/env node
/**
 * run-via-clr: executes AgentHistoric regression cases through cli-runner-learner.
 *
 * Mirrors the CLI surface of `scripts/run-regressions.mjs` but routes each case
 * through clr's orchestrator to gain:
 *   - Retry/healing on tool crashes and timeouts
 *   - Checkpointing and resumability
 *   - Fibonacci batch backoff on failure clusters
 *   - Structured JSON extraction via the sentinel adapter
 *
 * Usage:
 *   node scripts/run-via-clr.mjs [--suite NAME] [--targets cursor,claude]
 *                                [--case ID,ID,...] [--cursor-model MODEL]
 *                                [--claude-model MODEL] [--state-dir DIR]
 *                                [--timeout-sec N]
 *
 * Notes:
 *   - `--targets` supports `cursor` and `claude` (no codex here).
 *   - One clr run per (target) with all cases batched; concurrency is fixed at 1
 *     to keep transcript-order correlation stable.
 */

import path from "node:path";
import { writeFile } from "node:fs/promises";
import { loadPromptSystemSpec } from "./lib/prompt-system.mjs";
import {
  buildWrappedPrompt,
  createTimestamp,
  ensureLogsDirectory,
  loadRegressionFixtures,
  scoreCase,
  selectCases
} from "./lib/regression.mjs";
import {
  decorateWrappedPromptForClr,
  runCasesViaClr
} from "./lib/clr-runner.mjs";

function parseClrArgs(argv) {
  const options = {
    suite: "full",
    targets: ["cursor", "claude"],
    modelByTarget: { cursor: "gpt-5.4-medium", claude: null },
    caseIds: [],
    stateDirRoot: null,
    timeoutSec: 180
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--suite") { options.suite = next; i += 1; }
    else if (arg === "--targets") {
      options.targets = next.split(",").map((s) => s.trim()).filter(Boolean);
      i += 1;
    }
    else if (arg === "--cursor-model") { options.modelByTarget.cursor = next; i += 1; }
    else if (arg === "--claude-model") { options.modelByTarget.claude = next; i += 1; }
    else if (arg === "--case") {
      options.caseIds = next.split(",").map((s) => s.trim()).filter(Boolean);
      i += 1;
    }
    else if (arg === "--state-dir") { options.stateDirRoot = next; i += 1; }
    else if (arg === "--timeout-sec") { options.timeoutSec = parseInt(next, 10) || 180; i += 1; }
  }

  options.targets = options.targets.filter((t) => t === "cursor" || t === "claude");
  if (options.targets.length === 0) {
    throw new Error("No valid targets (supported: cursor, claude)");
  }
  return options;
}

const workspaceRoot = process.cwd();
const options = parseClrArgs(process.argv.slice(2));
const timestamp = createTimestamp();
const system = await loadPromptSystemSpec(workspaceRoot);
const fixtures = await loadRegressionFixtures(workspaceRoot);
const allCases = selectCases(fixtures, {
  suite: options.suite,
  targets: ["cursor"], // clr supports cases that target cursor/codex; we run cursor/claude both as AH cases
  caseIds: options.caseIds
});
const logDir = await ensureLogsDirectory(workspaceRoot);
const stateDirRoot = options.stateDirRoot
  ? path.resolve(options.stateDirRoot)
  : path.join(logDir, `clr-state-${timestamp}`);

const run = {
  runner: "clr",
  suite: options.suite,
  targets: options.targets,
  timestamp,
  caseCount: allCases.length,
  stateDirRoot,
  results: [],
  perTarget: {}
};

for (const target of options.targets) {
  const model = options.modelByTarget[target];
  const stateDir = path.join(stateDirRoot, target);
  console.log(`[run-via-clr] target=${target} model=${model ?? "(default)"} cases=${allCases.length}`);

  const clrResult = await runCasesViaClr({
    cases: allCases,
    target,
    buildPrompt: (c) => decorateWrappedPromptForClr(buildWrappedPrompt(c)),
    stateDir,
    model,
    timeoutSec: options.timeoutSec,
    concurrency: 1,
    log: (m) => console.log(m)
  });

  run.perTarget[target] = {
    runId: clrResult.runId,
    clrExitCode: clrResult.clrExitCode,
    stateDir
  };

  for (const r of clrResult.results) {
    const caseObj = allCases.find((c) => c.id === r.caseId);
    let score = null;
    if (r.response) {
      score = scoreCase(system, caseObj, r.response);
    }
    run.results.push({
      caseId: r.caseId,
      caseName: caseObj.name,
      target,
      clrStatus: r.status,
      attempts: r.attempts,
      transcriptPath: r.transcriptPath,
      extractError: r.error,
      selectedExpert: score?.selectedExpert ?? null,
      expectedExpert: caseObj.expectedPrimaryExpert,
      matched: score ? score.selectedExpert === caseObj.expectedPrimaryExpert : false,
      score
    });
  }
}

const jsonPath = path.join(logDir, `clr-summary-${timestamp}.json`);
await writeFile(jsonPath, JSON.stringify(run, null, 2) + "\n", "utf8");

const mdLines = [
  `# clr regression summary -- ${timestamp}`,
  "",
  `Suite: **${options.suite}** | targets: ${options.targets.join(", ")} | cases: ${allCases.length}`,
  `State dir: \`${stateDirRoot}\``,
  ""
];

for (const target of options.targets) {
  const rows = run.results.filter((r) => r.target === target);
  const matches = rows.filter((r) => r.matched).length;
  const extracted = rows.filter((r) => r.score).length;
  mdLines.push(`## ${target}`);
  mdLines.push("");
  mdLines.push(`Matched: **${matches}/${rows.length}** (extracted: ${extracted}/${rows.length})`);
  mdLines.push("");
  mdLines.push("| Case | clr | Attempts | Expected | Got | Match |");
  mdLines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    mdLines.push(`| ${r.caseId} | ${r.clrStatus} | ${r.attempts} | ${r.expectedExpert ?? "-"} | ${r.selectedExpert ?? (r.extractError ?? "-")} | ${r.matched ? "OK" : "MISS"} |`);
  }
  mdLines.push("");
}

const mdPath = path.join(logDir, `clr-summary-${timestamp}.md`);
await writeFile(mdPath, mdLines.join("\n"), "utf8");

console.log(`JSON summary: ${path.relative(workspaceRoot, jsonPath)}`);
console.log(`Markdown summary: ${path.relative(workspaceRoot, mdPath)}`);
