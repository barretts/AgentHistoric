# Phase 7 Handoff — Where We Are / Where Next

Companion to `docs/phase-7-progress-notes.md` (history log) and the two roadmap docs (`docs/agent-historic-routing-fixes-and-clr-integration-972743.md`, `docs/agenthistoric-clr-integration-972743.md`). This file is the forward-looking resume guide for the next session.

Last updated: 2026-04-17, after B.4 completed.

---

## Snapshot

| Phase | Status | Notes |
| --- | --- | --- |
| P.1 – P.5 | ✅ done | Infrastructure + profile smoke; 4/4 clr smoke green on both cursor and crush. |
| A.6 | ✅ done | 8-case real-LLM spot-check; **cursor 0/8 due to prefix hallucination**, crush 5/8. |
| B.1 | ✅ done | `--local` flag in `run-ablation.mjs`. |
| B.2 | ✅ done | Local multi-trial smoke baseline (all 8 sections, REVIEW by design). |
| B.3 | ✅ done | Dennett `<=120` word-count numeric anchor + `assertDennettDraftLength` + 4 cases tagged. 115/115 unit tests. |
| B.4 | ✅ done | 3-section real-LLM ablation on crush, all **KEEP** (see results below). |
| **C-VS-a** | ⬜ next | Verbalized Sampling A/B on 4 Descartes-attractor cases. |
| **C-VS-b** | ⬜ after | Variable Substitution `{{var}}` prototype + A/B. |
| **D.1** | ⬜ last | `PHASE-7-IMPLEMENTATION-REPORT.md`. |

Unit tests: `npm run test:unit` → **115/115** (last run 2026-04-17).

Disk state: `.cursor/rules/` mirrors `compiled/cursor/rules/` (control baseline restored after B.4).

---

## B.4 results (crush, smoke × 3 trials × 2 conditions = 24 calls/section)

| Section | chars saved | control mean | ablated mean | Δ | verdict |
| --- | --- | --- | --- | --- | --- |
| behavioral-guardrails | 78,277 | 1.58 | 1.17 | -0.41 | **KEEP** |
| foundational-constraints | 6,950 | 1.75 | 1.25 | -0.50 | **KEEP** |
| uncertainty-rules | 2,609 | 1.25 | 1.00 | -0.25 | **KEEP** |

Reports:
- `@/home/barrett/code/AgentHistoric/.logs/ablation-report-2026-04-17T22-05-31-232Z.json` (behavioral-guardrails)
- `@/home/barrett/code/AgentHistoric/.logs/ablation-report-2026-04-17T22-22-49-730Z.json` (foundational-constraints + uncertainty-rules)

All three removals degrade routing accuracy → all KEEP. Noise observation: `uncertainty-rules` control scored 7/12 while the other sections' controls scored 12/12 under the same baseline. Real-LLM variance on a 4-case smoke is large; full-suite runs or more trials needed for ranking beyond binary KEEP/REMOVE.

---

## Next: C-VS-a — Verbalized Sampling A/B

**Goal.** Attack the Descartes over-routing attractor. Have the router emit a ranked confidence distribution when two or more heuristics score close, then pick the top. Target: 3/4 correct on VS-on vs. 0/4 on VS-off across the 4 attractor cases.

**Attractor cases (from roadmap).** `TP5`, `SP-Li1`, `SP-Si1`, `SP-Si2`. Verify these exist in `@/home/barrett/code/AgentHistoric/regression/fixtures/cases.json` before running; A.6 showed `TP5` and the SP-* family are current.

**Implementation plan.**

1. **Schema.** Add `confidenceDistribution` (array of `{ expert, probability }`, length ≥ 2, sums to 1.0 within tolerance) to the response envelope handled in `@/home/barrett/code/AgentHistoric/scripts/lib/regression.mjs` near `scoreCase`. Make it optional so non-VS responses still validate.
2. **Router contract.** Add an `experimentFlags.verbalizedSampling` key to `@/home/barrett/code/AgentHistoric/prompt-system/router.json`. When `true`, renderers should emit a contract rule: "When two heuristics are within 0.2 of each other, return `confidenceDistribution` with at least 3 ranked candidates; the top candidate becomes `selectedExpert`."
3. **Renderer.** Propagate the flag through `@/home/barrett/code/AgentHistoric/scripts/lib/render-rich.mjs` and `render-codex.mjs`. The rendered section appears in both rich and codex outputs to preserve the Renderer Protocol's cross-target equivalence.
4. **Prompt wrapper.** In `buildWrappedPrompt` (`@/home/barrett/code/AgentHistoric/scripts/lib/regression.mjs:115`), append VS-on instructions when a `--verbalized-sampling` flag is present. Keep the core keys list intact.
5. **A/B runner.** Either extend `scripts/run-experiment.mjs` or add a `--verbalized-sampling` flag to `scripts/run-ablation.mjs` and treat the ablation as `control = VS-off`, `ablated = VS-on`. Prefer the latter — the install/restore plumbing is already there.
6. **Unit tests.** Mirror the `assertDennettDraftLength` pattern: add `assertVerbalizedSamplingSchema(response)` in `scripts/lib/regression.mjs` + tests in `regression.test.mjs`. Validate that `confidenceDistribution` is present, normalized, and the top candidate equals `selectedExpert`.
7. **Real-LLM A/B.** `node scripts/run-ablation.mjs --via-clr --suite smoke --trials 1 --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling` (or whatever shape you land on). ~24 API calls. Gate: ≥3/4 correct VS-on vs ≤1/4 VS-off.
8. **Decide ship.** If gate met, keep `experimentFlags.verbalizedSampling = true` as default. If not, leave flag off and document.

