# AgentHistoric Performance Plan (with clr-orchestrated real-LLM runs)

Reset the AgentHistoric test baseline, fix three known real-LLM misrouting failures, exercise the unused ablation and multi-trial infrastructure, prototype Verbalized Sampling to attack the Descartes over-routing attractor, and route every real-LLM validation step through `cli-runner-learner` (`clr`) using a new `agent-print` args-mode profile so healing, checkpointing, and Fibonacci batching come for free.

---

## Current Baseline Findings

- **110/111 unit tests pass.** `@/Users/ephem/lcode/AgentHistoric/scripts/lib/prompt-system.test.mjs:44` fails because committed `@/Users/ephem/lcode/AgentHistoric/compiled/claude/rules/00-init.md` was built in debug mode but the sync test generates in production mode. Pre-existing regression — must be fixed before any measurable change.
- **Real-LLM accuracy (2026-04-06):** 76-80% raw / 84% with partial credit across Claude 4.6 Opus and GPT-5.4. Top failure mode is Descartes over-routing.
- **Latent unused infrastructure:** `@/Users/ephem/lcode/AgentHistoric/scripts/run-ablation.mjs`, trial-based regression runner, and A/B experiment toggler are all built but never executed on real LLMs.
- **Routing cases still failing on both models:** TP5 (Liskov→Descartes), TP3 (Peirce→Popper), SP-Kn2 on GPT (Knuth→Popper).

---

## Phase Order

Phase 0 → Phase A.1-A.5 → **Phase X (clr setup)** → Phase A.6 → Phase B → Phase C → Phase D.

Phase X is a new prerequisite for every real-LLM validation step from A.6 onward.

---

## Phase 0 — Baseline Reset

Make `npm run build:prompts` default to release mode so committed artifacts match the sync test. Current default at `@/Users/ephem/lcode/AgentHistoric/scripts/build-prompt-system.mjs:10` is debug=true inside the source repo.

- **0.1** Change default in `@/Users/ephem/lcode/AgentHistoric/scripts/build-prompt-system.mjs` to debug=false; rename current behaviour as `npm run build:prompts:debug` via `package.json`.
- **0.2** Rebuild `@/Users/ephem/lcode/AgentHistoric/compiled/` in release mode.
- **Gate:** `npm run test:unit` → **111/111 green**.

---

## Phase A — Routing Accuracy (closes known real-LLM misses)

Each fix is minimal, upstream, and targets the root cause in `@/Users/ephem/lcode/AgentHistoric/prompt-system/router.json`.

- **A.1 — TP5 (Liskov↔Descartes, both models).** Add `"callback contract"`, `"stable contract"`, `"third-party integrators"` to `routeToLiskov` in `@/Users/ephem/lcode/AgentHistoric/prompt-system/router.json:413-421`. Currently `routeToDescartes` captures "design the system"-style phrasing before Liskov's signals fire.
- **A.2 — TP3 (Peirce↔Popper, both models).** Add anti-triggers `"import error"`, `"config module"`, `"after upgrading"` to `Runtime Error Investigation` (priority 8.5) in `@/Users/ephem/lcode/AgentHistoric/prompt-system/router.json:250-264`. Prevents build-import errors from being read as runtime exceptions.
- **A.3 — SP-Kn2 (Knuth↔Popper on GPT).** Add `"profile heap allocations"` to `routeToKnuth` disambiguation in `@/Users/ephem/lcode/AgentHistoric/prompt-system/router.json:405-412`. Claude already routes correctly; GPT-specific disambiguation needed.
- **A.4 — MI3 (Simon↔Descartes on Claude).** **Defer.** Already tagged `ambiguousBetween: [Simon, Descartes]` at `@/Users/ephem/lcode/AgentHistoric/regression/fixtures/cases.json:1309`; partial credit already applies. Not a router bug, model divergence.
- **A.5** Add one regression case per fix in `@/Users/ephem/lcode/AgentHistoric/regression/fixtures/cases.json` that exercises the previously-mis-routing phrase.
- **Gate:** local simulator stays at 100% via `node --test scripts/lib/regression.test.mjs`.

---

## Phase X — clr Integration Setup

Route all real-LLM traffic through `clr` using a new args-mode profile. Decisions already made: **Option 1 (new args-mode profiles)**, **Option 2 (clr for agent+claude, codex stays on direct spawn), codex skipped for now, native claude CLI deferred as TODO**.

- **X.1 — Ensure clr is built.** `cd /Users/ephem/lcode/cli-runner-learner && npm install && npm run build`. Confirms `@/Users/ephem/lcode/cli-runner-learner/dist/cli.js` is executable.
- **X.2 — Learn `agent-print` profile.**
  ```
  node /Users/ephem/lcode/cli-runner-learner/dist/cli.js learn \
    --tool agent-print \
    --command agent \
    --args "--print --output-format json --mode ask --trust" \
    --mode args \
    --rounds 4
  ```
  Produces `@/Users/ephem/lcode/cli-runner-learner/profiles/agent-print.json` with `interaction_mode: "args"` which auto-selects `SentinelAdapter`. ~4-8 API calls.
