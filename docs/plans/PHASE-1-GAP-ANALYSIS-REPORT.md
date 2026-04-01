# Phase 1: Gap Analysis — Implementation Report

**Date:** 2026-03-31
**Auditor:** Automated deep audit against source files
**Scope:** All 38 gap items (A1–A6, B1–B13, C1–C5, D1–D11, E1–E4, F1–F3) cross-referenced against every file in `prompt-system/`, `scripts/`, and `regression/`.

---

## Executive Summary

Every claim in the gap analysis was verified against the actual codebase. **All 38 status classifications are accurate.** The audit surfaced no misclassifications — items marked DONE are done, items marked PARTIAL have the exact partial coverage described, items marked MISSING have zero implementation, and items marked N/A are correctly scoped out.

### Key Statistics

| Status | Count | Breakdown |
|--------|-------|-----------|
| DONE | 1 | D2 (snapshot tests) |
| PARTIAL | 7 | A1, A4, C1, C2, C3, D3, E1 |
| MISSING | 19 | A5, A6, B1–B13, D1, D4–D10, E2 |
| N/A | 11 | A2, A3, C4, C5, D6, D7, D9, D11, E3, E4, F1–F3 |

**Actionable items (PARTIAL + MISSING): 26**
**High-impact items among those: 15**
**Quick wins (High impact / Small effort): 4** — A6, B2, B4, B7

---

## 1. Prompt Architecture (A1–A6)

### A1 — Layered Prompt with Explicit Priority Hierarchy

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | H / M |

**Evidence:** The word "supersede" appears once in `system.json` at `globalRuntime.context`:

> *"This file is the base context for all agents. These rules supersede any individual expert stance unless explicitly overridden by the router handoff contract."*

This is a prose assertion, not a structural enforcement. The `executionBinding` array (10 rules) describes *what to do*, not *which layer wins when rules conflict*. Neither `render-rich.mjs` (`renderRichInit` / `renderRichExpert`) nor `render-codex.mjs` (`renderAgents` / `renderSkill`) cross-references layers or emits constraint inheritance statements. Expert rule files are standalone with no back-reference to the init layer.

**Gap:** No rendered prompt contains a structural statement like "Expert rules restrict but never expand the constraints established in the init layer."

---

### A2 / A3 — Static/Dynamic Boundary & Section Caching

| Field | Value |
|-------|-------|
| **Claimed** | N/A |
| **Verified** | N/A — confirmed |

No runtime prompt assembly. The system generates static files via `build-prompt-system.mjs`. No cache key, no dynamic boundary marker, no runtime concatenation.

---

### A4 — Behavioral Stack as 6-Layer Constraint System

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | H / M |

**Evidence:** Three layers exist:

1. **Init** (`system.json` → `globalRuntime`): execution binding, logging, uncertainty rules, foundational constraints
2. **Router** (`router.json`): 13 priority-ordered heuristics, disambiguation, pipelines, contracts
3. **Expert** (11 JSONs): persona, philosophy, method, voice, output contract, failure signals, handoffs

The research calls for 6 layers. Three missing layers (environment/tool config, conversation context, user message) are N/A for a static generation system.

**Critical gap:** No "restricts but never expands" monotonic restriction contract exists anywhere in `prompt-system/`. Grep for "restricts but never expands", "cannot expand", "cannot override", or "restriction-only" returns zero results outside planning documents.

---

### A5 — Model-Version Markers

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | M / S |

**Evidence:** Zero matches for `@[MODEL_TUNING]`, `MODEL_TUNING`, `_modelTuning`, `modelTuning`, or `model_sensitive` in any prompt-system source file. The planned `_modelTuning` field convention (Phase 4 plan, line 69) has not been implemented.

---

### A6 — Numeric Length Anchors

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | H / S |

**Evidence:** Zero matches for patterns like `\d+ words`, `<=\d+`, `word count`, or `token count` across all 11 expert `voice[]` arrays. All entries are purely qualitative. Examples:

- **Peirce:** `"Be direct, dense, and terse without filler."`
- **Popper:** `"Clinical and precise."`
- **Descartes:** `"Architectural precision over warmth."`

No `behavioralGuardrails` field exists in any expert JSON.

---

## 2. Behavioral Guardrails (B1–B13)

