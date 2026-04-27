#!/usr/bin/env node

/**
 * Analyze trace files from .logs/traces/ for failure patterns and trends.
 *
 * Usage:
 *   node scripts/analyze-traces.mjs                    # analyze most recent trace file
 *   node scripts/analyze-traces.mjs .logs/traces/traces-2026-04-24.ndjson
 *   node scripts/analyze-traces.mjs --run-id 2026-04-24
 *   node scripts/analyze-traces.mjs --all              # analyze all trace files
 */

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import {
  readTraces,
  analyzeTraceFailures,
  formatTraceAnalysis
} from "./lib/tracer.mjs";

const workspaceRoot = process.cwd();
const tracesDir = path.join(workspaceRoot, ".logs", "traces");

async function findTraceFile(runId) {
  let files;
  try {
    files = (await readdir(tracesDir)).filter((f) => f.endsWith(".ndjson")).sort();
  } catch {
    console.error(`No traces directory found at: ${tracesDir}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("No trace files found. Run with --trace to enable tracing.");
    process.exit(1);
  }

  if (runId) {
    const match = files.find((f) => f.includes(runId));
    if (match) return path.join(tracesDir, match);
    console.error(`No trace file matching runId "${runId}". Available: ${files.join(", ")}`);
    process.exit(1);
  }

  return path.join(tracesDir, files[files.length - 1]);
}

async function findAllTraceFiles() {
  let files;
  try {
    files = (await readdir(tracesDir)).filter((f) => f.endsWith(".ndjson")).sort();
  } catch {
    console.error(`No traces directory found at: ${tracesDir}`);
    process.exit(1);
  }
  return files.map((f) => path.join(tracesDir, f));
}

// ── CLI parsing ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const runId = args.includes("--run-id")
  ? args[args.indexOf("--run-id") + 1]
  : null;
const analyzeAll = args.includes("--all");
const positionalFile = args.find((a) => !a.startsWith("--"));

async function main() {
  let traceFiles = [];

  if (positionalFile) {
    traceFiles = [positionalFile];
  } else if (analyzeAll) {
    traceFiles = await findAllTraceFiles();
  } else {
    traceFiles = [await findTraceFile(runId)];
  }

  const allTraces = [];
  for (const f of traceFiles) {
    try {
      const traces = await readTraces(f);
      console.log(`Loaded ${traces.length} traces from ${path.basename(f)}`);
      allTraces.push(...traces);
    } catch (err) {
      console.error(`Error reading ${f}: ${err.message}`);
    }
  }

  if (allTraces.length === 0) {
    console.log("No trace records found.");
    return;
  }

  const analysis = analyzeTraceFailures(allTraces);
  const report = formatTraceAnalysis(analysis);
  console.log("");
  console.log(report);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});