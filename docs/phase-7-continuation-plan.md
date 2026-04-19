# Phase 7 Continuation Plan

Companion to `docs/phase-7-handoff.md` (resume guide) and `docs/phase-7-progress-notes.md` (history log). This file is the forward-looking implementation plan for the next session.

Last updated: 2026-04-17

---

## Status Summary

| Phase | Status | Verdict | Notes |
|---|---|---|---|
| P.1 - P.5 (Infrastructure + clr) | done | 4/4 clr smoke green | cursor + crush both pass |
| A.6 (8-case real-LLM spot-check) | done | crush 5/8, cursor 0/8 | cursor: prefix hallucination |
| B.1 (`--local` ablation flag) | done | | |
| B.2 (Local multi-trial baseline) | done | | All 8 sections, REVIEW by design |
| B.3 (Dennett <=120 word anchor) | done | 115/115 unit tests | 4 new tests, tagged cases |
| B.4 (Real-LLM ablation, 3 sections) | done | All KEEP | See results table below |
| **C-VS-a** (Verbalized Sampling A/B) | next | | Attack Descartes attractor |
| **Cursor fix** | after C-VS-a | | Prefix hallucination allowlist |
| **C-VS-b** (Variable Substitution) | later | | Token reduction prototype |
| **D.1** (Implementation Report) | last | | 2-3 page ship document |

**Unit tests:** 115/115

---

## B.4 Results (crush, smoke x 3 trials x 2 conditions)

| Section | Chars Saved | Control Mean | Ablated Mean | Delta | Verdict |
|---|---|---|---|---|---|
| behavioral-guardrails | 78,277 | 1.58 | 1.17 | -0.41 | **KEEP** |
| foundational-constraints | 6,950 | 1.75 | 1.25 | -0.50 | **KEEP** |
| uncertainty-rules | 2,609 | 1.25 | 1.00 | -0.25 | **KEEP** |

**Noise observation:** uncertainty-rules control scored 7/12 while the other two scored 12/12 under identical baselines. Real-LLM variance on a 4-case smoke is large; full-suite runs or >=5 trials needed for ranking beyond binary KEEP/REMOVE.

---

## Recommended Sequencing

**Original handoff:** C-VS-a -> C-VS-b -> D.1

**Proposed modification:** C-VS-a -> cursor fix -> C-VS-b -> D.1

**Rationale for cursor fix insertion:** The A.6 finding showed cursor 0/8 due to prefix hallucination. C-VS-a's A/B test currently targets crush only. The cursor fix is small (add allowlist + echo rule to router.json), and resolving it before C-VS-b means both VS experiments can cover both targets. Without it, cursor remains unusable for any real-LLM ablation until addressed separately.

If time is tight, defer C-VS-b to a follow-up phase and ship C-VS-a + cursor fix + D.1.

---

## Critical Findings to Carry Forward

### Cursor Prefix Hallucination (A.6)

`gpt-5.4-medium` identifies the correct domain but fabricates expert-id prefixes that don't exist in the roster:

| Expected | Cursor Gave |
|---|---|
| `expert-engineer-peirce` | `expert-engineer-shannon` |
| `expert-abstractions-liskov` | `expert-engineer-liskov` |
| `expert-performance-knuth` | `expert-engineer-shannon` |
| `expert-orchestrator-simon` | `expert-engineer-descartes` |

**Fix:** Router must include an explicit allowlist of the 10 valid expert IDs and a "echo verbatim" instruction. Do this before any serious cursor-target ablation.

### Descartes Attractor Problem

crush misroutes complex multi-domain cases (MI3, TP5b, MI3b) to `expert-architect-descartes`. This is the known attractor problem from Phase 6. C-VS-a targets this directly.

---

## C-VS-a: Verbalized Sampling A/B

**Goal.** Attack the Descartes over-routing attractor. Emit a ranked confidence distribution when two+ heuristics score within 0.2 of each other; pick the top-ranked candidate. Target: >=3/4 correct VS-on vs <=1/4 VS-off across the 4 attractor cases.

