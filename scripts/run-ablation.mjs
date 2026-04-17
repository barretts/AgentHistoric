#!/usr/bin/env node

import path from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";
import { loadPromptSystemSpec, writeTextFile } from "./lib/prompt-system.mjs";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import {
  aggregateTrialResults,
  buildLocalResponse,
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
import { decorateWrappedPromptForClr, runCasesViaClr } from "./lib/clr-runner.mjs";

const workspaceRoot = process.cwd();
const system = await loadPromptSystemSpec(workspaceRoot);
const options = parseArgs(process.argv.slice(2));
const trials = Math.max(options.trials, 3);
const timestamp = createTimestamp();
const fixtures = await loadRegressionFixtures(workspaceRoot);
// For case selection, treat crush/claude as "cursor-equivalent" targets since
// the fixtures only advertise cursor/codex. clr wrappers route any case
// through the selected CLI regardless of its advertised targets, mirroring
// run-via-clr's behavior.
const selectionTargets = options.viaClr
  ? options.targets.map((t) => (t === "crush" || t === "claude" ? "cursor" : t))
  : options.targets;
const cases = selectCases(fixtures, { ...options, targets: selectionTargets });
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
  local: options.local,
  viaClr: Boolean(options.viaClr),
  sections: []
};

if (options.local) {
  console.log(
    `[run-ablation] --local mode: routing via local synthetic heuristic (seed=${options.seed}).`
  );
  console.log(
    `[run-ablation] Ablation deltas will be near-zero; use this mode for scaffolding verification, not findings.`
  );
}

if (options.viaClr) {
  console.log(
    `[run-ablation] --via-clr mode: routing through cli-runner-learner orchestrator.`
  );
  console.log(
    `[run-ablation] Rendered artifacts will be installed to ${path.join(workspaceRoot, ".cursor/rules")} between conditions. Control state is restored on exit.`
  );
}

// Apply --sections filter if provided.
const sectionsToRun = options.sectionFilter && options.sectionFilter.length > 0
  ? manifest.sections.filter((s) => options.sectionFilter.includes(s.id))
  : manifest.sections;

if (options.sectionFilter && options.sectionFilter.length > 0) {
  console.log(
    `[run-ablation] Running ${sectionsToRun.length}/${manifest.sections.length} sections: ${sectionsToRun.map((s) => s.id).join(", ")}`
  );
  const missing = options.sectionFilter.filter(
    (id) => !manifest.sections.find((s) => s.id === id)
  );
  if (missing.length > 0) {
    console.warn(
      `[run-ablation] Warning: --sections filter contained unknown ids (skipped): ${missing.join(", ")}`
    );
  }
}

/**
 * Install a set of rendered artifacts to disk. Only writes cursor-facing
 * artifacts (`compiled/cursor/rules/*.mdc`) and mirrors them to
 * `.cursor/rules/*.mdc` so cursor-agent actually reads them at runtime.
 *
 * We clear `.cursor/rules/` first so stale files from the previous condition
 * (e.g. an expert that was present in control but ablated in this condition)
 * don't linger.
 */
async function installArtifactsToDisk(artifactsMap) {
  const cursorRulesDir = path.join(workspaceRoot, ".cursor", "rules");
  await rm(cursorRulesDir, { recursive: true, force: true });
  for (const [relPath, content] of artifactsMap) {
    // Write the original compiled/ artifact.
    await writeTextFile(path.join(workspaceRoot, relPath), content);
    // Mirror cursor rules into .cursor/rules/ for real-LLM pickup.
    const cursorPrefix = path.join("compiled", "cursor", "rules");
    if (relPath.startsWith(cursorPrefix + path.sep) || relPath.startsWith(cursorPrefix + "/")) {
      const rel = relPath.slice(cursorPrefix.length + 1);
      await writeTextFile(path.join(cursorRulesDir, rel), content);
    }
  }
}

async function restoreControlArtifacts() {
  console.log(`[run-ablation] restoring control artifacts...`);
  await installArtifactsToDisk(generateArtifacts(system, {}));
}

// Always restore control on process exit so a crashed/interrupted run doesn't
// leave the workspace with stale ablated artifacts. SIGINT/SIGTERM/uncaught.
let installedAblated = false;
const restoreHandler = async () => {
  if (installedAblated) {
    try { await restoreControlArtifacts(); } catch {}
  }
};
process.on("SIGINT", async () => { await restoreHandler(); process.exit(130); });
process.on("SIGTERM", async () => { await restoreHandler(); process.exit(143); });

