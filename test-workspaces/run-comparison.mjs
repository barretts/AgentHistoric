#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname);
const MANIFEST_PATH = join(ROOT, "manifest.json");
const STATE_PATH = join(ROOT, ".state.json");
const OUTPUT_DIR = join(ROOT, ".output");
const PROMPT = "Design the data model and trust boundaries for a user notification system that supports email, SMS, and push channels with per-user preferences and rate limiting.";

// ── Load manifest ──────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

// ── Load or init state ─────────────────────────────────────────────
let state;
if (existsSync(STATE_PATH)) {
  state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  console.log(`Resuming run: ${state.run_id} (${Object.values(state.tasks).filter(t => t.status === "DONE").length}/${manifest.tasks.length} done)`);
} else {
  state = {
    state_version: "2.0",
    run_id: manifest.run_id,
    run_status: "RUNNING",
    abort_reason: null,
    manifest_digest: simpleDigest(JSON.stringify(manifest.tasks.map(t => t.id))),
    policy: {
      heal_schedule: "off",
      batch_strategy: "fixed",
      current_batch_size: 1,
      failure_threshold: 0.5,
      max_worker_attempts_per_task: 2,
      max_heal_rounds_per_window: 0,
      max_total_heal_rounds: 0,
      signature_repeat_limit: 1,
    },
    tasks: {},
    healing_rounds: [],
  };
  for (const task of manifest.tasks) {
    state.tasks[task.id] = {
      status: task.status === "DONE" ? "DONE" : "PENDING",
      worker_attempts: task.status === "DONE" ? 1 : 0,
      healer_attempts: 0,
      last_failure_class: null,
      last_failure_signature: null,
      applied_patch_ids: [],
      history: [],
    };
  }
  saveState();
}

// ── Run pending tasks sequentially ─────────────────────────────────
const pending = manifest.tasks.filter(t => state.tasks[t.id].status !== "DONE");
console.log(`\n${pending.length} tasks remaining\n`);

for (const task of pending) {
  const { id, model, condition, timeout_sec } = task;
  const modelDir = join(OUTPUT_DIR, model);
  mkdirSync(modelDir, { recursive: true });

  const outFile = join(modelDir, `${condition}.jsonl`);
  const workspace = join(ROOT, condition);

  console.log(`▶ ${id}  (model=${model}, condition=${condition})`);
  state.tasks[id].status = "RUNNING";
  saveState();

  const start = Date.now();
  try {
    execSync(
      `agent --print --output-format stream-json --model ${model} --trust --workspace "${workspace}" "${PROMPT}" > "${outFile}" 2>&1`,
      { timeout: timeout_sec * 1000, stdio: "pipe", cwd: workspace }
    );
    const duration = ((Date.now() - start) / 1000).toFixed(1);

    // Verify output exists and has content
    const size = readFileSync(outFile).length;
    if (size < 100) throw new Error(`Output too small: ${size} bytes`);

    state.tasks[id].status = "DONE";
    state.tasks[id].worker_attempts += 1;
    state.tasks[id].history.push({
      task_id: id,
      phase: "worker",
      attempt_number: state.tasks[id].worker_attempts,
      log_path: outFile,
      verify_log_path: null,
      exit_code: 0,
      failure_class: null,
      failure_signature: null,
      applied_patch_ids: [],
      duration_sec: parseFloat(duration),
      timestamp: new Date().toISOString(),
    });

    console.log(`  ✓ DONE (${duration}s, ${size} bytes)\n`);
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const failClass = err.killed ? "TIMEOUT" : "EXEC_ERROR";

    state.tasks[id].status = "FAILED";
    state.tasks[id].worker_attempts += 1;
    state.tasks[id].last_failure_class = failClass;
    state.tasks[id].last_failure_signature = stableSignature(err.message);
    state.tasks[id].history.push({
      task_id: id,
      phase: "worker",
      attempt_number: state.tasks[id].worker_attempts,
      log_path: outFile,
      verify_log_path: null,
      exit_code: err.status ?? null,
      failure_class: failClass,
      failure_signature: stableSignature(err.message),
      applied_patch_ids: [],
      duration_sec: parseFloat(duration),
      timestamp: new Date().toISOString(),
    });

    console.log(`  ✗ FAILED: ${failClass} (${duration}s) — ${err.message.slice(0, 120)}\n`);
  }
  saveState();
}

// ── Summary ────────────────────────────────────────────────────────
const done = Object.values(state.tasks).filter(t => t.status === "DONE").length;
const failed = Object.values(state.tasks).filter(t => t.status === "FAILED").length;
const total = manifest.tasks.length;
state.run_status = failed === 0 ? "COMPLETED" : "COMPLETED";
saveState();

console.log(`\n═══ Run complete: ${done}/${total} done, ${failed} failed ═══`);
if (failed > 0) {
  console.log("Failed tasks:");
  for (const [id, t] of Object.entries(state.tasks)) {
    if (t.status === "FAILED") console.log(`  - ${id}: ${t.last_failure_class}`);
  }
  console.log("\nRe-run to retry failed tasks (state is resumable).");
}

// ── Helpers ────────────────────────────────────────────────────────
function saveState() {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function simpleDigest(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return "d" + Math.abs(h).toString(36);
}

function stableSignature(msg) {
  return msg.replace(/[0-9]+/g, "N").replace(/\s+/g, " ").slice(0, 80);
}
