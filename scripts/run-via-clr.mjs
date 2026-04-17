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
    // Defaults: cursor (via agent-print) + crush (via crush-print). claude is
    // available as a target but its --print mode hangs on Linux; opt in with
    // --targets claude if running on a machine where it works.
    targets: ["cursor", "crush"],
    modelByTarget: { cursor: "gpt-5.4-medium", claude: null, crush: null },
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
    else if (arg === "--crush-model") { options.modelByTarget.crush = next; i += 1; }
    else if (arg === "--case") {
      options.caseIds = next.split(",").map((s) => s.trim()).filter(Boolean);
      i += 1;
    }
    else if (arg === "--state-dir") { options.stateDirRoot = next; i += 1; }
    else if (arg === "--timeout-sec") { options.timeoutSec = parseInt(next, 10) || 180; i += 1; }
  }

  const SUPPORTED = new Set(["cursor", "claude", "crush"]);
  options.targets = options.targets.filter((t) => SUPPORTED.has(t));
  if (options.targets.length === 0) {
    throw new Error("No valid targets (supported: cursor, claude, crush)");
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

// Run header
console.log("=".repeat(70));
console.log(`[run-via-clr] starting run ${timestamp}`);
console.log(`[run-via-clr] suite=${options.suite} targets=${options.targets.join(",")} cases=${allCases.length} timeoutSec=${options.timeoutSec}`);
console.log(`[run-via-clr] stateDirRoot=${stateDirRoot}`);
console.log(`[run-via-clr] cases: ${allCases.map((c) => c.id).join(", ")}`);
console.log("=".repeat(70));

const overallStart = Date.now();

for (let ti = 0; ti < options.targets.length; ti += 1) {
  const target = options.targets[ti];
  const model = options.modelByTarget[target];
  const stateDir = path.join(stateDirRoot, target);
  console.log("");
  console.log("-".repeat(70));
  console.log(`[run-via-clr] [${ti + 1}/${options.targets.length}] target=${target} model=${model ?? "(default)"} cases=${allCases.length}`);
  console.log("-".repeat(70));
  const targetStart = Date.now();

  const clrResult = await runCasesViaClr({
    cases: allCases,
    target,
    buildPrompt: (c) => decorateWrappedPromptForClr(buildWrappedPrompt(c)),
    stateDir,
    model,
    timeoutSec: options.timeoutSec,
    concurrency: 1,
    verbose: true,
    log: (m) => console.log(m)
  });

  run.perTarget[target] = {
    runId: clrResult.runId,
    clrExitCode: clrResult.clrExitCode,
    stateDir
  };

  let matches = 0;
  let extracted = 0;
  for (const r of clrResult.results) {
    const caseObj = allCases.find((c) => c.id === r.caseId);
    let score = null;
    if (r.response) {
      score = scoreCase(system, caseObj, r.response);
      extracted += 1;
    }
    const matched = score ? score.selectedExpert === caseObj.expectedPrimaryExpert : false;
    if (matched) matches += 1;

    // Per-case verdict line
    const verdict = matched ? "OK  " : (score ? "MISS" : "NOEX");
    console.log(
      `[run-via-clr] ${verdict} ${r.caseId.padEnd(8)} ${target.padEnd(6)} expected=${caseObj.expectedPrimaryExpert} got=${score?.selectedExpert ?? (r.error ?? "-")}`
    );

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
      matched,
      score
    });
  }

  const targetElapsed = ((Date.now() - targetStart) / 1000).toFixed(1);
  console.log(`[run-via-clr] target=${target} done in ${targetElapsed}s -- matched ${matches}/${allCases.length}, extracted ${extracted}/${allCases.length}`);
}

const overallElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
console.log("");
console.log("=".repeat(70));
console.log(`[run-via-clr] all targets complete in ${overallElapsed}s`);
console.log("=".repeat(70));

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
