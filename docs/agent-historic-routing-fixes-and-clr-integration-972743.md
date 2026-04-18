# AgentHistoric: Routing Fixes, clr Integration, and Ablation Expansion

Full roadmap snapshot for the multi-phase effort to stabilize routing on ambiguous cases, integrate `cli-runner-learner` (clr) as a real-LLM runner with retry/healing, expand ablation/multi-trial infrastructure, and prototype Variable Substitution (VS) — with status markers so this file doubles as a progress log and a resume guide.

---

## Phase 0 — Foundation (DONE)

- [x] **0.1** `npm run build:prompts` default (non-debug) verified clean.
- [x] **0.2** Sync test: compiled artifacts match `prompt-system/` sources.
- [x] **0.3** 111 unit tests green baseline before any edits.

---

## Phase A — Routing fixes (DONE through A.5; A.6 pending real-LLM spot-check)

### A.1–A.3: Local router fixes for three known misroutes (DONE)

Added disambiguation signals + negative examples in `prompt-system/router.json`, and extended `scripts/lib/regression.mjs` `isNegativeMatch()` to enforce new rules locally.

- **TP5** (`expert-abstractions-liskov`): "webhook / callback contract / third-party integrators" → Liskov, not Descartes.
- **TP3** (`expert-engineer-peirce`): "build is broken / import error / config module / dependency upgrade" → Peirce, not Popper (distinguishing build/config errors from runtime failures).
- **SP-Kn2** (`expert-performance-knuth`): "memory leak / heap profile / allocations over hours" → Knuth, not Popper.
- **MI3 side-effect** (`expert-orchestrator-simon`): "phased plan / gates / rollback criteria / migrate N services" → Simon, not Descartes.

Negative examples extended with `doNotRouteToDescartes` key. Renderers iterate `Object.entries(r.negativeExamples)` so the new key propagates across all targets automatically.

### A.4: Rebuild + tests (DONE)

`npm run build:prompts && npm run test:unit` → 111/111 green. Local simulator confirms all four cases (plus paraphrased variants) route correctly.

### A.5: Regression variants for robustness (DONE)

Added four paraphrased variants to `regression/fixtures/cases.json`:

- **TP3b** — build/config error after dependency bump (Peirce)
- **TP5b** — webhook callback contract for third-party integrators (Liskov)
- **SP-Kn3** — heap allocation profiling for gradual memory growth (Knuth)
- **MI3b** — phased migration plan with gates and rollback (Simon)

All four added to `full`, `twopass`, `specialist-pressure`, `mixed-intent`, and `model-parity` suites with `expectedParity: true`. Local simulator: 8/8 pass.

### A.6: Real-LLM spot-check via clr (PENDING)

Run **only the four fixed cases** (TP3, TP3b, TP5, TP5b, SP-Kn2, SP-Kn3, MI3, MI3b) against both `cursor` and `claude` through clr to confirm the disambiguation guidance survives real LLM interpretation. Expected outcome: ≥7/8 correct on each target post-fix (up from misroutes pre-fix).

Command:

```bash
node scripts/run-via-clr.mjs --targets cursor,claude \
  --case TP3,TP3b,TP5,TP5b,SP-Kn2,SP-Kn3,MI3,MI3b
```

---

## Phase X — clr integration (DONE through X.6; end-to-end smoke pending)

### X.1: clr build verified (DONE)

`dist/cli.js` is current. `orchestrate` subcommand is available with `--manifest`, `--state-dir`, `--concurrency`, `--resume`, `--llm-budget` flags.

### X.2: `agent-print` + `claude-print` profiles added (DONE)

Wrapper scripts in `scripts/clr-wrappers/`:

- **`agent-print.sh`** — `cursor-agent -p --output-format text --model "$AGENT_MODEL" "$*"` (default model `gpt-5.4-medium`).
- **`claude-print.sh`** — `claude -p "$*"`. Needed because `claude` does not accept split argv as a joined prompt (only reads the first token).

