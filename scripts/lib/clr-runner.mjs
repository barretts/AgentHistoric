/**
 * clr-runner: drives AgentHistoric regression cases through cli-runner-learner.
 *
 * Design:
 *   - One clr `orchestrate` invocation per run; one task per case.
 *   - We use clr's "args" interaction_mode profiles (agent-print, claude-print)
 *     which auto-select the sentinel adapter.
 *   - The wrapped prompt asks the LLM to return a JSON object with AgentHistoric's
 *     routing contract keys PLUS clr's sentinel-required `status`/`summary` keys,
 *     inside the sentinel markers.
 *   - clr's state.json keeps only the truncated `summary`, so we read each task's
 *     raw transcript JSONL and extract the full JSON payload from the sentinel block.
 *
 * Assumptions:
 *   - clr is built (dist/cli.js exists).
 *   - concurrency=1 so that transcript-chronological-order matches task topological
 *     order; higher concurrency would require a richer correlation strategy.
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const CLR_ROOT = "/Users/ephem/lcode/cli-runner-learner";
const CLR_CLI = path.join(CLR_ROOT, "dist/cli.js");
const CLR_TRANSCRIPT_DIR = path.join(CLR_ROOT, "transcripts");

const TOOL_ID_BY_TARGET = {
  cursor: "agent-print",
  claude: "claude-print"
};

const SENTINEL_START = "<<<TASK_RESULT>>>";
const SENTINEL_END = "<<<END_TASK_RESULT>>>";

export function getToolIdForTarget(target) {
  const id = TOOL_ID_BY_TARGET[target];
  if (!id) throw new Error(`Unsupported clr target: ${target}`);
  return id;
}

/**
 * Append sentinel-aware instructions to an AgentHistoric wrapped prompt so that
 * the LLM emits a single JSON object containing both the routing contract keys
 * and clr's status/summary keys, inside the sentinel markers.
 */
export function decorateWrappedPromptForClr(wrappedPrompt) {
  return [
    wrappedPrompt,
    "",
    "OUTPUT PROTOCOL (clr):",
    `Emit exactly one JSON object between the markers ${SENTINEL_START} and ${SENTINEL_END}.`,
    "The JSON object MUST contain, at minimum: status (\"DONE\" unless you cannot comply),",
    "summary (one short sentence), and all AgentHistoric keys listed above",
    "(routingDecision, activeExpert, handoffs, outputSections, confidenceLabeled,",
    "personaBlend, domainStayedInScope, response).",
    "Example skeleton:",
    SENTINEL_START,
    '{ "status": "DONE", "summary": "...", "routingDecision": { "selectedExpert": "expert-engineer-peirce", "domain": "..." }, "activeExpert": "expert-engineer-peirce", "handoffs": [], "outputSections": ["Selected Expert", "Reason", "Confidence", "Answer"], "confidenceLabeled": true, "personaBlend": false, "domainStayedInScope": true, "response": "..." }',
    SENTINEL_END,
    "Do not include any text outside the markers."
  ].join("\n");
}

/**
 * Build a clr manifest for the given cases and target.
 */
export function buildManifest({ cases, toolId, buildPrompt, timeoutSec = 180, concurrency = 1 }) {
  return {
    version: "1.0",
    policy: {
      concurrency,
      heal_schedule: "auto",
      batch_strategy: "fibonacci"
    },
    tasks: cases.map((c) => ({
      id: c.id,
      tool_id: toolId,
      input: buildPrompt(c),
      timeout_sec: timeoutSec,
      depends_on: []
    }))
  };
}

/**
 * Extract the last sentinel JSON block from a clr transcript file.
 * Transcripts are JSONL with "recv" events containing hex-encoded bytes.
 */
export async function extractSentinelJsonFromTranscript(transcriptPath) {
  const raw = await readFile(transcriptPath, "utf8");
  let decoded = "";
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "recv" && typeof event.data === "string") {
      decoded += Buffer.from(event.data, "hex").toString("utf-8");
    }
  }
  // Strip terminal escape sequences (CSI / OSC) so JSON markers are stable.
  const cleaned = decoded
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\r/g, "");

  // Find last sentinel block.
  let block = null;
  let searchFrom = 0;
  while (true) {
    const startIdx = cleaned.indexOf(SENTINEL_START, searchFrom);
    if (startIdx === -1) break;
    const contentStart = startIdx + SENTINEL_START.length;
    const endIdx = cleaned.indexOf(SENTINEL_END, contentStart);
    if (endIdx === -1) break;
    block = cleaned.slice(contentStart, endIdx).trim();
    searchFrom = endIdx + SENTINEL_END.length;
  }

  if (!block) {
    return { ok: false, error: "no sentinel block", raw: cleaned };
  }
  try {
    return { ok: true, json: JSON.parse(block), raw: cleaned };
  } catch (e) {
    return { ok: false, error: `JSON parse failed: ${e.message}`, raw: cleaned, block };
  }
}