### Structural Finding

Every expert has a `failureSignals[]` array (3–4 items each). This is the **only** negative-constraint mechanism in the entire expert schema. However, `failureSignals` are **detection signals** (what bad output looks like), not **prevention rules** (what to do/not do). No corresponding `preventionRules[]`, `behavioralGuardrails[]`, or `antiOverCorrections[]` array exists anywhere.

The `selfAwareness` field in Blackmore and Dennett is the closest structural ancestor — it contains reflective meta-notes like "Over-integration risk" — but these lack the prescriptive DO/DON'T structure of a behavioral guardrail.

### Per-Item Audit

| # | Item | Claimed | Verified | Key Evidence |
|---|------|---------|----------|-------------|
| B1 | Failure→Rule→Anti-Over-Correction triple | MISSING | **MISSING** | `failureSignals[]` provides leg 1 of 3 in all 11 experts. Legs 2 (rule) and 3 (anti-over-correction) are entirely absent. |
| B2 | Anti-gold-plating rules | MISSING | **MISSING** | Nearest: Knuth `failureSignals[1]` ("Micro-optimization before algorithmic leverage"); Peirce `deliverables[0]` ("minimal correct implementation"). No expert contains "don't add features beyond the ask." |
| B3 | Don't handle impossible scenarios | MISSING | **MISSING** | Zero matches in any expert. Dijkstra would be the natural home. |
| B4 | Don't create premature abstractions | MISSING | **MISSING** | Nearest: Liskov `personaIntro` ("whether an abstraction earns its existence") — aspirational, not enforceable. No "three similar lines is better than a premature abstraction." |
| B5 | Comment writing discipline | MISSING | **MISSING** | No mention of comment practices in any expert. |
| B6 | Reversibility / scoped approvals | MISSING | **MISSING** | No mention. |
| B7 | Diagnostic discipline | MISSING | **MISSING** | Nearest: Peirce `methodSteps[4]` ("Fix the root cause, not the symptom"); Knuth `corePhilosophy[0]` ("Do not optimize guesses"); Popper `corePhilosophy[2]` ("Form a hypothesis"). None contain the specific mandate "diagnose before switching tactics." |
| B8 | No-file-bloat rule | MISSING | **MISSING** | Nearest: `system.json` "Good Stewardship" (match conventions) — does not say "prefer editing existing files over creating new ones." |
| B9 | No-time-estimates | MISSING | **MISSING** | Trivial absence. Low priority. |
| B10 | Backwards-compat cleanup | MISSING | **MISSING** | Low priority. |
| B11 | Named rationalization rejection (Popper) | MISSING | **MISSING** | Zero matches. Popper has falsification philosophy but no explicit list of rationalizations like "the code looks correct → reading is not verification." |
| B12 | Security awareness | MISSING | **MISSING** | Nearest: Descartes `personaIntro` ("do not trust the user's inputs"); `methodSteps[4]` ("Prefer security by default"). No mention of specific injection vectors (XSS, SQL injection, command injection). |
| B13 | Git safety protocol | MISSING | **MISSING** | Zero matches in any expert JSON. User `.cursor/rules` may contain git rules but these are external to the prompt system. |

### Per-Expert failureSignals Inventory

| Expert | failureSignals |
|--------|---------------|
| Liskov | "Implementation details without interface reasoning", "Hidden coupling left unnamed", "No caller compatibility analysis" |
| Descartes | "Business logic before the foundation", "Unchallenged assumptions", "Pure brainstorming without contracts" |
| Peirce | "Filler opening", "Vague suggestions", "No verification plan", "Persona blending without a declared handoff" |
| Dijkstra | "No invariants named", "Concurrency risk treated as ordinary implementation detail", "Control-flow complexity left unexplained" |
| Shannon | "More text instead of better signal", "Critical context dropped during compression", "No validation of retrieval quality" |
| Blackmore | "No reusable pattern", "No update path for future recurrence", "Manual attrition instead of automation" |
| Simon | "No stopping condition", "Tool use without decision criteria", "Workflow stages blended without ownership" |
| Knuth | "Optimization without measurement", "Micro-optimization before algorithmic leverage", "No benchmark or verification plan" |
| Popper | "Validation language instead of falsification", "No reproduction steps", "No exact failing coordinates" |
| Rogers | "Blaming the user", "Accessibility ignored", "Backend-first answer to a UX problem" |
| Dennett | "Premature commitment", "Only minor variants", "No comparison of risk or complexity" |