for (const section of sectionsToRun) {
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

  if (options.viaClr) {
    // --via-clr mode: per condition, install artifacts once, then route every
    // (case × trial) combination through a single clr orchestration per target.
    // This is much faster than per-trial clr invocations (one clr startup vs.
    // N) and keeps the rendered artifacts stable while the LLM runs.
    for (const target of options.targets) {
      // See note on selectionTargets: crush/claude clr targets treat any case
      // as runnable. For cursor/codex the advertised per-case targets gate
      // execution as before.
      const effectiveTarget = (target === "crush" || target === "claude") ? "cursor" : target;
      const targetCases = cases.filter((c) => c.targets.includes(effectiveTarget));
      if (targetCases.length === 0) continue;

      const runConditionViaClr = async (condition) => {
        const conditionLabel = `${section.id}-${condition}-${target}`;
        console.log(`[run-ablation] --via-clr [${conditionLabel}] ${targetCases.length} case(s) x ${trials} trial(s)`);

        // Expand (case × trial) into a flat list of uniquely-id'd clr tasks so
        // we can correlate per-trial results back to each original case.
        const expandedCases = [];
        for (const c of targetCases) {
          for (let t = 0; t < trials; t += 1) {
            expandedCases.push({ ...c, id: `${c.id}#t${t}`, _origId: c.id, _trialIndex: t });
          }
        }

        const stateDir = path.join(
          logDir,
          `ablation-clr-state-${timestamp}`,
          conditionLabel
        );
        const clrResult = await runCasesViaClr({
          cases: expandedCases,
          target,
          buildPrompt: (c) => decorateWrappedPromptForClr(buildWrappedPrompt(c)),
          stateDir,
          model: options.modelByTarget[target],
          timeoutSec: 300,
          concurrency: 1,
          verbose: true,
          log: (m) => console.log(m)
        });

        const trialRecords = [];
        for (const r of clrResult.results) {
          const orig = expandedCases.find((c) => c.id === r.caseId);
          if (!orig) continue;
          if (!r.response) {
            trialRecords.push({
              score: 0,
              selectedExpert: null,
              expectedExpert: orig.expectedPrimaryExpert,
              behavioralMetrics: { overEngineering: 1, concision: 1 }
            });
            continue;
          }
          const score = scoreCase(system, orig, r.response);
          trialRecords.push({
            score: score.score,
            selectedExpert: score.selectedExpert,
            expectedExpert: orig.expectedPrimaryExpert,
            behavioralMetrics: score.behavioralMetrics
          });
        }
        return trialRecords;
      };

      // Control condition.
      await installArtifactsToDisk(controlArtifacts);
      installedAblated = false;
      const controlBatch = await runConditionViaClr("control");
      controlResults.push(...controlBatch);

      // Ablated condition.
      await installArtifactsToDisk(ablatedArtifacts);
      installedAblated = true;
      const ablatedBatch = await runConditionViaClr("ablated");
      ablatedResults.push(...ablatedBatch);

      // Restore control after each target to keep disk state neutral for the
      // next target iteration.
      await installArtifactsToDisk(controlArtifacts);
      installedAblated = false;
    }
  } else {
    for (const testCase of cases) {
      for (const target of options.targets.filter((t) =>
        testCase.targets.includes(t)
      )) {
        const wrappedPrompt = buildWrappedPrompt(testCase);

        const runOneTrial = async (condition, trialIndex) => {
          const rawLogPath = path.join(
            logDir,
            `ablation-${timestamp}-${section.id}-${condition}-${testCase.id}-${target}-t${trialIndex}.log`
          );
          const response = options.local
            ? buildLocalResponse(system, testCase, {
                trialIndex,
                seed: options.seed + (condition === "ablated" ? 1 : 0)
              })
            : await runTarget({
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
        };

        const controlTrials = await runTrials(
          (trialIndex) => runOneTrial("control", trialIndex),
          { trials, parallel: options.parallel }
        );

        const ablatedTrials = await runTrials(
          (trialIndex) => runOneTrial("ablated", trialIndex),
          { trials, parallel: options.parallel }
        );

        controlResults.push(...controlTrials);
        ablatedResults.push(...ablatedTrials);
      }
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

// Final safety net: if we exited the section loop with ablated artifacts still
// on disk (shouldn't happen thanks to per-target restore, but just in case),
// restore the control artifacts before writing the report.
if (options.viaClr) {
  await restoreControlArtifacts();
  installedAblated = false;
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