**Attractor cases (from handoff).** `TP5`, `SP-Li1`, `SP-Si1`, `SP-Si2`. Verify these exist in `regression/fixtures/cases.json` before running. A.6 showed TP5 and the SP-* family are current; confirm before A/B.

### Implementation (6 steps)

1. **Router contract.** Add `experimentFlags.verbalizedSampling` key to `prompt-system/router.json`. When `true`, renderers emit a contract rule: "When two heuristics are within 0.2 of each other, return `confidenceDistribution` with at least 3 ranked candidates; the top candidate becomes `selectedExpert`."

2. **Response envelope.** Add `confidenceDistribution` field (array of `{ expert, probability }`, length >= 2, sums to 1.0 within tolerance) to the response schema in `scripts/lib/regression.mjs` near `scoreCase`. Make it optional so non-VS responses still validate.

3. **Renderer propagation.** Extend `scripts/lib/render-rich.mjs` and `scripts/lib/render-codex.mjs` to emit the VS contract rule when `experimentFlags.verbalizedSampling` is true. This preserves the Renderer Protocol's cross-target equivalence.

4. **Prompt wrapper.** In `buildWrappedPrompt` (`scripts/lib/regression.mjs:115`), append VS-on instructions when `--verbalized-sampling` is present. Keep the core keys list intact.

5. **A/B runner.** Add `--verbalized-sampling` flag to `scripts/run-ablation.mjs`. Treat ablation as `control = VS-off`, `ablated = VS-on`. Reuse the existing `--via-clr` install/restore plumbing.

6. **Unit tests.** Mirror the `assertDennettDraftLength` pattern: add `assertVerbalizedSamplingSchema(response)` in `scripts/lib/regression.mjs` + tests in `regression.test.mjs`. Validate that `confidenceDistribution` is present, normalized, and top candidate equals `selectedExpert`.

### A/B Command (crush first)

```bash
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
  --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
```

~24 API calls, ~25-30 min wall-clock. Note: `--trials` is clamped to >=3 inside `run-ablation.mjs`.

**Gate.** >=3/4 correct VS-on vs <=1/4 VS-off. If gate met, set `experimentFlags.verbalizedSampling = true` as default. If not, leave flag off and document findings.

---

## Cursor Prefix Hallucination Fix

**Goal.** Prevent cursor (gpt-5.4-medium) from hallucinating expert-id prefixes.

### Implementation (2 steps)

1. **Allowlist.** Add explicit roster allowlist to `prompt-system/router.json` with the 10 valid expert IDs:
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

**Expected impact.** Cursor routing accuracy should jump from 0/8 toward crush's 5/8 baseline. After this fix, future cursor ablation becomes viable.

**Verification.** Re-run A.6 8-case spot-check on cursor after `npm run build:prompts` to confirm fix.

---

## C-VS-b: Variable Substitution `{{var}}` Prototype

**Goal.** Per-project variable substitution in compiled artifacts (e.g., `{{project_name}}`, `{{primary_language}}`) to reduce token count without degrading accuracy.

### Implementation (6 steps)

1. **Schema.** Add `vs` block to `prompt-system/system.json` defining variable names + defaults.

2. **Override file.** Create gitignore-able `prompt-system/project-overrides.json` for per-project overrides. CI stays deterministic when absent.

3. **Build pass.** Extend `scripts/lib/build-prompt-system.mjs` to run a substitution pass after rendering but before writing. Throw on unresolved variables when `--strict-vs` is set.

4. **Gate.** `node scripts/build-prompt-system.mjs --vs`. Default build path is unchanged for ablation A/B.

5. **A/B.** Compare VS-enabled vs default artifacts on `smoke` + `twopass` suites via `run-ablation.mjs`.

6. **Unit tests.** Cases in `scripts/lib/build-prompt-system.test.mjs` verifying substitution happens at the right layer and missing variables raise with `--strict-vs`.

**Gate.** Accuracy equal-or-better AND token savings >10%.

**Scope risk.** Largest remaining item. If time is tight, ship C-VS-a + cursor fix + D.1 and defer C-VS-b to a follow-up phase.