Why wrappers: clr's driver splits `opts.input` on spaces and passes each token as argv. `cursor-agent` accepts variadic positional prompts natively, but `claude` does not. Wrappers rejoin `$*` into a single quoted prompt.

Profiles in `cli-runner-learner/profiles/`:

- **`agent-print.json`** — `interaction_mode: "args"`, points to `agent-print.sh`.
- **`claude-print.json`** — same pattern, points to `claude-print.sh`.

Both use `interaction_mode: "args"`, which auto-selects the SentinelAdapter in clr.

### X.3: Print profile smoke test (DONE)

Ran `smoke-manifest.json` with a two-task manifest ("Reply with exactly: OK") through `clr orchestrate`. Both tasks returned `DONE` with sentinel-wrapped JSON. Confirms:

- Profiles load correctly.
- Wrappers forward the prompt.
- SentinelAdapter parses JSON between `<<<TASK_RESULT>>>` markers.
- Transcripts land in `cli-runner-learner/transcripts/<tool_id>-drive-<ts>.jsonl`.

### X.4: `scripts/lib/clr-runner.mjs` (DONE)

Public API:

- `getToolIdForTarget(target)` → maps `cursor` → `agent-print`, `claude` → `claude-print`.
- `decorateWrappedPromptForClr(wrappedPrompt)` — appends sentinel protocol so the LLM merges AgentHistoric's routing contract keys with `status`/`summary` inside one JSON object between the markers.
- `buildManifest({ cases, toolId, buildPrompt, timeoutSec, concurrency })`.
- `extractSentinelJsonFromTranscript(transcriptPath)` — decodes hex `recv` events, strips ANSI, extracts the last sentinel block, parses JSON.
- `runCasesViaClr(opts)` — writes manifest, invokes `clr orchestrate`, correlates transcripts to tasks by chronological order (concurrency=1 constraint), returns `{ runId, clrExitCode, results[], stateJson }`.

**Known limitation:** transcript correlation assumes `concurrency: 1`. Higher concurrency is not yet supported; would require clr to expose per-task transcript paths in its state (or a small clr source change).

### X.5: `scripts/run-via-clr.mjs` (DONE)

CLI mirrors `run-regressions.mjs` interface:

- `--suite`, `--targets` (cursor,claude only), `--case`, `--cursor-model`, `--claude-model`, `--state-dir`, `--timeout-sec`.
- Runs one clr invocation per target with all selected cases batched.
- Writes `.logs/clr-summary-<ts>.{json,md}` with per-case clr status, attempts, extract errors, selected vs expected expert, and match flag.

### X.6: `package.json` scripts (DONE)

- `npm run test:regressions:clr` → full suite.
- `npm run test:regressions:clr:smoke` → smoke suite (R1, R2, Q1, P1).

### X.7: End-to-end validation (PENDING)

Run `test:regressions:clr:smoke` against `cursor` to confirm the complete pipeline (manifest → orchestrate → transcript extraction → scoring) works against real LLM output. Watch for:

- Any case where `extractSentinelJsonFromTranscript` fails (LLM ignored sentinel instructions).
- Mis-correlation between transcripts and tasks (should not happen at concurrency=1).
- Timeout cliffs (default 180s per task; adjust via `--timeout-sec`).

Then repeat against `claude` target. If `claude -p` stdout contains trailing noise that breaks sentinel extraction, consider adding `--output-format stream-json` or similar to `claude-print.sh`.

---

## Phase B — Ablation + multi-trial expansion (PENDING)

### B.1: Add `--local` flag to `scripts/run-ablation.mjs` (PENDING)

Allow ablation runs to use the local simulator (`routePrompt`) instead of real LLM calls. Goal: sub-second iteration on prompt-system ablation experiments during development.

Design: reuse `routePrompt(system, prompt)` and stub out `response` with a minimal shape `{ routingDecision: { selectedExpert }, ... }` so downstream scoring logic stays identical.

### B.2: `trials=3` baseline against smoke suite, locally (PENDING)