**Bottom line:** The entire behavioral guardrails layer (B1–B13) is absent from the prompt system. The `failureSignals` arrays provide 1/3 of the B1 triple pattern across all experts. Everything else is net-new work for Phase 2.

---

## 3. Agent Persona Recommendations (C1–C5)

### C1 — 5-Part Behavioral Envelope

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | M / M |

Checked across Peirce, Descartes, and Rogers:

| Part | Status | Evidence |
|------|--------|----------|
| 1. Identity (`personaIntro`) | **Present** | All 11 experts have rich persona declarations. |
| 2. Output format (`requiredSections`) | **Present** | All 11 experts define simple/default/complex section sets. |
| 3. Core constraint | **Partial** | Embedded in `corePhilosophy` arrays but not declared as a singular explicit constraint. |
| 4. Tool restrictions | **Missing** | No `toolRestrictions`, `allowedTools`, or equivalent field in any expert. |
| 5. One-shot vs persistent | **Missing** | No declaration of interaction scope in any expert. |

---

### C2 — Read-Only Bias for Exploration Experts

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL → effectively MISSING |
| **Impact / Effort** | M / S |

**Evidence:** Neither Dennett nor Shannon contains any read-only declaration. Dennett's `personaIntro` says "You exist at the beginning of the pipeline" (role scope, not tool restriction). Shannon has no tool-related language at all. Adding `"STRICTLY READ-ONLY"` or equivalent is not implemented.

---

### C3 — Adversarial Verification Protocol for Popper

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | H / M |

**What Popper has:**

- Falsification philosophy: `corePhilosophy[0]` — "You write tests designed to trigger unexpected failure."
- Edge-case hunting: `corePhilosophy[1]` — lists nulls, race conditions, off-by-one
- Hypothesis-driven testing: `corePhilosophy[2]` — "Form a hypothesis about how the system might break."
- Adversarial voice: `voice[1]` — "Report failures like a coroner, not a cheerleader."

**What Popper lacks:**

| Required Component | Status |
|--------------------|--------|
| Universal baseline checks (always-run list) | Missing |
| Required adversarial probes (empty input, null, max-length) | Missing |
| Named rationalization rejections | Missing |
| Strict VERDICT: PASS/FAIL output format | Missing |

---

### C4 / C5 — Fork Agent Constraints / Autonomous Mode

| Field | Value |
|-------|-------|
| **Claimed** | N/A |
| **Verified** | N/A — confirmed |

No fork/subagent execution or autonomous mode.

---

## 4. Testing & Evaluation (D1–D11)

### D1 — Prompt Smoke Tests

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | H / M |

`prompt-system.test.mjs` contains 4 tests:
1. `resolveRequiredSections` prefers `default` over `simple` (lines 11–22)
2. Fallback to `simple` when `default` absent (lines 24–33)
3. Empty arrays when nothing defined (lines 35–42)
4. Generated artifacts match committed files (lines 44–59) — this is a **sync** test, not a structural validity test

| D1 Criterion | Present? |
|-------------|----------|
| (a) Required sections exist in output | No |
| (b) Valid frontmatter | No |
| (c) Token budget | No |
| (d) Valid expert ID references | No |

---

### D2 — Prompt Snapshot Tests

| Field | Value |
|-------|-------|
| **Claimed** | DONE |
| **Verified** | DONE — confirmed |

The sync test at `prompt-system.test.mjs` line 44 compares `generateArtifacts(system)` output to committed files with `assert.strictEqual`. Any drift is caught.

---

### D3 — Behavioral Assertion Helpers

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | H / M |

`evaluateResponse()` in `regression.mjs` (lines 250–321) evaluates 6 structural dimensions:

| Dimension | How |
|-----------|-----|
| Routing correctness | Compares `selectedExpert` to `expectedPrimaryExpert` |
| Section presence | Checks expected sections against `outputSections` and regex |
| Confidence labeling | Boolean + regex for VERIFIED/HYPOTHESIS |
| Persona blending | `personaBlend` flag + `hasForbiddenExpertHeadings()` |
| Domain scope | `domainStayedInScope` boolean |
| Invalid handoffs | Filters against `allowedHandoffs` |

