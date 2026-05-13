#!/usr/bin/env node

import path from "node:path";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { loadRegressionFixtures } from "./lib/regression.mjs";
import { readTraces } from "./lib/tracer.mjs";
import {
  detectDistributionShift,
  extractUserPromptsFromTraces,
  formatShiftReport,
  promptsFromFixtures
} from "./lib/distribution-shift.mjs";

const workspaceRoot = process.cwd();
const tracesDir = path.join(workspaceRoot, ".logs", "traces");

function parseArgs(argv) {
  const options = {
    all: false,
    runId: null,
    output: null,
    traceFiles: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--run-id") {
      options.runId = argv[index + 1];
      index += 1;
    } else if (arg === "--output" || arg === "-o") {
      options.output = argv[index + 1];
      index += 1;
    } else if (!arg.startsWith("--")) {
      options.traceFiles.push(arg);
    }
  }

  return options;
}

async function findTraceFiles(options) {
  if (options.traceFiles.length > 0) {
    return options.traceFiles.map((file) => path.resolve(workspaceRoot, file));
  }

  let files;
  try {
    files = (await readdir(tracesDir)).filter((file) => file.endsWith(".ndjson")).sort();
  } catch {
    throw new Error(`No traces directory found at: ${tracesDir}`);
  }

  if (files.length === 0) {
    throw new Error("No trace files found. Run regressions with --trace first.");
  }

  if (options.all) {
    return files.map((file) => path.join(tracesDir, file));
  }

  if (options.runId) {
    const matches = files.filter((file) => file.includes(options.runId));
    if (matches.length === 0) {
      throw new Error(`No trace file matching runId "${options.runId}". Available: ${files.join(", ")}`);
    }
    return matches.map((file) => path.join(tracesDir, file));
  }

  return [path.join(tracesDir, files[files.length - 1])];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const existingPrompts = promptsFromFixtures(fixtures);
  const traceFiles = await findTraceFiles(options);
  const traces = [];

  for (const traceFile of traceFiles) {
    traces.push(...await readTraces(traceFile));
  }

  const newPrompts = extractUserPromptsFromTraces(traces);

  if (newPrompts.length === 0) {
    throw new Error("No user prompts found in traces. Generate new traces with a version that stores prompt.userPrompt.");
  }

  const result = detectDistributionShift(existingPrompts, newPrompts);
  const report = formatShiftReport({
    ...result,
    traceFiles: traceFiles.map((file) => path.relative(workspaceRoot, file))
  });

  if (options.output) {
    const outputPath = path.resolve(workspaceRoot, options.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report, "utf8");
    console.log(`Distribution shift report: ${path.relative(workspaceRoot, outputPath)}`);
  } else {
    console.log(report);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
