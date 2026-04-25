import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TRACE_DIR = ".logs/traces";

export function createTraceDir(workspaceRoot, traceDir) {
  const dir = traceDir || path.join(workspaceRoot, DEFAULT_TRACE_DIR);
  return mkdir(dir, { recursive: true }).then(() => dir);
}

/**
 * Build a structured trace record for a single case evaluation.
 *
 * @param {object} params
 * @param {string} params.caseId - Regression case identifier.
 * @param {string} params.caseName - Human-readable case name.
 * @param {string} params.prompt - The wrapped prompt sent to the target.
 * @param {string} params.target - Target name (e.g., "cursor", "codex", "local").
 * @param {number} params.trialIndex - Which trial within the case.
 * @param {object} params.response - The parsed response envelope.
 * @param {object} params.scoreResult - The result of evaluateResponse().
 * @param {string} [params.logPath] - Path to the raw CLI log file.
 * @param {string} [params.model] - Model identifier if known.
 * @param {number} [params.timestampMs] - Epoch ms. Defaults to now.
 * @returns {object} A JSON-serializable trace record.
 */
export function buildTrace(params) {
  const {
    caseId,
    caseName,
    prompt,
    target,
    trialIndex,
    response,
    scoreResult,
    logPath,
    model,
    timestampMs = Date.now()
  } = params;

  return {
    version: 1,
    schema: "agent-historic/trace/v1",
    timestamp: new Date(timestampMs).toISOString(),
    caseId,
    caseName,
    target,
    trialIndex,
    model: model || null,
    logPath: logPath || null,
    routing: {
      domain: response.routingDecision?.domain || null,
      selectedExpert: scoreResult.selectedExpert || null,
      expectedExpert: scoreResult.selectedExpert !== undefined
        ? (scoreResult.routingMatch ? scoreResult.selectedExpert : null)
        : null,
      routingMatch: scoreResult.routingMatch ?? null,
      handoffs: response.handoffs || [],
      personaBlend: response.personaBlend ?? null,
      domainStayedInScope: response.stayedInScope ?? null
    },
    scoring: {
      score: scoreResult.score,
      missingSections: scoreResult.missingSections || [],
      notableDrift: scoreResult.notableDrift || [],
      behavioralFindings: scoreResult.behavioralFindings || [],
      behavioralMetrics: scoreResult.behavioralMetrics || null
    },
    judge: scoreResult.judgeResult || null,
    promptHash: hashForIndexing(prompt),
    response: {
      outputSections: response.outputSections || [],
      confidenceLabeled: response.confidenceLabeled ?? null,
      responseSnippet: truncate(response.response || "", 2000)
    }
  };
}

/**
 * Write a single trace record to the trace directory.
 *
 * Traces are stored as newline-delimited JSON (NDJSON) per run. Each call to
 * buildAndAppendTrace appends one JSON object per line to the run file.
 *
 * @param {object} params - Same as buildTrace().
 * @param {string} params.workspaceRoot
 * @param {string} [params.traceDir] - Override default trace directory.
 * @param {string} [params.runId] - Override run id (defaults to date-based).
 * @returns {Promise<string>} Path to the trace file.
 */
export async function buildAndAppendTrace(params) {
  const { workspaceRoot, traceDir } = params;
  const runId = params.runId || new Date().toISOString().slice(0, 10);
  const dir = await createTraceDir(workspaceRoot, traceDir?.replace(/\/traces$/, ""));
  const traceFile = path.join(dir, `traces-${runId}.ndjson`);
  const record = buildTrace(params);
  const line = JSON.stringify(record) + "\n";
  await appendFile(traceFile, line);
  return traceFile;
}

function appendFile(filePath, data) {
  return readFile(filePath, "utf8")
    .then((existing) => writeFile(filePath, existing + data, "utf8"))
    .catch(() => writeFile(filePath, data, "utf8"));
}

/**
 * Read all trace records from a given trace file.
 *
 * @param {string} traceFilePath
 * @returns {Promise<object[]>} Array of parsed trace records.
 */