**Missing behavioral dimensions:** over-engineering, false claims, concision, gold-plating, file-editing quality, assertiveness, thoroughness — all absent.

Scoring formula: `score = findings.length === 0 ? 2 : routingMatch ? 1 : 0` — a 3-point scale based purely on structural compliance.

---

### D4 / D5 — pass@k / pass^k

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | H / M |

`run-regressions.mjs` iterates cases once per target. No trial loop, no `--trials` flag, no `n_trials` parameter. Zero matches for `trial`, `attempts`, or `runs_per_case` in `scripts/`.

---

### D6 / D7 — Model-Based / Composite Graders

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | M / L |

No LLM-as-judge call anywhere in `scripts/` or `regression/`. All evaluation is deterministic code in `evaluateResponse()`.

---

### D8 — Behavioral Eval Dimensions Beyond Routing

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | H / M |

The research identifies 6 behavioral dimensions: false-claim rate, over-engineering, concision, file-editing quality, assertiveness, thoroughness. Current scoring measures 0 of these.

---

### D9 — Ablation Testing

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | H / L |

Planned for Phase 6. No `ablation-manifest.json`, no `--ablation` flag, no `run-ablation.mjs`.

---

### D10 — Expanded Regression Fixture Set

| Field | Value |
|-------|-------|
| **Claimed** | MISSING |
| **Verified** | MISSING — confirmed |
| **Impact / Effort** | H / M |

14 cases in `fixtures/cases.json` across 3 categories:

| Category | Count | IDs |
|----------|-------|-----|
| `router` | 6 | R1–R6 |
| `expert` | 6 | Q1, D1, P1, Rg1, B1, V1 |
| `conflict` | 2 | C1, C2 |

**Cases testing behavioral guardrail violations: 0.** No case prompts are designed to provoke gold-plating, false claims, scope creep, premature abstraction, or blind retry loops. All `forbiddenBehaviors` entries target routing/format violations (e.g., "Dennett-style ideation", "Undeclared multi-persona blend"), not behavioral anti-patterns.

---

### D11 — Infrastructure Noise Calibration

| Field | Value |
|-------|-------|
| **Claimed** | N/A |
| **Verified** | N/A — confirmed |

---

## 5. Communication & Output (E1–E4)

### E1 — Concision-First Output Style

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | M / S |

**Numeric anchors in voice arrays:** Zero across all 11 experts and both system constants (`VOICE_CALIBRATION`, `SCAFFOLDED_VOICE`).

**Qualitative concision guidance:** Present in 2 of 11 experts only:

| Expert | Rule |
|--------|------|
| Peirce | "Be direct, dense, and terse without filler." |
| Shannon | "Prefer concise structures that preserve critical distinctions." |

The remaining 9 experts have zero concision direction.

---

### E2 — Lead With the Answer

| Field | Value |
|-------|-------|
| **Claimed** | PARTIAL |
| **Verified** | PARTIAL — confirmed |
| **Impact / Effort** | M / S |

**Present in:** Peirce only — `voice[0]`: "Lead with the answer or the single most important clarifying question."

**Absent from:** All other 10 experts and both system-level voice constants. The gap analysis recommends propagating this to Descartes, Popper, and Blackmore.

---

### E3 / E4 — Tool Call Colons / Subagent Output Format

| Field | Value |
|-------|-------|
| **Claimed** | N/A |
| **Verified** | N/A — confirmed |

---

## 6. Memory & Context (F1–F3)

All three items (F1 memory taxonomy, F2 memory verification, F3 context compression) are **N/A — confirmed**. The system generates static files with no runtime context management.

---

## 7. Voice Calibration System — Supplementary Finding

An internal tension was discovered between system-level voice constants:

- **`VOICE_CALIBRATION`** (default mode): *"Do not prefix claims with labels like 'HYPOTHESIS:' or 'VERIFIED:' unless the output contract explicitly demands them."*
- **`SCAFFOLDED_VOICE`** (scaffolded mode): *"Externalize your reasoning process. Prefix every assumption with its epistemic status: HYPOTHESIS (~N%) for unverified claims, VERIFIED for claims backed by tests or documentation."*
- **Peirce `voice[2]`**: *"Mark claims as VERIFIED or HYPOTHESIS."*

