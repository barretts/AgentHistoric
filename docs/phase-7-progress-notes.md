# Phase 7 Progress Notes

Internal scratch pad for the Phase 7 implementation work. Not a user-facing report (see `PHASE-7-IMPLEMENTATION-REPORT.md` — D.1 — for that).

## Completed (P.1 — A.6)

### Infrastructure bugfixes

1. **`CLR_ROOT` env var in `scripts/lib/clr-runner.mjs`** -- portability.
2. **`profiles/agent-print.json`** / **`profiles/crush-print.json`** / **`profiles/claude-print.json`** -- args-mode sentinel profiles for each target.
3. **clr fibonacci batching re-runs completed tasks** -- fixed in `cli-runner-learner/src/orchestration/orchestrator.ts` by filtering `ready` on `ts.status === PENDING|FAILED` in addition to `depsReady`. Without the filter, `batchIndex += batch.length` advanced past new tasks once a growing batch included already-DONE tasks.
4. **clr PTY cols=120 soft-wrapped long JSON with CR/LF** -- fixed in `cli-runner-learner/src/runner/session.ts` by setting `cols: 10000`. At cols=120 the VT emulator inserted `\r\n` mid-string in long single-line JSON outputs, corrupting sentinel parsing (`"personaBlend":f\r\nalse`).
5. **clr driver hardcoded 30s synthetic-settle** -- fixed in `cli-runner-learner/src/runner/driver.ts` by making the `session.nextEvent` poll cap `max(settle_timeout_ms + 5000, 30000)`. The hardcoded `Math.min(remainingMs, 30000)` fired a synthetic "settled" event at 30s regardless of profile `idle_threshold_sec`, killing cursor-agent before it produced any output for slower prompts.
6. **Profile idle thresholds bumped** to `idle_threshold_sec: 90` in all three args-mode profiles to accommodate slow LLM first-token latency.
7. **Crush TUI progress pings** -- wrapper exports `NO_COLOR=1`, `TERM=dumb`, `GLAMOUR_STYLE=notty`, `--quiet`. Crush still emits OSC 9;4 progress-bar escapes but they are stripped by the extractor's OSC regex. Functionally clean.
8. **Sentinel fallback extractor** -- added `findLastBalancedJsonObject()` in `scripts/lib/clr-runner.mjs` to recover when the `<<<TASK_RESULT>>>` start marker is overwritten by TUI rendering but the end marker survives.
9. **Verbose logging** -- `[clr:<target>]`-prefixed live streaming of clr stdout, per-case timings, prompt byte counts, transcript sizes, and per-case verdicts in `scripts/run-via-clr.mjs` and `scripts/lib/clr-runner.mjs`.

### P.5 — X.7 smoke gate

After all bugfixes: **4/4 matched on cursor (gpt-5.4-medium) and 4/4 matched on crush**. Both targets extract cleanly; no healing triggered.

### A.6 — 8-case real-LLM spot-check (TP3, TP3b, TP5, TP5b, SP-Kn2, SP-Kn3, MI3, MI3b)

| Target | Matched | Extracted | Wall-clock |
| --- | --- | --- | --- |
| cursor (gpt-5.4-medium) | 0/8 | 8/8 | 301s |
| crush (default) | 5/8 | 8/8 | 279s |

**Critical finding — cursor prefix hallucination:**

`gpt-5.4-medium` consistently identifies the correct **domain** (e.g. "Build & Config Errors", "Refactoring & Restructuring") but hallucinates the expert-id **prefix**, producing ids that do not exist:

| Expected | Got from cursor |
| --- | --- |
| `expert-engineer-peirce` (TP3) | `expert-engineer-shannon` |
| `expert-abstractions-liskov` (TP5) | `expert-engineer-liskov` |
| `expert-performance-knuth` (SP-Kn2) | `expert-engineer-shannon` |
| `expert-orchestrator-simon` (MI3) | `expert-engineer-descartes` |
| `expert-engineer-peirce` (TP3b) | `expert-qa-popper` |
| `expert-abstractions-liskov` (TP5b) | `expert-architect-liskov` |
| `expert-performance-knuth` (SP-Kn3) | `expert-engineer-popper` |
| `expert-orchestrator-simon` (MI3b) | `expert-architect-descartes` |

These ids are malformed combinations -- the real roster is fixed:

- `expert-abstractions-liskov`
- `expert-architect-descartes`
- `expert-engineer-peirce`
- `expert-formal-dijkstra`
- `expert-information-shannon`
- `expert-manager-blackmore`
- `expert-orchestrator-simon`
- `expert-performance-knuth`
- `expert-qa-popper`
- `expert-ux-rogers`
- `expert-visionary-dennett`

