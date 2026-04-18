# Phase 7 Continuation Plan

Synthesized from `minimax27-PHASE-7-CONTINUATION-PLAN.md` and `qwen36-phase-7-continuation-plan.md`. Created 2026-04-17.

---

## Status Summary

| Phase | Status | Verdict |
|---|---|---|
| P.1 – P.5 (Infrastructure + clr) | ✅ done | 4/4 clr smoke green on cursor + crush |
| A.6 (8-case real-LLM spot-check) | ✅ done | crush 5/8, cursor 0/8 (prefix hallucination) |
| B.1 (`--local` ablation flag) | ✅ done | |
| B.2 (Local multi-trial baseline) | ✅ done | All 8 sections, REVIEW by design |
| B.3 (Dennett <=120 word anchor) | ✅ done | 4 new tests, 115/115 total |
| B.4 (Real-LLM ablation, 3 sections) | ✅ done | All KEEP (see results below) |
| **C-VS-a** (Verbalized Sampling A/B) | ⬜ next | |
| **Cursor fix** (Prefix hallucination allowlist) | ⬜ after | |
| **C-VS-b** (Variable Substitution) | ⬜ later | |
| **D.1** (Implementation Report) | ⬜ last | |

---

## B.4 Results (crush, smoke × 3 trials × 2 conditions)

| Section | Chars Saved | Control Mean | Ablated Mean | Δ | Verdict |
|---|---|---|---|---|---|
| behavioral-guardrails | 78,277 | 1.58 | 1.17 | -0.41 | **KEEP** |
| foundational-constraints | 6,950 | 1.75 | 1.25 | -0.50 | **KEEP** |
| uncertainty-rules | 2,609 | 1.25 | 1.00 | -0.25 | **KEEP** |

**Noise observation:** uncertainty-rules control scored 7/12 while the other two scored 12/12 under identical baselines. Real-LLM variance on a 4-case smoke is large; full-suite runs or more trials (≥5) needed for ranking beyond binary KEEP/REMOVE.

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

### Descartes Attractor Problem

crush misroutes complex multi-domain cases (MI3, TP5b, MI3b) to `expert-architect-descartes`. This is the known attractor problem from Phase 6. C-VS-a targets this directly.

---

## Sequencing Rationale

**Original:** C-VS-a → C-VS-b → D.1  
**Proposed:** **C-VS-a → cursor fix → C-VS-b → D.1**

**Rationale:** The A.6 finding showed cursor 0/8 due to prefix hallucination. C-VS-a's A/B test targets crush only (per handoff rationale: "VS on cursor is unlikely to help until the roster allowlist is added"). The cursor fix is small (add allowlist + echo rule to router.json), and resolving it before C-VS-b means both VS experiments can cover both targets. Without it, cursor remains unusable for any real-LLM ablation until addressed separately.

If time is tight, defer C-VS-b to a follow-up phase and ship C-VS-a + cursor fix + D.1.

---

## Next: C-VS-a — Verbalized Sampling A/B

**Target:** Attack the Descartes over-routing attractor by having the router emit a ranked confidence distribution when two or more heuristics score close.

**Test cases (4 Descartes attractors):** `TP5`, `SP-Li1`, `SP-Si1`, `SP-Si2`

**Gate:** ≥3/4 correct with VS-on vs ≤1/4 correct with VS-off.

### Implementation Steps

1. **Schema extension** — Add `confidenceDistribution` (array of `{ expert, probability }`, length ≥ 2, sums to 1.0 within tolerance) to the response envelope in `scripts/lib/regression.mjs` near `scoreCase`. Optional so non-VS responses still validate.

2. **Router contract** — Add `experimentFlags.verbalizedSampling` to `prompt-system/router.json`. When `true`, renderers emit: "When two heuristics are within 0.2 of each other, return `confidenceDistribution` with at least 3 ranked candidates; the top candidate becomes `selectedExpert`."

3. **Renderer propagation** — Extend `render-rich.mjs` and `render-codex.mjs` to propagate the flag. Cross-target equivalence must be preserved (Renderer Protocol).

4. **Prompt wrapper** — In `buildWrappedPrompt` (`regression.mjs:115`), append VS-on instructions when `--verbalized-sampling` flag is present. Keep core keys list intact.

5. **A/B runner** — Extend `run-ablation.mjs` with `--verbalized-sampling` flag. Control = VS-off, Ablated = VS-on. Existing install/restore plumbing handles artifact swapping.