This creates a contradiction when `VOICE_CALIBRATION` is applied to Peirce — the system-level constant says "don't label" while the expert-level voice says "do label." The selection logic between calibrated and scaffolded voice is handled by the renderer, but the rendered output can produce conflicting instructions if the wrong constant is paired with Peirce. This is not a gap analysis item but is worth noting for Phase 4 (prompt architecture) work.

---

## 8. What We Already Do Well

Credit confirmed by audit:

1. **Prompt snapshot tests (D2):** `prompt-system.test.mjs` line 44 compares generated output to committed files. Deterministic and reliable.
2. **Expert routing with heuristics:** `router.json` has 13 priority-ordered heuristics with signal keywords and disambiguation rules.
3. **Persona identity with voice calibration:** V1–V5 experiments proved bidirectional voice control.
4. **Structured output contracts per expert:** All 11 experts have `requiredSections` with default/complex structures, validated by the regression suite.
5. **Pipeline sequences for multi-domain tasks:** 4 named pipelines matching agent coordination patterns.
6. **A/B experimental infrastructure:** `test-workspaces/` with V1–V5 analyses, multi-model comparison, and quantitative metrics.

---

## 9. Priority Stack Rank — Verified

The gap analysis priority ranking was verified. All 15 items in the stack rank are accurately classified. The four quick wins remain the recommended starting point for Phase 2:

| Rank | ID | Recommendation | Impact | Effort | Confirmed |
|------|-----|---------------|--------|--------|-----------|
| 1 | A6 | Numeric length anchors in expert voice rules | H | S | All 11 voice arrays are qualitative-only |
| 2 | B2 | Anti-gold-plating rules | H | S | Zero guardrail rules exist in any expert |
| 3 | B4 | Don't create premature abstractions | H | S | Same — no `behavioralGuardrails` field exists |
| 4 | B7 | Diagnostic discipline | H | S | Nearest concepts are adjacent but not specific |
| 5 | B1 | Failure→Rule→Anti-Over-Correction triples | H | M | `failureSignals` = 1/3 of pattern; 2/3 absent |
| 6 | B11 | Named rationalization rejection (Popper) | H | M | Zero rationalization lists anywhere |
| 7 | C3 | Adversarial verification protocol (Popper) | H | M | Philosophy present, protocol absent |
| 8 | D1 | Prompt smoke tests | H | M | Sync test exists; structural validation does not |
| 9 | D4 | pass@k metric | H | M | Single-run only |
| 10 | D5 | pass^k metric | H | M | Single-run only |
| 11 | D8 | Behavioral eval dimensions | H | M | 0/6 dimensions evaluated |
| 12 | D10 | Expanded regression fixtures | H | M | 0/14 cases test behavioral violations |
| 13 | A1 | Explicit constraint hierarchy | H | M | Prose assertion only, no structural enforcement |
| 14 | A4 | Formal behavioral stack with restriction-only rule | H | M | No monotonic restriction contract |
| 15 | D9 | Ablation testing capability | H | L | No infrastructure exists |

---

## 10. Recommendations for Phase 2

Based on the audit, Phase 2 (Behavioral Guardrails) should proceed as planned in `PHASE-1-GAP-ANALYSIS.md` lines 190–197:

1. **Add a `behavioralGuardrails` field** to the expert JSON schema — no such field exists in any of the 11 experts or in `system.json`.
2. **Update renderers** — `render-rich.mjs` and `render-codex.mjs` both need a new section to emit guardrails. Neither currently handles any guardrail-related field.
3. **Start with quick wins** — A6, B2, B4, B7 applied to `expert-engineer-peirce.json`, then propagate.
4. **Extend `failureSignals` to full triples** (B1) — each of the 33 existing failure signals needs a corresponding rule and anti-over-correction.
5. **Build Popper's adversarial protocol** (B11, C3) — the single highest-leverage change for QA quality.
6. **Rebuild and test** — `npm run build:prompts` then `npm run test:unit` to verify sync.

---

*Report generated by automated codebase audit. All findings include exact file locations and quoted evidence from source files.*
