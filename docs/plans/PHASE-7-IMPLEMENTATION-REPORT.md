# Phase 7: Continuation — Implementation Report

**Date:** 2026-04-18
**Status:** Complete
**Depends on:** Phase 6 (Ablation Testing)

---

## Summary

Phase 7 continues stabilization of the MoE routing layer with routing fixes, clr integration, local ablations, and two Variable Substitution prototypes. Test count increased from 115 to 134.

---

## What Was Done

### 1. Routing Fixes (Phase A)

#### A.6 — 8-Case Real-LLM Spot-Check

Ran smoke suite on crush (gpt-4.5-turbo) and cursor (gpt-5.4-medium):

| Target | Score | Finding |
|--------|-------|---------|
| crush | 5/8 | Descartes attractor: complex multi-domain cases misroute to Descartes |
| cursor | 0/8 | Prefix hallucination: model invents malformed expert-ids |

**Critical finding:** `gpt-5.4-medium` identifies correct domain but fabricates expert-id prefixes that don't exist in the roster.

---

### 2. clr Integration (Phase P.1–P.5)

Integrated `cli-runner-learner` (clr) as a real-LLM runner with retry/healing via PTY/batching fixes. All 4 clr smoke tests green on cursor + crush.

---

### 3. Ablation Findings (Phase B)

#### B.1 — Local Ablation Flag

Added `--local` flag to `run-ablation.mjs` for synthetic routing without API calls. Enables faster iteration.

#### B.2 — Local Multi-Trial Baseline

All 8 sections passed with REVIEW verdict by design (local simulation captures structural changes, not behavioral ones).

#### B.3 — Dennett ≤120 Word Anchor

Added 4 new tests enforcing the ≤120 word cap on Dennett draft bodies. Total tests: 115 → 119.

#### B.4 — Real-LLM Ablation (3 Sections, crush × 3 trials)

| Section | Chars Saved | Δ | Verdict |
|---------|------------|-----|---------|
| `behavioral-guardrails` | 78,277 | -0.41 | **KEEP** |
| `foundational-constraints` | 6,950 | -0.50 | **KEEP** |
| `uncertainty-rules` | 2,609 | -0.25 | **KEEP** |

**Noise observation:** `uncertainty-rules` control scored 7/12 while others scored 12/12. Real-LLM variance on 4-case smoke is large; full-suite runs or ≥5 trials needed for ranking beyond binary KEEP/REMOVE.

---

### 4. Verbalized Sampling A/B (C-VS-a)

**Implementation:**
- `experimentFlags.verbalizedSampling` added to `router.json`
- `verbalizedSamplingContracts` block rendered when flag is true
- `confidenceDistribution` schema in `regression.mjs` with `assertVerbalizedSamplingSchema()`
- `--verbalized-sampling` flag in `run-ablation.mjs`
- 3-way distribution emission for `--local` ablations

**Real-LLM A/B (crush, 4 Descartes attractor cases × 3 trials):**

| Metric | Value |
|--------|-------|
| Chars overhead | -4,991 |
| pass^k delta | +0.00 |
| Over-engineering delta | +0.00 |
| Concision delta | +0.00 |
| Verdict | **REVIEW** |

**Interpretation:** VS adds token cost but shows no measurable behavioral improvement on these specific cases. May benefit from different test cases or higher trial count.

---

### 5. Variable Substitution Prototype (C-VS-b)

**Scope:** Per-project variable substitution at build time to reduce token count without hurting accuracy.

**Implementation:**
- `vs` block added to `prompt-system/system.json` defining 4 variables:
  - `EXPERT_ROSTER` — pipe-separated expert IDs
  - `EXPERT_ID_ALLOWLIST` — comma-separated for echo-friendly display
  - `CONSTRAINT_HIERARCHY_LAYERS` — readable layer summary
  - `VERIFICATION_WORKFLOW_STEPS` — standard workflow steps
- `prompt-system/project-overrides.json.example` stub for per-project overrides
- `--vs` and `--strict-vs` flags in build script
- `applyVariableSubstitution()` function in `build-prompt-system.mjs`

**A/B gate (planned):** Ship only if accuracy equal-or-better **and** token savings >10%.

---

### 6. Unit Test Expansion

| File | Before | After |
|------|--------|-------|
| `prompt-smoke.test.mjs` | 72 | 72 |
| `prompt-system.test.mjs` | 4 | 12 (+8 VS tests) |
| `regression.test.mjs` | 33 | 50 (+17 VS tests) |
| **Total** | **109** | **134** |

Documentation updated in README.md and AGENTS.md.

---

## Open Follow-Ups

1. **Cursor prefix hallucination** — recommend explicit roster allowlist in router.json for cursor target
2. **clr stdout-format fragility** — PTY wrapper may need hardening for edge cases
3. **VS token savings A/B** — run with `--vs` flag to measure actual savings
4. **Concision metric noise** — real-LLM variance requires ≥5 trials for ranking

---

## Files Changed

- `prompt-system/system.json` — added `vs` block
- `prompt-system/router.json` — added `experimentFlags.verbalizedSampling` + contracts
- `scripts/build-prompt-system.mjs` — added `--vs`, `--strict-vs` flags
- `scripts/lib/build-prompt-system.mjs` — added `applyVariableSubstitution()`
- `scripts/lib/regression.mjs` — added VS schema + assertions
- `scripts/lib/prompt-system.test.mjs` — added 8 VS tests
- `README.md` — updated test count
- `AGENTS.md` — updated test count
