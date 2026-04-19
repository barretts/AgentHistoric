# Phase 7 Continuation Plan

Companion to `docs/phase-7-handoff.md` (resume guide) and `docs/phase-7-progress-notes.md` (history log). This file is the forward-looking implementation plan for the next session.

Last updated: 2026-04-17

---

## Where we left off

| Item | Status | Notes |
|------|--------|-------|
| P.1–P.5 | ✅ done | Infrastructure + profile smoke; 4/4 on both cursor and crush |
| A.6 | ✅ done | 8-case spot-check; **cursor 0/8 due to prefix hallucination**, crush 5/8 |
| B.1 | ✅ done | `--local` flag in `run-ablation.mjs` |
| B.2 | ✅ done | Local multi-trial smoke baseline (all 8 sections) |
| B.3 | ✅ done | Dennett `<=120` word-count anchor + `assertDennettDraftLength` + 4 cases tagged; 115/115 unit tests |
| B.4 | ✅ done | Real-LLM ablation on crush, 3 KEEP verdicts |
| **C-VS-a** | ⬜ next | Verbalized Sampling A/B on 4 attractor cases |
| **Cursor fix** | ⬜ after | Prefix hallucination allowlist (unblock cursor for future ablation) |
| **C-VS-b** | ⬜ later | Variable Substitution `{{var}}` prototype |
| **D.1** | ⬜ last | `PHASE-7-IMPLEMENTATION-REPORT.md` |

**Unit tests:** 115/115  
**Real-LLM variance observation:** ±5/12 noise on 4-case smoke; full suite or ≥5 trials needed for ranking beyond KEEP/REMOVE binary

---

## Recommended sequencing

Original handoff: C-VS-a → C-VS-b → D.1  
Proposed modification: **C-VS-a → cursor fix → C-VS-b → D.1**

**Rationale for cursor fix insertion:** The A.6 finding showed cursor 0/8 due to prefix hallucination. C-VS-a's A/B test currently targets crush only (per handoff rationale: "VS on cursor is unlikely to help until the roster allowlist is added"). The cursor fix is small (add allowlist + echo rule to router.json), and resolving it before C-VS-b means both VS experiments can cover both targets. Without it, cursor remains unusable for any real-LLM ablation until addressed separately.

If time is tight, defer C-VS-b to a follow-up phase and ship C-VS-a + cursor fix + D.1.

---

## C-VS-a: Verbalized Sampling A/B

**Goal.** Attack the Descartes over-routing attractor. Emit a ranked confidence distribution when two+ heuristics score within 0.2 of each other; pick the top-ranked candidate. Target: ≥3/4 correct VS-on vs ≤1/4 VS-off across the 4 attractor cases.

**Attractor cases (from handoff).** `TP5`, `SP-Li1`, `SP-Si1`, `SP-Si2`. Verify these exist in `regression/fixtures/cases.json` before running. A.6 showed TP5 and the SP-* family are current; confirm before A/B.

**Implementation (6 steps).**

1. **Router contract.** Add `experimentFlags.verbalizedSampling` key to `prompt-system/router.json`. When `true`, renderers emit a contract rule: "When two heuristics are within 0.2 of each other, return `confidenceDistribution` with at least 3 ranked candidates; the top candidate becomes `selectedExpert`."

2. **Response envelope.** Add `confidenceDistribution` field (array of `{ expert, probability }`, length ≥ 2, sums to 1.0 within tolerance) to the response schema in `scripts/lib/regression.mjs` near `scoreCase`. Make it optional so non-VS responses still validate.

3. **Renderer propagation.** Extend `scripts/lib/render-rich.mjs` and `scripts/lib/render-codex.mjs` to emit the VS contract rule when `experimentFlags.verbalizedSampling` is true. This preserves the Renderer Protocol's cross-target equivalence.

4. **Prompt wrapper.** In `buildWrappedPrompt` (`scripts/lib/regression.mjs:115`), append VS-on instructions when `--verbalized-sampling` is present. Keep the core keys list intact.

5. **A/B runner.** Add `--verbalized-sampling` flag to `scripts/run-ablation.mjs`. Treat ablation as `control = VS-off`, `ablated = VS-on`. Reuse the existing `--via-clr` install/restore plumbing — no need to build separate runner.

6. **Unit tests.** Mirror the `assertDennettDraftLength` pattern: add `assertVerbalizedSamplingSchema(response)` in `scripts/lib/regression.mjs` + tests in `regression.test.mjs`. Validate that `confidenceDistribution` is present, normalized, and top candidate equals `selectedExpert`.

**A/B command (crush first, ~25–30 min wall-clock):**
```bash
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
  --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
```
Note: `--trials` is floored to 3 inside `run-ablation.mjs`. The above produces 3 trials per condition.

**Gate.** ≥3/4 correct VS-on vs ≤1/4 VS-off. If gate met, set `experimentFlags.verbalizedSampling = true` as default. If not, leave flag off and document findings.

---

## Cursor Prefix Hallucination Fix

**Goal.** Prevent cursor (gpt-5.4-medium) from hallucinating expert-id prefixes. A.6 showed 0/8 correct on cursor vs 5/8 on crush — the model identifies the correct domain but invents malformed ids (`expert-engineer-shannon`, `expert-architect-liskov`, etc.).

**Implementation (2 steps).**

1. **Allowlist.** Add explicit roster allowlist to `prompt-system/router.json` — the 10 valid expert ids:
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

2. **Contract rule.** Add: "Echo the selected expert-id verbatim from the allowlist above. Do not modify, combine, or invent ids."

**Expected impact.** Cursor routing accuracy should jump from 0/8 toward crush's 5/8 baseline on the same cases. After this fix, future cursor-target ablation becomes viable.