- **X.3 — Smoke-test the profile.**
  ```
  node /Users/ephem/lcode/cli-runner-learner/dist/cli.js run \
    --tool agent-print \
    --input "Say hello in exactly three words."
  ```
- **X.4 — Add `@/Users/ephem/lcode/AgentHistoric/scripts/lib/clr-runner.mjs`.** Responsibilities:
  - `generateManifest(cases, { model, trials })` builds a `Manifest` object with one `TaskDef` per (case × trial), `tool_id: "agent-print"`, `input: buildWrappedPrompt(testCase) + sentinel hint`, `timeout_sec: 120`.
  - Spawns `clr orchestrate --manifest <tmpfile> --state-dir <tmpstate> --concurrency N` via child_process.
  - Reads back per-task results from the state directory; runs them through existing `parseAgentCliResult()` and `scoreCase()`.
- **X.5 — Add `@/Users/ephem/lcode/AgentHistoric/scripts/run-via-clr.mjs`** that mirrors `run-regressions.mjs`'s CLI surface but routes through `clr-runner.mjs`. Accepts `--suite`, `--targets`, `--trials`, `--parallel`, `--case`, `--model`.
- **X.6 — `package.json` addition.** `"test:regressions:clr": "node scripts/run-via-clr.mjs"`.
- **X.7 — TODO:** Learn `claude-print` profile for native Anthropic CLI. Non-blocking. Both Claude 4.6 Opus and GPT-5.4 are already accessible through the cursor-agent `--model` flag, so this is pure future optionality.
- **Gate:** `npm run test:regressions:clr -- --suite smoke --case R1 --trials 1` produces a parseable scored result matching what `run-regressions.mjs` would have produced.

### What clr buys us vs. current `execSync` path

| Capability | Current `run-batch-experiment.mjs` | Via clr |
|---|---|---|
| Healing on transient rate limits / crashes | None | `auto` (LLM + deterministic) |
| Checkpoint + resume mid-batch | None | Per-batch atomic saves |
| Failure-rate-driven batch sizing | Fixed | Fibonacci shrink/grow |
| Per-task timeout escalation | None | `timing` heal patch |
| Prompt-gap heal patches | None | `prompt_gap` adds specificity |

---

## Phase A.6 — Real-LLM Spot-Check (via clr)

Run TP5, TP3, SP-Kn2 plus their new companion regression cases on both Claude 4.6 Opus and GPT-5.4 through `agent-print`, 3 trials each.

```
npm run test:regressions:clr -- --suite full --case TP5,TP3,SP-Kn2 --trials 3 --model claude-4.6-opus-high
npm run test:regressions:clr -- --suite full --case TP5,TP3,SP-Kn2 --trials 3 --model gpt-5.4-medium
```

- **Cost:** ~18 API calls.
- **Gate:** pass^k = 1.0 (all trials route correctly) for each of TP5, TP3, SP-Kn2.

---

## Phase B — Behavioral Quality

- **B.1** Add a `--local` flag to `@/Users/ephem/lcode/AgentHistoric/scripts/run-ablation.mjs` that uses `routePrompt()` + synthetic graders. Proves the orchestration works without API cost.
- **B.2** Run `npm run test:regressions -- --trials 3 --suite smoke` (existing mechanism, local-only) to establish the first multi-trial pass^k baseline.
- **B.3** Add numeric word-count anchor to `@/Users/ephem/lcode/AgentHistoric/prompt-system/experts/expert-visionary-dennett.json` `voice[]`. Example: `"Keep each alternative draft to <=80 words."` Research baseline: ~1.2% output-token reduction per numeric anchor.
- **B.4 (via clr)** Run real-LLM ablation on the 3 largest manifest sections (`logging-protocol`, `foundational-constraints`, `behavioral-guardrails`) against the smoke suite, 3 trials per condition.
  ```
  node scripts/run-ablation.mjs --sections logging-protocol,foundational-constraints,behavioral-guardrails --trials 3 --runner clr --model claude-4.6-opus-high
  ```
  - **Cost:** ~40 API calls.
  - **Gate:** Each ablated section gets a KEEP/REVIEW/REMOVE verdict with measured deltas.

---

## Phase C — Novel Research: Verbalized Sampling

Attack the Descartes over-routing attractor directly.

