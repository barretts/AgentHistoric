# Phase 1: Gap Analysis

**Date:** 2026-03-31
**Source:** Cross-referencing docs/research/00-02 against the current prompt-system/, regression/, and scripts/ codebases.
**Purpose:** Produce a scored inventory of every actionable recommendation from the Claude Code research, classified against our current implementation.

---

## Classification Key

| Code | Meaning |
|------|---------|
| DONE | Already implemented in our system |
| PARTIAL | Concept exists but implementation is incomplete |
| MISSING | Not implemented, applicable to our architecture |
| N/A | Not applicable to our MoE architecture (we are a prompt system, not a runtime agent) |

## Impact Key

| Level | Meaning |
|-------|---------|
| H | High -- directly improves prompt reliability or test coverage for our use case |
| M | Medium -- valuable but not blocking |
| L | Low -- nice-to-have or marginal benefit |

## Effort Key

| Level | Meaning |
|-------|---------|
| S | Small -- a few lines in 1-2 files |
| M | Medium -- new fields/functions across several files |
| L | Large -- new infrastructure, new test categories, multi-file refactoring |

---

## 1. Prompt Architecture Recommendations

| # | Recommendation | Source | Status | Impact | Effort | Notes |
|---|---------------|--------|--------|--------|--------|-------|
| A1 | Layered prompt with explicit priority hierarchy | doc-00 S1 | PARTIAL | H | M | We have init -> router -> expert, but no explicit rule that lower layers cannot expand upper layer constraints. `system.json` `executionBinding` says "supersede" but the renderers don't enforce constraint inheritance. |
| A2 | Static/dynamic prompt boundary for cache optimization | doc-00 S1 | N/A | -- | -- | We generate static files. No runtime cache to optimize. |
| A3 | Section-based caching with DANGEROUS_ naming | doc-00 S1 | N/A | -- | -- | No runtime prompt assembly. |
| A4 | Behavioral stack as 6-layer constraint system | doc-01 S1 | PARTIAL | H | M | We have 3 layers (init, router, expert). The research shows 6. We lack the explicit "restricts but never expands" contract between layers. The generated prompts do not currently state that expert rules cannot override globalRuntime rules. |
| A5 | Model-version markers (`@[MODEL_TUNING]`) for prompt sections | doc-01 S12 | MISSING | M | S | We have no markers indicating which prompt sections are model-sensitive. Adding these as comments in the JSON source would make prompt reviews tied to model upgrades systematic. |
| A6 | Numeric length anchors replacing qualitative instructions | doc-01 S10, doc-02 S5 | MISSING | H | S | Our `voice[]` arrays say "Be direct, dense, and terse" (Peirce) but never give numeric bounds. Research shows ~1.2% token reduction from numeric anchors like "<=25 words between tool calls". Adding word-count targets to expert voice rules is high-impact and trivial to implement. |

---

## 2. Behavioral Guardrail Recommendations

