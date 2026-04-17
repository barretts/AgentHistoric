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

// CLR_ROOT is configurable via env var so the runner is portable across dev
// environments. Default points to the Linux checkout on this machine; other
// boxes should set `CLR_ROOT=/path/to/cli-runner-learner` before invoking.
const CLR_ROOT = process.env.CLR_ROOT || "/home/barrett/code/cli-runner-learner";
const CLR_CLI = path.join(CLR_ROOT, "dist/cli.js");
const CLR_TRANSCRIPT_DIR = path.join(CLR_ROOT, "transcripts");

function ensureClrBuilt() {
  if (!existsSync(CLR_CLI)) {
    throw new Error(
      `clr not built at ${CLR_CLI}. Set CLR_ROOT env var or run \`npm install && npm run build\` inside ${CLR_ROOT}.`
    );
  }
}

const TOOL_ID_BY_TARGET = {
  cursor: "agent-print",
  // claude-print profile exists but claude's --print mode hangs on Linux;
  // prefer crush as the secondary target for cross-model coverage.
  claude: "claude-print",
  crush: "crush-print"
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
      // Use fixed batching: clr's fibonacci growth advances batchIndex by the
      // full batch size even when some slots contain already-completed tasks,
      // causing later tasks to be skipped. Fixed keeps batch size at 1 so each
      // iteration corresponds to exactly one new task.
      batch_strategy: "fixed"
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

  // Fallback 1: end marker present but start marker was overwritten by TUI
  // rendering. Walk backwards from the last end marker to find the opening `{`
  // of a balanced JSON object.
  if (!block) {
    const lastEnd = cleaned.lastIndexOf(SENTINEL_END);
    if (lastEnd !== -1) {
      const before = cleaned.slice(0, lastEnd);
      const candidate = findLastBalancedJsonObject(before);
      if (candidate) block = candidate;
    }
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

/**
 * Walk backwards through `text` to find the last balanced `{...}` JSON object.
 * Handles strings (with escaped quotes) so braces inside strings don't upset
 * the balance count. Returns the trimmed block contents or null.
 */
function findLastBalancedJsonObject(text) {
  const lastClose = text.lastIndexOf("}");
  if (lastClose === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = lastClose; i >= 0; i--) {
    const ch = text[i];
    // Going backwards, escape handling: if the char before this is a `\` and
    // not itself escaped, treat the current character as non-syntactic. We
    // approximate by counting consecutive backslashes to the left.
    if (inString) {
      if (ch === '"') {
        // Count preceding backslashes to determine if this quote is escaped.
        let bs = 0;
        for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) bs++;
        if (bs % 2 === 0) inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "}") depth++;
    else if (ch === "{") {
      depth--;
      if (depth === 0) {
        return text.slice(i, lastClose + 1).trim();
      }
    }
  }
  return null;
}

function runSpawn(command, args, { env, cwd, onStdout, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: env ?? process.env,
      cwd: cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      const s = d.toString();
      out += s;
      if (onStdout) onStdout(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      if (onStderr) onStderr(s);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout: out, stderr: err }));
  });
}

/**
 * Line-splitter factory: buffers partial lines across chunks and invokes
 * `onLine(line)` for each complete line. Used to attach per-line verbose
 * logging to the streaming clr subprocess output.
 */
function lineStreamer(onLine) {
  let buf = "";
  return (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      onLine(line);
    }
  };
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
    log = () => {},
    verbose = true
  } = opts;

  if (concurrency !== 1) {
    log(`[clr-runner] warning: concurrency=${concurrency} may miscorrelate transcripts; prefer 1`);
  }

  ensureClrBuilt();
  const toolId = getToolIdForTarget(target);
  await mkdir(stateDir, { recursive: true });

  const manifest = buildManifest({ cases, toolId, buildPrompt, timeoutSec, concurrency });
  const manifestPath = path.join(stateDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  if (verbose) {
    const totalPromptBytes = manifest.tasks.reduce((n, t) => n + (t.input?.length ?? 0), 0);
    log(`[clr-runner] target=${target} toolId=${toolId} model=${model ?? "(default)"}`);
    log(`[clr-runner] stateDir=${stateDir}`);
    log(`[clr-runner] manifest: ${cases.length} tasks, ~${totalPromptBytes} bytes total prompt, per-task timeout=${timeoutSec}s`);
    log(`[clr-runner] tasks: ${manifest.tasks.map((t) => t.id).join(", ")}`);
  }

  const env = { ...process.env };
  if (model && target === "cursor") env.AGENT_MODEL = model;

  const sinceMs = Date.now();
  const runStart = Date.now();
  log(`[clr-runner] orchestrate: ${cases.length} tasks via ${toolId}`);

  // Stream clr subprocess output line-by-line so the user sees progress live.
  // We prefix each line with the target so multi-target runs stay legible.
  const prefix = `[clr:${target}]`;
  const logStdout = verbose
    ? lineStreamer((line) => {
        if (line.trim()) console.log(`${prefix} ${line}`);
      })
    : undefined;
  const logStderr = verbose
    ? lineStreamer((line) => {
        if (line.trim()) console.error(`${prefix}!! ${line}`);
      })
    : undefined;

  const { code, stdout, stderr } = await runSpawn("node", [
    CLR_CLI,
    "orchestrate",
    "--manifest", manifestPath,
    "--state-dir", stateDir,
    "--concurrency", String(concurrency)
  ], { env, onStdout: logStdout, onStderr: logStderr });

  const runElapsedMs = Date.now() - runStart;
  // Persist clr stdout/stderr for debugging.
  await writeFile(path.join(stateDir, "orchestrate.log"), stdout + "\n--- STDERR ---\n" + stderr, "utf8");
  log(`[clr-runner] orchestrate exit=${code} (${(runElapsedMs / 1000).toFixed(1)}s)`);

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

  if (verbose) {
    log(`[clr-runner] correlated ${Object.keys(transcriptByCase).length}/${cases.length} transcripts`);
  }

  const results = [];
  for (const c of cases) {
    const taskState = stateJson.tasks?.[c.id];
    const transcriptPath = transcriptByCase[c.id];
    let response = null;
    let error = null;
    let rawBlock = null;
    let transcriptBytes = 0;

    if (transcriptPath) {
      try {
        const st = await stat(transcriptPath);
        transcriptBytes = st.size;
      } catch { /* ignore */ }
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

    if (verbose) {
      const expert = response?.routingDecision?.selectedExpert
        ?? response?.activeExpert
        ?? "none";
      const statusTag = taskState?.status ?? "MISSING";
      const errTag = error ? ` ERROR: ${error}` : "";
      log(`[clr-runner]   case=${c.id} status=${statusTag} attempts=${taskState?.attempts ?? 0} transcript=${transcriptBytes}B expert=${expert}${errTag}`);
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