**Gotcha.** The A.6 cursor prefix-hallucination finding means VS on cursor is unlikely to help until the roster allowlist is added to the router. Run VS A/B on crush first. If the signal is clear, decide whether to address cursor-id stability as a separate mini-phase before widening coverage.

---

## After: C-VS-b — Variable Substitution `{{var}}` prototype

**Goal.** Per-project variable substitution in compiled artifacts (e.g., `{{project_name}}`, `{{primary_language}}`) to reduce token count without hurting accuracy.

**Implementation sketch.**

1. Add a `vs` block to `@/home/barrett/code/AgentHistoric/prompt-system/system.json` defining available variable names + defaults.
2. Gitignore-able `prompt-system/project-overrides.json` for per-project overrides. CI stays deterministic when the file is absent.
3. Extend `@/home/barrett/code/AgentHistoric/scripts/lib/build-prompt-system.mjs` to run a substitution pass after rendering but before writing. Throw on unresolved variables when `--strict-vs` is set.
4. Gate with a build flag — `node scripts/build-prompt-system.mjs --vs` — so the default build path is unchanged for the ablation A/B.
5. A/B: compare VS-enabled vs default artifacts on the `smoke` + `twopass` suites via `run-ablation.mjs`. Ship only if routing accuracy is equal-or-better **and** token savings are >10%.
6. Unit tests: new cases in `scripts/lib/build-prompt-system.test.mjs` (create if absent) verifying substitution happens at the right layer and missing variables raise when `--strict-vs`.

**Scope risk.** This is the largest remaining item. If time is tight, ship C-VS-a + D.1 and defer C-VS-b to a follow-up phase.

---

## Last: D.1 — Implementation report