| # | Recommendation | Source | Status | Impact | Effort | Notes |
|---|---------------|--------|--------|--------|--------|-------|
| B1 | Failure Mode -> Rule -> Anti-Over-Correction triple pattern | doc-01 S18 P1 | MISSING | H | M | Our experts have `failureSignals[]` (the failure mode) but not the rule or the anti-over-correction. This is the highest-leverage finding. Each expert needs: what it fails at, the rule to prevent it, and the rule to prevent over-correcting. |
| B2 | Anti-gold-plating rules | doc-00 S5, doc-01 S2.1 | MISSING | H | S | "Don't add features beyond what was asked. A bug fix doesn't need surrounding code cleaned up." Not present in any expert prompt. Directly applicable to Peirce, Descartes, Popper. |
| B3 | Don't handle impossible scenarios | doc-01 S2.1 | MISSING | M | S | "Don't add error handling for scenarios that can't happen. Trust internal code and framework guarantees." Applicable to Peirce and Dijkstra. |
| B4 | Don't create premature abstractions | doc-01 S2.1 | MISSING | H | S | "Three similar lines of code is better than a premature abstraction." Directly applicable to Peirce and Liskov. |
| B5 | Comment writing discipline | doc-01 S2.2 | MISSING | M | S | "Default to writing no comments. Only add one when the WHY is non-obvious." + "Don't remove existing comments unless removing the code." Applicable to Peirce. |
| B6 | Reversibility awareness with scoped approvals | doc-01 S2.3 | MISSING | M | S | "Authorization stands for the scope specified, not beyond." Applicable to all experts that make changes. |
| B7 | Diagnostic discipline (diagnose before switching tactics) | doc-01 S2.4 | MISSING | H | S | "Read the error, check your assumptions, try a focused fix. Don't retry blindly, don't abandon after one failure." Directly applicable to Popper and Peirce. |
| B8 | No-file-bloat rule | doc-01 S2.7 | MISSING | M | S | "Prefer editing an existing file to creating a new one." Applicable to Peirce. |
| B9 | No-time-estimates rule | doc-01 S2.8 | MISSING | L | S | "Focus on what needs to be done, not how long." Low priority but trivial. |
| B10 | Backwards-compat cleanup rule | doc-01 S2.9 | MISSING | L | S | "If unused, delete completely. No _vars, no re-exports, no // removed." Low priority. |
| B11 | Named rationalization rejection list | doc-01 S18 P5 | MISSING | H | M | For Popper (QA/verification): explicitly name the rationalizations the model will use to skip verification. "The code looks correct" -> reading is not verification. "Tests already pass" -> verify independently. High impact for QA quality. |
| B12 | Security awareness rule | doc-01 S2.5 | MISSING | M | S | "Be careful not to introduce command injection, XSS, SQL injection." Applicable to Peirce and Descartes. |
| B13 | Git safety protocol | doc-01 S13 | MISSING | M | M | Never force-push, never amend without checking, never skip hooks, always stage specific files. Applicable to Peirce when doing implementation work. Partially overlaps with user rules but making it part of the expert prompt is stronger. |

---

## 3. Agent Persona Recommendations

| # | Recommendation | Source | Status | Impact | Effort | Notes |
|---|---------------|--------|--------|--------|--------|-------|
| C1 | Agent persona as 5-part behavioral envelope | doc-01 S18 P3 | PARTIAL | M | M | We have: identity (personaIntro), output format (requiredSections), core constraint (partially via methodSteps). We lack: explicit tool restrictions per expert, one-shot vs persistent declaration. Tool restrictions aren't directly applicable (Cursor controls tools), but we could express "this expert should prefer read-only exploration" vs "this expert should modify code." |
| C2 | Explore agent = read-only, no file creation | doc-01 S4.2 | PARTIAL | M | S | Dennett and Shannon could declare a read-only bias. Currently nothing prevents them from proposing file creation. Adding "STRICTLY READ-ONLY" to exploration-phase experts would be low-effort. |
| C3 | Verification agent with adversarial mandate | doc-01 S5 | PARTIAL | H | M | Popper already has a falsification philosophy, but lacks the explicit adversarial verification protocol: universal baseline checks, required adversarial probes, named rationalizations to reject, strict output format with VERDICT. This would make Popper dramatically more effective. |
| C4 | Fork agent constraints (structured output, no conversation) | doc-01 S6 | N/A | -- | -- | We don't have fork/subagent execution. |
| C5 | Autonomous mode behavioral profile | doc-01 S7 | N/A | -- | -- | We don't have autonomous execution. |

---

## 4. Testing & Evaluation Recommendations