---

## C-VS-b: Variable Substitution `{{var}}` prototype

**Goal.** Per-project variable substitution in compiled artifacts (e.g., `{{project_name}}`, `{{primary_language}}`) to reduce token count without degrading accuracy.

**Implementation (5 steps).**

1. **Schema.** Add `vs` block to `prompt-system/system.json` defining variable names + defaults.

2. **Override file.** Create gitignore-able `prompt-system/project-overrides.json` for per-project overrides. CI stays deterministic when absent.

3. **Build pass.** Extend `scripts/lib/build-prompt-system.mjs` to run a substitution pass after rendering but before writing. Throw on unresolved variables when `--strict-vs` is set.

4. **Gate.** `node scripts/build-prompt-system.mjs --vs`. Default build path is unchanged for ablation A/B.

5. **A/B.** Compare VS-enabled vs default artifacts on `smoke` + `twopass` suites via `run-ablation.mjs`.

**Gate.** Accuracy equal-or-better AND token savings >10%.

**Scope risk.** Largest remaining item. If time is tight, ship C-VS-a + cursor fix + D.1 and defer C-VS-b to a follow-up phase.

**Unit tests.** New cases in `scripts/lib/build-prompt-system.test.mjs` (create if absent) verifying substitution happens at the right layer and missing variables raise when `--strict-vs`.

---

## D.1: Implementation Report

**Path.** `docs/PHASE-7-IMPLEMENTATION-REPORT.md`

**Required content:**

- **Routing fixes (Phase A)** — misroutes addressed, before/after on real LLM, regression variant coverage
- **clr integration (P.1–P.5)** — architecture, retry/healing benefits quantified, PTY/batching fixes, known limitations (concurrency=1, claude stdout fragility)
- **Ablation findings (Phase B)** — local-sim speedup, multi-trial variance data, Dennett concision result, B.4 KEEP verdicts, noise observation from uncertainty-rules control
- **VS outcome (Phase C)** — ship/no-ship with data for each of VS-a and VS-b
- **A.6 critical finding** — cursor `gpt-5.4-medium` prefix hallucination; recommend explicit roster allowlist in router
- **Open follow-ups** — concurrency>1 in clr-runner, claude stdout-format fragility, any newly discovered misroutes

**Length:** 2–3 pages  
**Path convention:** matches progress notes' reference (`docs/PHASE-7-IMPLEMENTATION-REPORT.md`) and roadmap doc line 174

---

## Quick-resume checklist

```bash
# 1. Confirm baseline
npm run test:unit                    # expect 115/115 (or +tests added this phase)
git status                           # confirm clean or expected pending edits only
head -3 .cursor/rules/01-router.mdc  # should match compiled/cursor/rules/01-router.mdc

# 2. C-VS-a implementation
#    - router.json: add experimentFlags.verbalizedSampling + VS contract rule
#    - regression.mjs: add confidenceDistribution field + assertVerbalizedSamplingSchema
#    - run-ablation.mjs: add --verbalized-sampling flag
#    - render-rich.mjs / render-codex.mjs: propagate flag

# 3. C-VS-a unit tests
#    - regression.test.mjs: assertVerbalizedSamplingSchema cases

# 4. C-VS-a real-LLM A/B (crush first)
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
  --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling

# 5. Cursor prefix hallucination fix
#    - router.json: add explicit roster allowlist + echo verbatim rule
#    - npm run build:prompts
#    - re-run A.6 8-case spot-check on cursor to verify

# 6. C-VS-b (if time permits)
#    - system.json: add vs block
#    - project-overrides.json: scaffold
#    - build-prompt-system.mjs: substitution pass + --strict-vs

# 7. D.1 implementation report
#    - docs/PHASE-7-IMPLEMENTATION-REPORT.md
```

---

## Key files for this phase

### C-VS-a
- `prompt-system/router.json` — `experimentFlags.verbalizedSampling` + VS contract rule
- `scripts/lib/regression.mjs` — `confidenceDistribution` field + `assertVerbalizedSamplingSchema`
- `scripts/run-ablation.mjs` — `--verbalized-sampling` flag
- `scripts/lib/render-rich.mjs` / `scripts/lib/render-codex.mjs` — flag propagation
- `scripts/lib/regression.test.mjs` — VS schema assertion tests

### Cursor fix
- `prompt-system/router.json` — explicit expert roster allowlist + echo verbatim rule

### C-VS-b
- `prompt-system/system.json` — `vs` block
- `prompt-system/project-overrides.json` — scaffold (gitignore)
- `scripts/lib/build-prompt-system.mjs` — substitution pass + `--strict-vs`
- `scripts/lib/build-prompt-system.test.mjs` — VS unit tests (create if absent)

### D.1
- `docs/PHASE-7-IMPLEMENTATION-REPORT.md`

---

## Known gotchas (from handoff)

- **`--trials N` is floored to 3** inside `run-ablation.mjs:28`. Passing `--trials 1` still produces 3 trials.
- **`--targets crush`/`claude` case filter remaps to `cursor`** under `--via-clr` (`run-ablation.mjs:35-38`). Preserve this when touching case-selection code.
- **Disk state during `--via-clr`.** `.cursor/rules/` is overwritten between conditions. Handlers restore control on exit. If killed with SIGKILL, manually run `npm run build:prompts` to recover.
- **clr concurrency pinned at 1.** Transcript correlation by filename timestamp; concurrency >1 would cause collisions.
- **Real-LLM variance is high on the 4-case smoke.** Use full suite or ≥5 trials when deltas matter at ±0.25 magnitude.
- **Sentinel duplication.** `decorateWrappedPromptForClr` and clr's `SentinelAdapter` both describe the same markers. Keep in sync or pin to shared constant if either changes.