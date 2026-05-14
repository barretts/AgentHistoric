#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BUILTIN_RUBRICS,
  judgeResponse,
  loadJudgeConfig
} from "./lib/eval-judge.mjs";
import { cohensKappa } from "./lib/stats.mjs";

const workspaceRoot = process.cwd();
const config = await loadJudgeConfig(workspaceRoot);
const calibrationDir = path.join(workspaceRoot, "regression", "judge-calibration");
const goldDir = path.join(calibrationDir, "gold");
const args = parseArgs(process.argv.slice(2));
const files = await listGoldFiles(goldDir);
const rubrics = [];

for (const file of files) {
  const rubricId = path.basename(file, ".jsonl");
  if (args.rubrics.length > 0 && !args.rubrics.includes(rubricId)) continue;
  const rubric = BUILTIN_RUBRICS.find((candidate) => candidate.id === rubricId);
  if (!rubric) {
    rubrics.push({
      rubricId,
      error: "No built-in rubric with this id",
      n: 0,
      kappa: null
    });
    continue;
  }

  const rows = parseJsonl(await readFile(path.join(goldDir, file), "utf8"));
  const humanLabels = [];
  const judgeLabels = [];
  const examples = [];
  for (const row of rows) {
    if (typeof row.humanLabel !== "number" || typeof row.response !== "string") continue;
    const result = await judgeResponse({
      response: row.response,
      rubric,
      context: row.context || row.caseId,
      local: args.local,
      judgeModelFamily: config.judgeModelFamily,
      subjectModelFamily: args.subjectModelFamily,
      allowSameFamily: args.allowSameFamily
    });
    humanLabels.push(row.humanLabel);
    judgeLabels.push(result.score);
    examples.push({
      caseId: row.caseId,
      humanLabel: row.humanLabel,
      judgeLabel: result.score,
      critique: row.critique,
      judgeReasoning: result.reasoning
    });
  }

  const agreement = cohensKappa(humanLabels, judgeLabels);
  rubrics.push({
    rubricId,
    n: agreement.n,
    kappa: agreement.kappa,
    observedAgreement: agreement.observedAgreement,
    expectedAgreement: agreement.expectedAgreement,
    kappaFloor: config.kappaFloor ?? 0.4,
    pass: typeof agreement.kappa === "number" && agreement.kappa >= (config.kappaFloor ?? 0.4),
    examples
  });
}

const report = {
  timestamp: new Date().toISOString(),
  mode: args.local ? "heuristic" : "llm",
  rubrics
};

await mkdir(calibrationDir, { recursive: true });
await writeFile(
  path.join(calibrationDir, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8"
);
await writeFile(
  path.join(calibrationDir, "report.md"),
  formatReport(report),
  "utf8"
);

console.log(`Wrote ${path.relative(workspaceRoot, path.join(calibrationDir, "report.json"))}`);

function parseArgs(argv) {
  const options = {
    local: true,
    rubrics: [],
    subjectModelFamily: null,
    allowSameFamily: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--real-judge") {
      options.local = false;
    } else if (arg === "--rubrics") {
      options.rubrics = argv[i + 1].split(",").map((value) => value.trim()).filter(Boolean);
      i += 1;
    } else if (arg === "--subject-model-family") {
      options.subjectModelFamily = argv[i + 1] || null;
      i += 1;
    } else if (arg === "--allow-same-family") {
      options.allowSameFamily = true;
    }
  }
  return options;
}

async function listGoldFiles(dir) {
  try {
    const entries = await readdir(dir);
    return entries.filter((entry) => entry.endsWith(".jsonl")).sort();
  } catch {
    return [];
  }
}

function parseJsonl(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function formatReport(report) {
  const lines = [
    "# Judge Calibration Report",
    "",
    `- Timestamp: ${report.timestamp}`,
    `- Mode: ${report.mode}`,
    "",
    "| Rubric | n | Kappa | Observed | Pass |",
    "|--------|---:|------:|---------:|:----:|"
  ];
  for (const row of report.rubrics) {
    lines.push(
      `| ${row.rubricId} | ${row.n || 0} | ${formatNumber(row.kappa)} | ${formatNumber(row.observedAgreement)} | ${row.pass ? "Y" : "N"} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(3) : "N/A";
}