| # | Recommendation | Source | Status | Impact | Effort | Notes |
|---|---------------|--------|--------|--------|--------|-------|
| D1 | Prompt smoke tests (structure validation) | doc-02 S12 T1 | MISSING | H | M | Does each generated prompt: (a) contain all required sections? (b) have valid frontmatter? (c) stay under a token budget? (d) reference only valid expert IDs? We have NO structural validation of generated output. The sync test in `prompt-system.test.mjs` only checks content match, not structural validity. |
| D2 | Prompt snapshot tests (hash-based change detection) | doc-02 S12 T1 | DONE | -- | -- | Already exists: `prompt-system.test.mjs` line 44 compares generated artifacts to committed files. This IS a snapshot test. Any prompt change that isn't rebuilt will fail. |
| D3 | Behavioral assertion helpers (code-based graders) | doc-02 S12 T1 | PARTIAL | H | M | `evaluateResponse()` in `regression.mjs` checks: routing correctness, section presence, confidence labeling, persona blending, domain scope. It does NOT check: over-engineering, false claims, concision, gold-plating, or any behavioral dimension from the research. |
| D4 | pass@k metric (capability ceiling) | doc-02 S3 | MISSING | H | M | Currently each regression case runs once. A single run can't distinguish "always works" from "sometimes works." Adding N trials with `pass@k = any(results)` is essential for non-deterministic LLM evaluation. |
| D5 | pass^k metric (consistency/reliability) | doc-02 S3 | MISSING | H | M | `pass^k = all(results)`. For production prompts, consistency matters more than peak capability. This is the metric we should gate on. Same implementation effort as D4. |
| D6 | Model-based graders (LLM evaluating LLM output) | doc-02 S3 | MISSING | M | L | Use a separate model call to evaluate: "Did this response contain unnecessary refactoring?" Handles nuance that code graders can't. Expensive to build and calibrate. Phase 5 work. |
| D7 | Composite graders (code + model) | doc-02 S12 T2 | MISSING | M | L | Code grader for hard constraints (correct expert, required sections). Model grader for soft constraints (no gold-plating, appropriate depth). Depends on D6. |
| D8 | Behavioral eval dimensions beyond routing | doc-02 S5 | MISSING | H | M | Current scoring only measures routing accuracy and format compliance. The research identifies 6 behavioral dimensions: false-claim rate, over-engineering, concision, file-editing quality, assertiveness, thoroughness. We should add at least 3: over-engineering detection, concision (output token count), and false-claim detection. |
| D9 | Ablation testing (strip sections, measure delta) | doc-02 S5 | MISSING | H | L | The `ABLATION_BASELINE` pattern: generate prompt variants with specific sections removed, run eval suite against both, measure which sections earn their context tokens. Requires the full eval stack (D4+D5+D8) to be meaningful. Phase 6 work. |
| D10 | Expanded regression fixture set | -- | MISSING | H | M | 14 cases cover routing and format. Zero cases test behavioral guardrails (B1-B13). We need cases that specifically provoke gold-plating, false claims, scope creep, and premature abstraction to validate that guardrails work. |
| D11 | Infrastructure noise calibration | doc-02 S11 | N/A | -- | -- | We test prompts, not agent infrastructure. Resource noise doesn't apply. |

---

## 5. Communication & Output Recommendations

| # | Recommendation | Source | Status | Impact | Effort | Notes |
|---|---------------|--------|--------|--------|--------|-------|
| E1 | Concision-first output style | doc-00 S15 | PARTIAL | M | S | Voice Calibration already says "Integrate reasoning naturally into prose." But lacks numeric anchors (see A6). Expert voice arrays say "Be direct, dense, and terse" (Peirce) but this is qualitative. |
| E2 | Lead with the answer, not the reasoning | doc-00 S15 | PARTIAL | M | S | Peirce voice[0] says "Lead with the answer or the single most important clarifying question." Good. Other experts don't have this. Should propagate to Descartes, Popper, Blackmore. |
| E3 | Don't use a colon before tool calls | doc-01 S10 | N/A | -- | -- | UI rendering artifact. Not relevant to our generated prompt files. |
| E4 | Subagent output format (absolute paths, no code recaps) | doc-01 S10 | N/A | -- | -- | We don't produce subagent prompts. |

---

## 6. Memory & Context Recommendations

| # | Recommendation | Source | Status | Impact | Effort | Notes |
|---|---------------|--------|--------|--------|--------|-------|
| F1 | Memory type taxonomy | doc-01 S8 | N/A | -- | -- | We don't manage persistent memory. |
| F2 | Memory verification before recommendation | doc-01 S8 | N/A | -- | -- | Same. |
| F3 | Context compression | doc-00 S9 | N/A | -- | -- | We generate static files, no runtime context management. |

---

## Priority Stack Rank (Top 15)

Sorted by Impact (H first), then Effort (S first = easier wins at the top).