6. **Unit tests** — Add `assertVerbalizedSamplingSchema(response)` mirroring `assertDennettDraftLength` pattern. Validate `confidenceDistribution` is present, normalized, and top candidate equals `selectedExpert`.

7. **Real-LLM A/B** — Run on crush first (cursor is broken due to prefix hallucination):
   ```bash
   node scripts/run-ablation.mjs --via-clr --suite smoke --trials 3 \
     --targets crush --cases TP5,SP-Li1,SP-Si1,SP-Si2 --verbalized-sampling
   ```
   ~24 API calls, ~25-30 min wall-clock.

8. **Ship decision** — If gate met, set `experimentFlags.verbalizedSampling = true` as default. If not, leave off and document.

**Run crush first.** The A.6 cursor finding means VS on cursor won't help until the roster allowlist fix is in place.

---

## After: Cursor Prefix Hallucination Fix

**Goal.** Prevent cursor (gpt-5.4-medium) from hallucinating expert-id prefixes. A.6 showed 0/8 correct on cursor vs 5/8 on crush — the model identifies the correct domain but invents malformed ids.

### Implementation Steps

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

## After: C-VS-b — Variable Substitution `{{var}}` Prototype

**Target:** Per-project variable substitution in compiled artifacts to reduce token count without hurting accuracy.

**Scope risk:** This is the largest remaining item. If time is tight, ship C-VS-a + cursor fix + D.1 and defer C-VS-b.

### Implementation Steps

1. Add `vs` block to `prompt-system/system.json` defining available variable names + defaults.
2. Gitignore-able `prompt-system/project-overrides.json` for per-project overrides. CI stays deterministic when absent.
3. Extend `build-prompt-system.mjs` with a substitution pass after rendering, before writing. Throw on unresolved variables when `--strict-vs`.
4. Gate with build flag: `node scripts/build-prompt-system.mjs --vs` so default build path is unchanged.
5. A/B: compare VS-enabled vs default on `smoke` + `twopass` suites via `run-ablation.mjs`. Ship only if accuracy is equal-or-better **and** token savings >10%.
6. Unit tests in `build-prompt-system.test.mjs`: verify substitution happens at the right layer, missing variables raise with `--strict-vs`.

---

## Last: D.1 — Implementation Report

Single markdown file, 2-3 pages. Suggested path: `docs/PHASE-7-IMPLEMENTATION-REPORT.md`.

### Required Sections

- **Routing fixes (Phase A)** — misroutes addressed, before/after on real LLM, regression variant coverage
- **clr integration (P.1–P.5)** — architecture, retry/healing benefits quantified, PTY/batching fixes, known limitations
- **Ablation findings (Phase B)** — local-sim speedup, multi-trial variance, Dennett concision result, B.4 KEEP verdicts, noise observation
- **VS outcome (Phase C)** — ship/no-ship with data for VS-a and VS-b
- **A.6 critical finding** — cursor `gpt-5.4-medium` prefix hallucination; recommend explicit roster allowlist
- **Open follow-ups** — concurrency>1 in clr-runner, claude stdout-format fragility, newly discovered misroutes

---

## Quick-Resume Checklist

```bash
# 1. Confirm baseline
npm run test:unit                    # expect 115/115 (or higher with new tests)
git status                           # confirm clean or expected-pending edits only
npm run build:prompts                # verify disk state matches compiled

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

## Key Files for This Phase

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

Note: `--trials` is clamped to `>=3` inside `run-ablation.mjs:28`.

---

## Known Gotchas

- **`--trials N` floored to 3.** `run-ablation.mjs:28`: `Math.max(options.trials, 3)`. Single-trial runs require removing the clamp or adding a `--min-trials` escape hatch.
- **`--targets crush` case filter.** `selectCases` rewrites `crush`/`claude` → `cursor` for fixture selection under `--via-clr`. Preserve this remap when touching case-selection code.
- **Disk state during `--via-clr`.** `.cursor/rules/` is overwritten between conditions. SIGINT/SIGTERM handlers restore control. SIGKILL requires manual `npm run build:prompts` to recover.
- **clr concurrency pinned at 1.** `clr-runner.mjs` correlates transcripts by filename timestamp; concurrent tasks would collide. Revisit with per-task transcript paths if concurrency >1 becomes important.
- **Sentinel duplication.** `decorateWrappedPromptForClr` and clr's `SentinelAdapter` both describe the same markers. Keep in sync or pin to shared constant.
- **clr wall-clock budget.** One `(section × condition)` batch = 4 cases × 3 trials ≈ 5-7 min on crush. Budget 25-30 min per 2-section run.