Run 3 trials per smoke case via `routePrompt` (now deterministic — should always agree with itself). Goal: shake out any nondeterminism in the local simulator before using it for ablation.

### B.3: Numeric word-count anchor for Dennett (PENDING)

Investigate whether Dennett's concision guidance should be a numeric target (e.g., "each draft ≤ 120 words") rather than a prose rule. Add a behavioral assertion to the evaluator and a guardrail entry. Test with real LLM before shipping.

### B.4: Real-LLM ablation sweep via clr (PENDING)

Once X.7 is validated: rerun the full ablation matrix through `run-via-clr.mjs` for cross-model accuracy under each ablation. Expected runtime: ~30–60 minutes per model depending on case count.

---

## Phase C — Variable Substitution (VS) prototype (PENDING)

### C.1: VS prototype (PENDING)

Prototype per-project variable substitution in the compiled prompt artifacts (e.g., `{{project_name}}`, `{{primary_language}}`). Goal: reduce token count for router.mdc by letting projects override shared boilerplate.

Design sketch:

- Add `vs` block to `prompt-system/` JSON defining available variables with defaults.
- Renderer substitutes at build time based on a `prompt-system/project-overrides.json` (optional, gitignored).
- Fall back to defaults when the overrides file is absent so CI stays deterministic.

### C.2: VS flag + A/B test (PENDING)

Gate VS behind a build flag. Run an A/B ablation comparing VS-enabled vs default artifacts on smoke + twopass suites. Ship only if routing accuracy is equal or better *and* token savings are >10%.

---

## Phase D — Implementation report (PENDING)

Single markdown deliverable summarizing:

- **Routing fixes (Phase A)** — which misroutes, before/after on real LLM, regression variant coverage.
- **clr integration (Phase X)** — architecture diagram, retry/healing benefits quantified (runs completed without manual intervention vs. prior flakiness), known limitations.
- **Ablation findings (Phase B)** — local-sim speedups, multi-trial variance data, Dennett concision result.
- **VS outcome (Phase C)** — ship/no-ship with data.
- **Open follow-ups** — concurrency>1 support in clr-runner, claude stdout-format fragility, any newly discovered misroutes.

Target length: 2–3 pages. Location: `regression/reports/clr-integration-<date>.md` or similar.

---

## Open questions / known risks

- **Transcript correlation fragility.** `clr-runner.mjs` assumes concurrency=1 and orders transcripts by filename timestamp. If two tasks ever start in the same millisecond, correlation breaks silently. Mitigation options: (a) monkeypatch clr to emit per-task transcript paths; (b) insert a 2ms sleep between tasks; (c) pin concurrency=1 with a comment.
- **claude stdout noise.** `claude -p` sometimes emits trailing terminal escapes that survive our strip regex. If B.4 / X.7 produce parse failures, switch `claude-print.sh` to `--output-format stream-json` or a structured mode.
- **Sentinel instruction conflicts.** `decorateWrappedPromptForClr` provides its own sentinel protocol, and clr's SentinelAdapter also appends `SENTINEL_INSTRUCTIONS`. Both describe the same format, but if either changes the markers in the future they will diverge. Consider pinning both to a shared constant.
- **Negative-rule drift.** `isNegativeMatch` in `regression.mjs` duplicates phrase-matching logic from `router.json` negative examples. A schema change to the rules would require a code update. Acceptable for now; revisit if the ruleset grows past ~10 entries per key.

---

## Resume checklist (for the next session)

1. Run `npm run test:regressions:clr:smoke --targets cursor` and inspect the generated markdown summary in `.logs/clr-summary-*.md`. If all 4 smoke cases extract successfully, X.7 is done.
2. Repeat with `--targets claude`. Fix any claude-stdout parse issues in `claude-print.sh` before proceeding.
3. Run the A.6 spot-check on the 8 fixed-case IDs across both targets.
4. If A.6 is clean, merge the routing + clr integration work and move to Phase B.
