# Phase 4: System Prompt Architecture — Implementation Report

**Date:** 2026-03-31
**Status:** Complete
**Depends on:** Phase 2 (Behavioral Guardrails) + Phase 3 (Test Infrastructure)

---

## Summary

The prompt system now has an explicit 3-layer constraint hierarchy, model-version markers for model-sensitive sections, and numeric anchors in 6 of 11 experts. Four new smoke tests validate the hierarchy, constraint consistency, and marker hygiene. Test count increased from 32 to 36.

---

## What Was Done

### 1. Constraint Hierarchy (`system.json`)

Added a new `constraintHierarchy` top-level field to `system.json`:

| Layer | Source | Scope | Overridable |
|-------|--------|-------|:-----------:|
| Global Runtime | `system.json → globalRuntime` | All experts, all contexts | No |
| Router | `router.json` | Routing decisions and pipeline sequencing | No |
| Expert Persona | `experts/*.json` | Active expert only | By globalRuntime and router only |

**Invariant:** "No expert prompt may contain instructions that contradict globalRuntime rules. If a conflict exists, globalRuntime wins."

This addresses gap items **A1** (explicit priority hierarchy) and **A4** (behavioral stack with restriction-only rule).

### 2. Rendered Constraint Hierarchy

All three renderers now emit the constraint hierarchy in the init prompt:

| Renderer | Format |
|----------|--------|
| `render-rich.mjs` | Full layer list with sources, scopes, and invariant statement |
| `render-codex.mjs` | Same, placed before Execution Protocol in AGENTS.md |
| `render-sparse.mjs` | Abbreviated: description + invariant only |

The rendered section adds approximately 80 tokens to each init prompt.

### 3. Model-Version Markers (`_modelTuning`)

Added `_modelTuning` fields to 2 expert JSONs:

**Peirce:**
- `voice[2]`: "Numeric anchor (<=30 words) calibrated for Claude 4.x / GPT-5.x."
- `behavioralGuardrails`: "Anti-gold-plating rules tuned for models that over-engineer."

**Popper:**
- `behavioralGuardrails[3]`: "Rationalization rejection list calibrated for Claude 4.x / GPT-5.x."
- `voice`: "Clinical tone works well with current models. Monitor for over-hedging."

These are documentation-only fields — the renderers skip any field starting with `_`. A smoke test verifies no `_modelTuning` content appears in generated output.

### 4. Numeric Anchors Propagated

| Expert | Numeric Anchor Added | Total with Anchors |
|--------|---------------------|:-----------------:|
| Peirce | "<=30 words" (Phase 2) | 1 → 1 |
| Descartes | "<=5 items in Assumptions, each one sentence" | 2 |
| Popper | "Hypothesis = 1 sentence, Reproduction <=10 lines" | 3 |
| Dennett | "Exactly 3 drafts unless user specifies otherwise" | 4 |
| Rogers | "Felt Experience <=3 sentences from user's perspective" | 5 |
| Blackmore | "Solution Pattern <=100 words" | 6 |

Six of 11 experts now have numeric anchors. The remaining 5 (Liskov, Dijkstra, Shannon, Knuth, Simon) have output formats that are already numerically constrained by their section structure.

### 5. New Smoke Tests

| # | Test | What It Validates |
|---|------|------------------|
| 12 | `system.json defines a constraintHierarchy with 3 layers` | Structural presence of hierarchy |
| 13 | `init prompts render the constraint hierarchy` | Hierarchy appears in generated init files |
| 14 | `no expert contradicts globalRuntime encoding rules` | Emoji ban consistency (Rogers exempt) |
| 15 | `_modelTuning fields are not rendered into generated output` | Marker hygiene across all artifacts |

---

## Validation Criteria Results

| Criterion | Result |
|-----------|--------|
| `system.json` has a `constraintHierarchy` field with 3 layers | **PASS** |
| Init prompt renders the constraint hierarchy statement | **PASS** — all 3 rich init files + codex AGENTS.md + sparse inits |
| At least 2 expert JSONs have `_modelTuning` markers | **PASS** — Peirce and Popper |
| At least 5 experts have numeric anchors | **PASS** — 6 experts |
| Smoke test for constraint consistency passes | **PASS** — emoji ban validated |
| `npm run test:unit` passes | **PASS** — 36/36 tests |
| `npm run build:prompts` produces clean output | **PASS** |

---

## Gap Analysis Items Addressed

| ID | Item | Status Before | Status After |
|----|------|:------------:|:------------:|
| A1 | Explicit constraint hierarchy between layers | PARTIAL | **DONE** |
| A4 | Formal behavioral stack with restriction-only rule | PARTIAL | **DONE** |
| A5 | Model-version markers | MISSING | **DONE** (Peirce, Popper) |
| A6 | Numeric length anchors | DONE (Peirce only) | **DONE** (6 experts) |

---

## Files Changed

| File | Change |
|------|--------|
| `prompt-system/system.json` | Added `constraintHierarchy` field |
| `prompt-system/experts/expert-engineer-peirce.json` | Added `_modelTuning` |
| `prompt-system/experts/expert-qa-popper.json` | Added `_modelTuning` + numeric voice anchor |
| `prompt-system/experts/expert-architect-descartes.json` | Numeric voice anchor |
| `prompt-system/experts/expert-visionary-dennett.json` | Numeric voice anchor |
| `prompt-system/experts/expert-ux-rogers.json` | Numeric voice anchor |
| `prompt-system/experts/expert-manager-blackmore.json` | Numeric voice anchor |
| `scripts/lib/render-rich.mjs` | Constraint hierarchy rendering in `renderRichInit()` |
| `scripts/lib/render-codex.mjs` | Constraint hierarchy rendering in `renderAgents()` |
| `scripts/lib/render-sparse.mjs` | Constraint hierarchy rendering in `renderSparseInit()` |
| `scripts/lib/prompt-smoke.test.mjs` | 4 new tests |
| All `dot-*` generated artifacts | Rebuilt |

---

## Test Count Progression

| Phase | Cumulative Tests |
|-------|:----------------:|
| Pre-Phase 3 | 11 |
| Phase 3 | 32 |
| Phase 4 | **36** |

---

*Implementation complete. All validation criteria met.*