export async function readTraces(traceFilePath) {
  const content = await readFile(traceFilePath, "utf8");
  return content
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line));
}

/**
 * Analyze traces for failure patterns.
 *
 * @param {object[]} traces - Parsed trace records.
 * @returns {object} Summary with failure groupings.
 */
export function analyzeTraceFailures(traces) {
  const byFailure = {};
  const byCase = {};
  const byExpert = {};

  for (const t of traces) {
    const caseId = t.caseId;
    const expert = t.routing?.selectedExpert;

    byCase[caseId] = byCase[caseId] || { total: 0, passes: 0, fails: 0 };
    byCase[caseId].total++;
    if (t.scoring?.score === 2) {
      byCase[caseId].passes++;
    } else {
      byCase[caseId].fails++;
    }

    byExpert[expert] = byExpert[expert] || { total: 0, passes: 0 };
    byExpert[expert].total++;
    if (t.scoring?.score === 2) {
      byExpert[expert].passes++;
    }

    for (const finding of [...(t.scoring?.notableDrift || []), ...(t.scoring?.behavioralFindings || [])]) {
      const key = normalizeFinding(finding);
      byFailure[key] = byFailure[key] || { count: 0, cases: new Set(), experts: new Set() };
      byFailure[key].count++;
      byFailure[key].cases.add(caseId);
      byFailure[key].experts.add(expert);
    }
  }

  // Convert sets to sorted arrays for JSON serialization
  const failureSummary = Object.entries(byFailure)
    .map(([finding, data]) => ({
      finding,
      count: data.count,
      caseCount: data.cases.size,
      cases: [...data.cases].sort(),
      experts: [...data.experts].sort()
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalTraces: traces.length,
    failurePatterns: failureSummary,
    caseResults: Object.fromEntries(
      Object.entries(byCase).map(([id, data]) => [id, data])
    ),
    expertResults: Object.fromEntries(
      Object.entries(byExpert).map(([id, data]) => [id, data])
    )
  };
}

/**
 * Format the failure analysis as markdown for reporting.
 *
 * @param {object} analysis - Result of analyzeTraceFailures().
 * @returns {string} Markdown summary.
 */
export function formatTraceAnalysis(analysis) {
  const lines = [];
  lines.push("# Trace Failure Analysis");
  lines.push("");
  lines.push(`- Total traces analyzed: ${analysis.totalTraces}`);
  lines.push("");

  if (analysis.failurePatterns.length === 0) {
    lines.push("No failure patterns detected.");
    return lines.join("\n");
  }

  lines.push("## Top Failure Patterns");
  lines.push("");
  lines.push("| Pattern | Count | Cases | Experts Affected |");
  lines.push("|---------|-------|-------|-----------------|");

  for (const p of analysis.failurePatterns.slice(0, 20)) {
    const casesStr = p.cases.slice(0, 5).join(", ") + (p.caseCount > 5 ? ` (+${p.caseCount - 5})` : "");
    const expertsStr = p.experts.join(", ");
    lines.push(`| ${p.finding} | ${p.count} | ${casesStr} | ${expertsStr} |`);
  }

  lines.push("");
  lines.push("## Case-Level Results");
  lines.push("");
  lines.push("| Case | Total | Pass | Fail | Pass Rate |");
  lines.push("|------|-------|------|------|-----------|");

  for (const [caseId, data] of Object.entries(analysis.caseResults).sort()) {
    const rate = ((data.passes / data.total) * 100).toFixed(0);
    lines.push(`| ${caseId} | ${data.total} | ${data.passes} | ${data.fails} | ${rate}% |`);
  }

  return lines.join("\n") + "\n";
}

function normalizeFinding(finding) {
  return String(finding)
    .replace(/case [A-Z0-9-]+/gi, "case XXX")
    .replace(/expert-[\w-]+/g, "expert-XXX")
    .trim();
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n...[truncated]";
}

function hashForIndexing(str) {
  // Simple DJB2 hash for dedup detection (not cryptographic).
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash.toString(36);
}

export function hashString(str) {
  return hashForIndexing(str);
}