| Rank | ID | Recommendation | Impact | Effort | Phase |
|------|-----|---------------|--------|--------|-------|
| 1 | A6 | Numeric length anchors in expert voice rules | H | S | 2 |
| 2 | B2 | Anti-gold-plating rules | H | S | 2 |
| 3 | B4 | Don't create premature abstractions | H | S | 2 |
| 4 | B7 | Diagnostic discipline | H | S | 2 |
| 5 | B1 | Failure Mode -> Rule -> Anti-Over-Correction triples | H | M | 2 |
| 6 | B11 | Named rationalization rejection list (for Popper) | H | M | 2 |
| 7 | C3 | Adversarial verification protocol (for Popper) | H | M | 2 |
| 8 | D1 | Prompt smoke tests | H | M | 3 |
| 9 | D4 | pass@k metric | H | M | 5 |
| 10 | D5 | pass^k metric | H | M | 5 |
| 11 | D8 | Behavioral eval dimensions | H | M | 5 |
| 12 | D10 | Expanded regression fixtures for behavioral cases | H | M | 5 |
| 13 | A1 | Explicit constraint hierarchy between layers | H | M | 4 |
| 14 | A4 | Formal behavioral stack with restriction-only rule | H | M | 4 |
| 15 | D9 | Ablation testing capability | H | L | 6 |

---

## Quick Wins (High Impact, Small Effort)

These four items can be implemented in a single session and immediately improve prompt quality:

1. **A6 -- Numeric anchors:** Add word-count targets to 2-3 expert `voice[]` arrays. Example: Peirce gets `"Keep explanations between tool calls to <=30 words unless the task requires detail."`

2. **B2 -- Anti-gold-plating:** Add a `behavioralGuardrails` array to `expert-engineer-peirce.json` with the three Claude Code rules: don't add features beyond the ask, don't create premature abstractions, don't handle impossible scenarios.

3. **B4 -- No premature abstractions:** Same mechanism as B2, applicable to Peirce and Liskov.

4. **B7 -- Diagnostic discipline:** Add to Popper and Peirce: "If an approach fails, diagnose why before switching. Read the error, check assumptions, try a focused fix. Don't retry blindly, don't abandon after one failure."

---

## Deferred Items (Not Applicable to Our Architecture)

These recommendations from the research are valuable engineering but don't apply to a static prompt generation system:

- Permission pipeline, sandbox, tool factories, hook system (A2, A3, and most of doc-00 S2-S4, S6)
- Autonomous mode, fork agents, memory system (doc-01 S6-S8)
- Runtime feature flags, GrowthBook, telemetry pipeline (doc-02 S6-S7)
- Session replay infrastructure (doc-02 S9)
- Infrastructure noise calibration (doc-02 S11)

---

## What We Already Do Well

Credit where due -- several research recommendations are already implemented:

1. **Prompt snapshot tests (D2):** `prompt-system.test.mjs` already compares generated output to committed files. Any drift is caught.

2. **Expert routing with heuristics (doc-01 S18 P7):** Our router.json has 13 priority-ordered heuristics with signal keywords and disambiguation rules. This matches the auto-discovery pattern.

3. **Persona identity with voice calibration:** The V5 experiment proved bidirectional voice control (calibrated vs scaffolded). This is sophisticated prompt engineering.

4. **Structured output contracts per expert:** Each expert has `requiredSections` with default and complex structures, and the regression suite validates them.

5. **Pipeline sequences for multi-domain tasks:** The 4 named pipelines (Debug Firefighting, New Feature Epic, Bug Triage, Automation Generation) match the research's "agent coordination" pattern, adapted for our MoE model.

6. **A/B experimental infrastructure:** The `test-workspaces/` system with V1-V5 analyses, multi-model comparison, and quantitative metrics is a lightweight but functional experimentation pipeline.

---

## Next Step

This gap analysis is complete. Phase 2 (Behavioral Guardrails) should start with the quick wins (A6, B2, B4, B7) applied to `expert-engineer-peirce.json`, then extend the pattern to the other 10 experts. The implementation requires:

1. Add a `behavioralGuardrails` field to the expert JSON schema
2. Update `render-rich.mjs` and `render-codex.mjs` to emit guardrails
3. Rebuild prompts with `npm run build:prompts`
4. Run `npm run test:unit` to confirm the sync test passes
5. Manually review the generated output in `dot-cursor/rules/`