The response text is reasonable; only the id is wrong. This is a routing-prompt finding: the router must include an explicit allowlist of valid expert ids and require the LLM to echo one verbatim.

**crush misses:** MI3, TP5b, MI3b all route to `expert-architect-descartes` -- the known Descartes attractor problem documented in Phase 6.

## Completed (B.1 — B.3)

### B.1 — `--local` flag for ablation runs

Added `--local` and `--seed N` flags to `parseArgs`. When set, `run-ablation.mjs` substitutes each real-LLM call with `buildLocalResponse()` -- a deterministic synthetic envelope built from `routePrompt()`. Ablation deltas are ~0 by design; the flag exists to exercise the trial/aggregation/report scaffolding in sub-second time during dev.

### B.2 — Local multi-trial smoke baseline

`node scripts/run-ablation.mjs --local --suite smoke --trials 3` produces an ablation report across all 8 manifest sections in under 1s. All verdicts are `REVIEW` (expected: local heuristic doesn't depend on rendered artifacts).

### B.3 — Dennett word-count numeric anchor

1. Added voice line to `expert-visionary-dennett.json`: "Keep each draft body to <=120 words..."
2. Added a third `behavioralGuardrails` entry covering draft bloat.
3. Implemented `assertDennettDraftLength(response, maxWords=150)` with 4 unit tests. Soft cap 150 (120 target + 30 tolerance).
4. Tagged R4, V1, RB3, PN4 with `behavioralAssertions: ["dennettDraftLength"]`.
5. **115/115 unit tests pass** (4 new).

## Completed (B.4)

### B.4 — real-LLM ablation on 3 sections via clr (crush, smoke suite)

Implemented `--via-clr` and `--sections` flags in `scripts/run-ablation.mjs`. Under `--via-clr`, rendered artifacts are installed to `.cursor/rules/` between conditions so the LLM actually reads the ablated prompt, then the control state is restored on exit (normal, SIGINT, SIGTERM).

Ran 4 smoke cases (R1, R2, Q1, P1) × 3 trials × 2 conditions on crush for three sections:

| Section | chars saved | control mean | ablated mean | Δ | verdict |
| --- | --- | --- | --- | --- | --- |
| behavioral-guardrails | 78,277 | 1.58 | 1.17 | -0.41 | KEEP |
| foundational-constraints | 6,950 | 1.75 | 1.25 | -0.50 | KEEP |
| uncertainty-rules | 2,609 | 1.25 | 1.00 | -0.25 | KEEP |

All three sections degrade routing accuracy when removed → all **KEEP**. Reports:

- `.logs/ablation-report-2026-04-17T22-05-31-232Z.json` (behavioral-guardrails)
- `.logs/ablation-report-2026-04-17T22-22-49-730Z.json` (foundational-constraints + uncertainty-rules)

**Secondary observations on crush real-LLM variance (smoke suite × 12 trials):**

- behavioral-guardrails / foundational-constraints **control** runs both scored 12/12 on correct expert selection.
- uncertainty-rules **control** scored 7/12 (one JSON-parse failure, three off-target routes) -- identical baseline, just LLM sampling noise.
- Takeaway: single-trial smoke is too noisy to rank sections beyond a KEEP/REMOVE binary; broad ranking needs the full suite or more trials.

## Pending (paused per user)

- C-VS-a Verbalized Sampling A/B on Descartes-attractor cases
- C-VS-b Variable Substitution `{{var}}` templating + A/B
- D.1 write `PHASE-7-IMPLEMENTATION-REPORT.md`

## Key files touched

- `/home/barrett/code/AgentHistoric/scripts/lib/clr-runner.mjs`
- `/home/barrett/code/AgentHistoric/scripts/run-via-clr.mjs`
- `/home/barrett/code/AgentHistoric/scripts/run-ablation.mjs` (B.1 `--local`, B.4 `--via-clr`/`--sections`, artifact install/restore)
- `/home/barrett/code/AgentHistoric/scripts/lib/regression.mjs` (parseArgs flags, `buildLocalResponse`, `assertDennettDraftLength`)
- `/home/barrett/code/AgentHistoric/scripts/clr-wrappers/agent-print.sh`
- `/home/barrett/code/AgentHistoric/scripts/clr-wrappers/crush-print.sh`
- `/home/barrett/code/cli-runner-learner/profiles/agent-print.json`
- `/home/barrett/code/cli-runner-learner/profiles/crush-print.json`
- `/home/barrett/code/cli-runner-learner/profiles/claude-print.json`
- `/home/barrett/code/cli-runner-learner/src/runner/session.ts` (PTY cols)
- `/home/barrett/code/cli-runner-learner/src/runner/driver.ts` (poll cap)
- `/home/barrett/code/cli-runner-learner/src/orchestration/orchestrator.ts` (ready filter)
