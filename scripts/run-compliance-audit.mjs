#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { runAudit, writeReport } from "./lib/compliance-audit.mjs";

const args = process.argv.slice(2);
let inputDir = null;
let outputDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && args[i + 1]) {
    inputDir = args[i + 1];
    i++;
  } else if (args[i] === "--output" && args[i + 1]) {
    outputDir = args[i + 1];
    i++;
  } else if (args[i] === "--help" || args[i] === "-h") {
    printHelp();
    process.exit(0);
  }
}

if (!inputDir) {
  console.error("Error: --input <directory> is required");
  printHelp();
  process.exit(1);
}

const inputPath = path.resolve(inputDir);
if (!fs.existsSync(inputPath)) {
  console.error(`Error: Input directory does not exist: ${inputPath}`);
  process.exit(1);
}

const timestamp = Date.now();
const defaultOutputDir = path.join(".logs", `compliance-${timestamp}`);
const finalOutputDir = outputDir ? path.resolve(outputDir) : defaultOutputDir;

const transcripts = loadTranscripts(inputPath);
if (transcripts.length === 0) {
  console.error("Error: No transcript files found in input directory");
  process.exit(1);
}

console.error(`[compliance-audit] Loaded ${transcripts.length} transcript(s)`);
console.error(`[compliance-audit] Input: ${inputPath}`);
console.error(`[compliance-audit] Output: ${finalOutputDir}`);

const report = runAudit(transcripts);
const { reportPath, summaryPath } = writeReport(report, finalOutputDir);

console.log(JSON.stringify(report, null, 2));

console.error(`[compliance-audit] Report: ${reportPath}`);
console.error(`[compliance-audit] Summary: ${summaryPath}`);

function loadTranscripts(dir) {
  const transcripts = [];

  if (!fs.existsSync(dir)) {
    return transcripts;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".log"))) {
      const filePath = path.join(dir, entry.name);
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const transcript = parseTranscript(content, entry.name);
        if (transcript) {
          transcripts.push(transcript);
        }
      } catch (err) {
        console.error(`[compliance-audit] Warning: Failed to read ${entry.name}: ${err.message}`);
      }
    } else if (entry.isDirectory()) {
      transcripts.push(...loadTranscripts(path.join(dir, entry.name)));
    }
  }

  return transcripts;
}

function parseTranscript(content, filename) {
  try {
    const parsed = JSON.parse(content);
    if (parsed.result || parsed.messages) {
      return {
        id: parsed.id || filename.replace(/\.(json|log)$/, ""),
        result: parsed.result || extractResultFromMessages(parsed.messages),
        tool_calls: parsed.tool_calls || [],
        expectedExpertIds: parsed.expectedExpertIds || [],
      };
    }
  } catch {
  }

  if (content.includes(" Selected Expert:") || content.includes("[rules:loaded")) {
    return {
      id: filename.replace(/\.(json|log)$/, ""),
      result: content,
      tool_calls: extractToolCallsFromText(content),
      expectedExpertIds: [],
    };
  }

  return null;
}

function extractResultFromMessages(messages) {
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length > 0) {
    const last = assistantMessages[assistantMessages.length - 1];
    return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
  }
  return "";
}

function extractToolCallsFromText(content) {
  const calls = [];
  const runCmdPattern = /run_command["\s]+command["\s]*:["\s]*["']([^"']+)["']/g;
  let match;
  while ((match = runCmdPattern.exec(content)) !== null) {
    calls.push({ type: "run_command", command: match[1] });
  }
  return calls;
}

function printHelp() {
  console.error(`Usage: node run-compliance-audit.mjs --input <directory> [--output <directory>]

Audit transcript logs for compliance signals.

Options:
  --input, -i <directory>   Directory containing transcript logs (required)
  --output, -o <directory>   Output directory for report (default: .logs/compliance-<timestamp>/)
  --help, -h                 Show this help message

Inputs:
  Transcript files can be .json or .log files containing:
  - { result: string, tool_calls: array } (CLR format)
  - { messages: array } (OpenAI format)
  - Plain text with tool call references

Outputs:
  compliance-report.json    Full JSON report with per-transcript results
  compliance-summary.md     Human-readable summary
`);
}