- **C.1 — Prototype.** Router emits a ranked confidence distribution when two or more heuristics score close. Add `confidenceDistribution` to the expected JSON schema at `@/Users/ephem/lcode/AgentHistoric/scripts/lib/regression.mjs:85-117`. Add a contract rule in `@/Users/ephem/lcode/AgentHistoric/prompt-system/router.json` that instructs the agent to emit the distribution.
- **C.1.5** Gate behind `experimentFlags.verbalizedSampling = false` so the existing A/B runner at `@/Users/ephem/lcode/AgentHistoric/scripts/run-experiment.mjs` can toggle it.
- **C.2 (via clr)** Run A/B on the 4 cases that currently misroute to Descartes (TP5, SP-Li1, SP-Si1, SP-Si2) with both models. Compare raw accuracy between VS-on and VS-off.
  - **Cost:** ~24 API calls.
  - **Gate:** Measurable improvement in routing accuracy on the 4 attractor cases (target: 3/4 correct on VS-on vs. 0/4 on VS-off).

---

## Phase D — Validation + Report

Write `@/Users/ephem/lcode/AgentHistoric/docs/plans/PHASE-7-IMPLEMENTATION-REPORT.md` mirroring the Phase 5/6 format. Include:

- Before/after local simulator accuracy
- Before/after real-LLM accuracy per model (via clr baseline)
- Ablation verdicts for the 3 tested sections
- Verbalized Sampling A/B delta
- Updated test count

---

## Cost & Time Envelope

| Phase | API calls | Complexity |
|---|---:|---|
| 0 | 0 | Trivial (config + rebuild) |
| A.1-A.5 | 0 | Small edits to JSON |
| X | ~4-8 | One-time profile learning + new runner script |
| A.6 | ~18 | clr-driven validation |
| B.1-B.3 | 0 | Small edits + infra |
| B.4 | ~40 | clr-driven ablation |
| C.1 | 0 | Prototype code |
| C.2 | ~24 | clr-driven A/B |
| D | 0 | Report writing |
| **Total** | **~90-100** | |

---

## Files Created

- `@/Users/ephem/lcode/cli-runner-learner/profiles/agent-print.json` (via `clr learn`)
- `@/Users/ephem/lcode/AgentHistoric/scripts/lib/clr-runner.mjs`
- `@/Users/ephem/lcode/AgentHistoric/scripts/run-via-clr.mjs`
- `@/Users/ephem/lcode/AgentHistoric/docs/plans/PHASE-7-IMPLEMENTATION-REPORT.md`

## Files Modified

- `@/Users/ephem/lcode/AgentHistoric/scripts/build-prompt-system.mjs` (release mode default)
- `@/Users/ephem/lcode/AgentHistoric/package.json` (new scripts)
- `@/Users/ephem/lcode/AgentHistoric/compiled/**` (rebuilt in release mode)
- `@/Users/ephem/lcode/AgentHistoric/prompt-system/router.json` (TP5/TP3/SP-Kn2 fixes, VS flag)
- `@/Users/ephem/lcode/AgentHistoric/regression/fixtures/cases.json` (new regression cases)
- `@/Users/ephem/lcode/AgentHistoric/prompt-system/experts/expert-visionary-dennett.json` (concision anchor)
- `@/Users/ephem/lcode/AgentHistoric/scripts/run-ablation.mjs` (add `--local` and `--runner clr` flags)
- `@/Users/ephem/lcode/AgentHistoric/scripts/lib/regression.mjs` (VS support in schema, expected sections)

## Files Not Touched (explicit)

- `@/Users/ephem/lcode/AgentHistoric/scripts/run-regressions.mjs` (codex path intact)
- `@/Users/ephem/lcode/AgentHistoric/scripts/run-batch-experiment.mjs` (kept for reference)
- `@/Users/ephem/lcode/cli-runner-learner/src/**` (no source edits; profiles are data)

---

## Open TODOs for Future Sessions

1. Learn `claude-print` args-mode profile for native Anthropic CLI (gives access to Anthropic's rate-limit pool instead of Cursor's).
2. Learn `codex-print` args-mode profile if codex target becomes important again.
3. Consider applying Phase C results into a `modifier-verbalized-sampling.json` if the prototype earns its tokens.
4. Re-run the full batch experiment against all 25 cases once Phase C ships to get a clean 2026-Q2 baseline replacing the 2026-04-06 numbers.

---

## Assumptions That Invalidate the Plan If Wrong

1. `/Users/bsonntag/.local/bin/agent` accepts the args `--print --output-format json --mode ask --trust` non-interactively. Current `@/Users/ephem/lcode/AgentHistoric/scripts/run-regressions.mjs:121-136` already uses this combination, so this is verified.
2. `clr`'s SentinelAdapter JSON extraction works when the sentinel content is AgentHistoric's schema (not just `{status, summary}`). `@/Users/ephem/lcode/cli-runner-learner/src/orchestration/adapters/sentinel.ts:69-84` passes through any JSON object, so this is fine.
3. Current 2026-04-06 batch-experiment results are the most recent baseline. Verified — no newer file in `@/Users/ephem/lcode/AgentHistoric/.logs/batch-experiments/`.
4. Node 20+ is available (required by `cli-runner-learner`). Verify with `node --version` at Phase X.1.