**Deliverable.** One markdown file, 2–3 pages. Suggested path: `regression/reports/phase-7-implementation-report-<date>.md` (matches existing convention in roadmap doc line 174) or `docs/PHASE-7-IMPLEMENTATION-REPORT.md` (matches the progress notes' reference).

**Required content (from roadmap).**

- **Routing fixes (Phase A)** — misroutes addressed, before/after on real LLM, regression variant coverage.
- **clr integration (P.1–P.5)** — architecture, retry/healing benefits quantified, PTY/batching fixes, known limitations (concurrency=1, claude stdout fragility).
- **Ablation findings (Phase B)** — local-sim speedup, multi-trial variance data, Dennett concision result, B.4 KEEP verdicts, noise observation from uncertainty-rules control.
- **VS outcome (Phase C)** — ship/no-ship with data for each of VS-a and VS-b.
- **A.6 critical finding** — cursor `gpt-5.4-medium` prefix hallucination; recommend explicit roster allowlist in router.
- **Open follow-ups** — concurrency>1 in clr-runner, claude stdout-format fragility, any newly discovered misroutes.

---

## Commands cheat sheet

```bash
# 1. Unit tests
npm run test:unit                    # expect 115/115 (or +tests added in this phase)

# 2. Rebuild rendered artifacts (also restores disk to control)
npm run build:prompts

# 3. Local-sim ablation (seconds; scaffolding check only — deltas ≈ 0)
node scripts/run-ablation.mjs --local --suite smoke --trials 3

# 4. Real-LLM ablation via clr (slow — ~6–8 min per section per condition)
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 1 \
  --targets crush --sections <section-id>[,<section-id>]

# 5. Real-LLM spot-check on fixed IDs
node scripts/run-via-clr.mjs --suite smoke --targets crush

# 6. VS A/B (once C-VS-a is implemented; placeholder shape)
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 1 \
  --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
```

Note: `--trials` is clamped to `>=3` inside `run-ablation.mjs`. Passing `--trials 1` produces 3 trials.

---

## Key files touched this phase

Infrastructure:
- `@/home/barrett/code/AgentHistoric/scripts/lib/clr-runner.mjs` — CLR_ROOT env, sentinel fallback, verbose logging, batch fix.
- `@/home/barrett/code/AgentHistoric/scripts/run-via-clr.mjs` — crush target, verbose per-case/per-target summaries.
- `@/home/barrett/code/AgentHistoric/scripts/clr-wrappers/agent-print.sh` — `--trust` flag.
- `@/home/barrett/code/AgentHistoric/scripts/clr-wrappers/crush-print.sh` — `--quiet`, `NO_COLOR`, `TERM=dumb`, `GLAMOUR_STYLE=notty`.
- `@/home/barrett/code/cli-runner-learner/profiles/agent-print.json` — `idle_threshold_sec: 90`.
- `@/home/barrett/code/cli-runner-learner/profiles/crush-print.json` — `idle_threshold_sec: 90`.
- `@/home/barrett/code/cli-runner-learner/profiles/claude-print.json` — `idle_threshold_sec: 90`.
- `@/home/barrett/code/cli-runner-learner/src/runner/session.ts` — PTY cols 120 → 10000.
- `@/home/barrett/code/cli-runner-learner/src/runner/driver.ts` — poll cap `max(settle_timeout_ms + 5000, 30000)`.
- `@/home/barrett/code/cli-runner-learner/src/orchestration/orchestrator.ts` — ready-filter batch fix.

Ablation + assertions:
- `@/home/barrett/code/AgentHistoric/scripts/run-ablation.mjs` — `--local`, `--seed`, `--via-clr`, `--sections`, artifact install/restore with SIGINT/SIGTERM handlers.
- `@/home/barrett/code/AgentHistoric/scripts/lib/regression.mjs` — `parseArgs` flags, `buildLocalResponse`, `assertDennettDraftLength`.
- `@/home/barrett/code/AgentHistoric/scripts/lib/regression.test.mjs` — 4 new unit tests for the draft-length assertion.
- `@/home/barrett/code/AgentHistoric/prompt-system/experts/expert-visionary-dennett.json` — `<=120` word voice line + guardrail.
- `@/home/barrett/code/AgentHistoric/regression/fixtures/cases.json` — R4, V1, RB3, PN4 tagged with `behavioralAssertions: ["dennettDraftLength"]`.

Docs:
- `@/home/barrett/code/AgentHistoric/docs/phase-7-progress-notes.md` — running history.
- `@/home/barrett/code/AgentHistoric/docs/phase-7-handoff.md` — this file.

---

## Known gotchas / watch-outs

- **Cursor prefix hallucination (A.6).** `gpt-5.4-medium` identifies the right domain but invents expert-id prefixes (`expert-engineer-liskov`, `expert-architect-liskov`, etc.). Real roster is the 10 ids in `prompt-system/experts/`. Router needs an explicit allowlist + "echo verbatim" rule. Do this before any serious cursor-target ablation.
- **`--trials N` is floored to 3.** `run-ablation.mjs:28`: `Math.max(options.trials, 3)`. Passing `--trials 1` still produces 3 trials. If you want single-trial runs, remove the clamp or add a `--min-trials 1` escape hatch.
- **`--targets crush`/`claude` case filter.** `selectCases` matches cases whose `targets` list contains the requested target. Since fixtures only advertise `cursor`/`codex`, `run-ablation.mjs:35-38` rewrites `crush`/`claude` → `cursor` for selection under `--via-clr`. Mirrors `run-via-clr.mjs`. Preserve this remap when touching case-selection code.
- **Disk state during `--via-clr`.** `.cursor/rules/` is overwritten between conditions. Handlers on SIGINT/SIGTERM/normal exit restore control. If you kill the runner with SIGKILL, manually run `npm run build:prompts` or `node scripts/run-ablation.mjs --local --suite smoke --trials 3` (which re-installs control via the restore path) to recover.
- **clr concurrency pinned at 1.** `clr-runner.mjs` correlates transcripts by filename timestamp; two tasks starting in the same millisecond would collide. Revisit with per-task transcript paths if concurrency >1 becomes important.
- **Real-LLM variance is high on the 4-case smoke.** Same baseline control scored 12/12 twice and 7/12 once across three B.4 sections. Use the full suite or more trials (≥5) when deltas matter at the ±0.25 magnitude.
- **clr wall-clock.** One `(section × condition)` batch = 4 cases × 3 trials = ~5–7 min on crush. Budget ~25–30 min per 2-section run.
- **Sentinel duplication.** `decorateWrappedPromptForClr` and clr's `SentinelAdapter` both describe the same markers. Keep them in sync or pin to a shared constant if either ever changes.

---

## Quick-resume checklist for next session

1. `cd /home/barrett/code/AgentHistoric && npm run test:unit` — confirm 115/115.
2. `git status` — confirm clean or expected pending edits only.
3. `head -3 .cursor/rules/01-router.mdc` — should match `compiled/cursor/rules/01-router.mdc`. If not, run `npm run build:prompts`.
4. Start C-VS-a implementation with the schema + router contract changes (steps 1–2 above).
5. Validate with `--local` first, then do the real-LLM A/B on the 4 attractor cases.