function runSpawn(command, args, { env, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: env ?? process.env,
      cwd: cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout: out, stderr: err }));
  });
}

/**
 * Correlate tasks to transcripts.
 * Because concurrency=1 serializes tasks in topo order, we pick the N newest
 * transcripts for the target toolId (created after `sinceMs`) and assign them
 * in chronological order to the tasks in manifest order.
 */
async function correlateTranscripts({ toolId, taskIds, sinceMs }) {
  if (!existsSync(CLR_TRANSCRIPT_DIR)) return {};
  const files = await readdir(CLR_TRANSCRIPT_DIR);
  const candidates = [];
  for (const f of files) {
    if (!f.startsWith(`${toolId}-drive-`) || !f.endsWith(".jsonl")) continue;
    const full = path.join(CLR_TRANSCRIPT_DIR, f);
    const st = await stat(full);
    if (st.mtimeMs < sinceMs) continue;
    // Extract embedded timestamp from filename: <toolId>-drive-<ts>.jsonl
    const tsMatch = f.match(/-drive-(\d+)\.jsonl$/);
    const ts = tsMatch ? Number(tsMatch[1]) : st.mtimeMs;
    candidates.push({ path: full, ts });
  }
  candidates.sort((a, b) => a.ts - b.ts);
  const result = {};
  for (let i = 0; i < taskIds.length && i < candidates.length; i++) {
    result[taskIds[i]] = candidates[i].path;
  }
  return result;
}

/**
 * Execute a set of regression cases via clr.
 *
 * @param {object} opts
 * @param {Array} opts.cases - AgentHistoric regression cases to run.
 * @param {"cursor"|"claude"} opts.target - Which CLI profile to use.
 * @param {(c: object) => string} opts.buildPrompt - Produces the wrapped prompt per case.
 * @param {string} opts.stateDir - Directory for manifest.json, state.json.
 * @param {string} [opts.model] - Model override (AGENT_MODEL for cursor-agent).
 * @param {number} [opts.timeoutSec] - Per-task timeout.
 * @param {number} [opts.concurrency] - clr concurrency (only 1 is fully supported).
 * @param {(msg: string) => void} [opts.log] - Optional logger.
 * @returns {Promise<{ runId: string, results: Array<{caseId, status, response?, error?, transcriptPath?, rawBlock?}>, stateJson: object, clrExitCode: number }>}
 */
export async function runCasesViaClr(opts) {
  const {
    cases,
    target,
    buildPrompt,
    stateDir,
    model,
    timeoutSec = 180,
    concurrency = 1,
    log = () => {}
  } = opts;

  if (concurrency !== 1) {
    log(`[clr-runner] warning: concurrency=${concurrency} may miscorrelate transcripts; prefer 1`);
  }

  const toolId = getToolIdForTarget(target);
  await mkdir(stateDir, { recursive: true });

  const manifest = buildManifest({ cases, toolId, buildPrompt, timeoutSec, concurrency });
  const manifestPath = path.join(stateDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const env = { ...process.env };
  if (model && target === "cursor") env.AGENT_MODEL = model;

  const sinceMs = Date.now();
  log(`[clr-runner] orchestrate: ${cases.length} tasks via ${toolId}`);

  const { code, stdout, stderr } = await runSpawn("node", [
    CLR_CLI,
    "orchestrate",
    "--manifest", manifestPath,
    "--state-dir", stateDir,
    "--concurrency", String(concurrency)
  ], { env });

  // Persist clr stdout/stderr for debugging.
  await writeFile(path.join(stateDir, "orchestrate.log"), stdout + "\n--- STDERR ---\n" + stderr, "utf8");
  log(`[clr-runner] orchestrate exit=${code}`);

  let stateJson = {};
  const statePath = path.join(stateDir, "state.json");
  if (existsSync(statePath)) {
    stateJson = JSON.parse(await readFile(statePath, "utf8"));
  }

  const transcriptByCase = await correlateTranscripts({
    toolId,
    taskIds: cases.map((c) => c.id),
    sinceMs: sinceMs - 2000 // allow small clock skew
  });

  const results = [];
  for (const c of cases) {
    const taskState = stateJson.tasks?.[c.id];
    const transcriptPath = transcriptByCase[c.id];
    let response = null;
    let error = null;
    let rawBlock = null;

    if (transcriptPath) {
      const extracted = await extractSentinelJsonFromTranscript(transcriptPath);
      if (extracted.ok) {
        response = extracted.json;
      } else {
        error = extracted.error;
        rawBlock = extracted.block ?? extracted.raw?.slice(-1000);
      }
    } else {
      error = "no transcript found";
    }

    results.push({
      caseId: c.id,
      status: taskState?.status ?? "MISSING",
      attempts: taskState?.attempts ?? 0,
      transcriptPath,
      response,
      error,
      rawBlock
    });
  }

  return {
    runId: stateJson.run_id ?? "unknown",
    clrExitCode: code,
    results,
    stateJson
  };
}