---

## D.1: Implementation Report

**Path.** `docs/PHASE-7-IMPLEMENTATION-REPORT.md`

**Length.** 2-3 pages

### Required Sections

- **Routing fixes (Phase A)** - misroutes addressed, before/after on real LLM, regression variant coverage
- **clr integration (P.1-P.5)** - architecture, retry/healing benefits quantified, PTY/batching fixes, known limitations (concurrency=1, claude stdout fragility)
- **Ablation findings (Phase B)** - local-sim speedup, multi-trial variance data, Dennett concision result, B.4 KEEP verdicts, noise observation from uncertainty-rules control
- **VS outcome (Phase C)** - ship/no-ship with data for each of VS-a and VS-b
- **A.6 critical finding** - cursor `gpt-5.4-medium` prefix hallucination; recommend explicit roster allowlist in router
- **Open follow-ups** - concurrency>1 in clr-runner, claude stdout-format fragility, any newly discovered misroutes

---

## Quick-Resume Checklist

```bash
# 1. Confirm baseline
npm run test:unit                    # expect 115/115 (or +tests added this phase)
git status                           # confirm clean or expected pending edits only
npm run build:prompts                # verify disk state matches compiled

# 2. C-VS-a implementation
#    - router.json: add experimentFlags.verbalizedSampling + VS contract rule
#    - regression.mjs: add confidenceDistribution field + assertVerbalizedSamplingSchema
#    - render-rich.mjs / render-codex.mjs: flag propagation
#    - run-ablation.mjs: add --verbalized-sampling flag

# 3. C-VS-a unit tests
#    - regression.test.mjs: VS schema assertion cases

# 4. C-VS-a real-LLM A/B (crush first)
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
  --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling

# 5. Cursor prefix hallucination fix
#    - router.json: add explicit roster allowlist + echo verbatim rule
#    - npm run build:prompts
#    - re-run A.6 8-case spot-check on cursor to verify

# 6. C-VS-b (if time permits)
#    - system.json: add vs block
#    - project-overrides.json: scaffold (gitignore)
#    - build-prompt-system.mjs: substitution pass + --strict-vs
#    - npm run test:unit

# 7. D.1 implementation report
#    - docs/PHASE-7-IMPLEMENTATION-REPORT.md
```

---

## Commands Reference

```bash
# Unit tests
npm run test:unit

# Rebuild rendered artifacts (restores control state)
npm run build:prompts

# Local-sim ablation (sub-second, scaffolding check)
node scripts/run-ablation.mjs --local --suite smoke --trials 3

# Real-LLM ablation via clr (~6-8 min per section per condition)
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
  --targets crush --sections <section-id>[,<section-id>]

# VS A/B (once C-VS-a is implemented)
node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
  --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
```

---

## Known Gotchas

- **`--trials N` floored to 3.** `run-ablation.mjs:28`: `Math.max(options.trials, 3)`. Single-trial runs require removing the clamp or adding a `--min-trials` escape hatch.
- **`--targets crush` case filter.** `selectCases` rewrites `crush`/`claude` to `cursor` for fixture selection under `--via-clr`. Preserve this remap when touching case-selection code.
- **Disk state during `--via-clr`.** `.cursor/rules/` is overwritten between conditions. SIGINT/SIGTERM handlers restore control. SIGKILL requires manual `npm run build:prompts` to recover.
- **clr concurrency pinned at 1.** `clr-runner.mjs` correlates transcripts by filename timestamp; concurrent tasks would collide. Revisit with per-task transcript paths if concurrency >1 becomes important.
- **Sentinel duplication.** `decorateWrappedPromptForClr` and clr's `SentinelAdapter` both describe the same markers. Keep in sync or pin to shared constant.
- **clr wall-clock budget.** One (section x condition) batch = 4 cases x 3 trials approx 5-7 min on crush. Budget 25-30 min per 2-condition run.
- **Real-LLM variance is high on 4-case smoke.** Full-suite runs or >=5 trials needed for ranking beyond binary KEEP/REMOVE.