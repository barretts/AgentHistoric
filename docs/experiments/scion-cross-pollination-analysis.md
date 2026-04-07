# Cross-Project Analysis: Scion → AgentHistoric Improvements

## Executive Summary

Scion is a **runtime orchestration** platform for concurrent LLM agents with isolation, templates, and multi-harness support. AgentHistoric is a **prompt-time persona architecture** with routing and behavioral testing. They operate at different layers of the same stack — Scion runs agents, AgentHistoric programs them. The synergies are substantial.

---

## 1. Testing Improvements

### 1a. Expand Target Harnesses (High Value)

Currently `run-regressions.mjs` supports only `cursor` and `codex` targets. Scion's `pkg/harness/` already has production-grade integrations for **Claude Code**, **Gemini CLI**, and **OpenCode** — each with distinct `InjectAgentInstructions` and `InjectSystemPrompt` paths.

**Concrete additions:**
- Add `claude`, `gemini`, and `opencode` as regression targets
- Each harness has different instruction injection behavior (Claude → `.claude/CLAUDE.md`, Gemini → `.gemini/GEMINI.md`, OpenCode → `AGENTS.md`). The regression suite should validate that the *same prompt* routes identically regardless of which harness format delivered the persona rules
- This catches "format sensitivity" — a real failure mode where routing works in Cursor's `.mdc` but breaks in Codex's `AGENTS.md` because the parser weights frontmatter differently

### 1b. Multi-Turn Pipeline Validation (High Value)

Pipelines (Deliberation Council, Implement & Verify, Debug Firefighting) are defined in `router.json` but only tested at the *trigger detection* level (CC1-CC4, AV1-AV3). Scion's agent lifecycle model (STARTING → THINKING → EXECUTING → WAITING_FOR_INPUT → COMPLETED) reveals the gap:

**What's missing:** Testing the actual handoff chain. When Peirce hands off to Popper in the "Implement & Verify" pipeline, does Popper's output actually conform to the verification contract? Does the VERDICT appear?

**Concrete test type:** Pipeline integration cases that validate:
1. Step N's output contains the expected section headers for its expert
2. Step N+1 receives the context from Step N (no dropped state)
3. Terminal steps produce the contract deliverables (e.g., `VERDICT: PASS` or `VERDICT: FAIL`)

This would be a new suite category — `pipeline-integration` — with multi-message regression cases instead of single-shot.

### 1c. Automated Ablation Execution (Medium Value)

The `ablation-manifest.json` defines 8 ablation sections, and `run-ablation.mjs` exists but the AGENTS.md notes it "was not exercised with real LLMs yet." Scion's approach of progressive configuration layering (template → grove-defaults → agent-inline) is a good model:

**Concrete improvement:** Run automated ablation for each `constraintHierarchy` layer:
- Global Runtime ablation (what breaks without logging mandates?)
- Router ablation (what breaks without negative routing?)
- Modifier ablation (already partially in manifest)
- Expert Philosophy ablation (already in manifest)

Wire this into CI as a periodic check (not every commit, but weekly).

### 1d. Stall/Timeout Detection in Regressions (Low Effort)

Scion's `StalledFromActivity` and stall detection mechanism catches agents that stop making progress. The regression runner has no timeout or stall detection:

**Add:**
- Per-case timeout (e.g., 60s for cursor, 120s for codex)
- Detection of "routing stall" — when the model produces content but never emits `selectedExpert`
- Detection of "persona loop" — when the model keeps re-routing without committing

### 1e. Cross-Model Parity Testing as First-Class Suite (Medium Value)

Parity comparisons already exist in `compareTargets()`, but model parity is tracked as a side effect. Scion's multi-broker architecture where the *same* agent can run on different brokers shows the value of treating parity as a first-class concern:

**New suite: `model-parity`** — explicitly tests that Claude and GPT agree on routing for cases where they *should* agree. The `remaining-work.md` already identifies divergence cases (SP-Kn2: GPT routes to Popper, Claude routes correctly to Knuth). Formalizing this as a dedicated suite with `expectedParity: true/false` per case would separate "acceptable model divergence" from "routing bug."

---

## 2. Structural Improvements (True to Identity)

### 2a. Renderer Interface Protocol (High Value)

Scion's `Harness` interface is clean:

```go
InjectAgentInstructions(agentHome string, content []byte) error
InjectSystemPrompt(agentHome string, content []byte) error
```

AgentHistoric has `render-rich.mjs` and `render-codex.mjs` but no formal interface contract. Each renderer is an implicit convention.

**Improvement:** Define a renderer protocol (even just a JSDoc contract or a validation test) that every renderer must implement:
- `renderInit(system) → string`
- `renderRouter(router) → string`
- `renderExpert(expert, system) → string`
- `renderModifier(modifier) → string`

This makes adding new targets (e.g., OpenCode, Gemini) trivial and testable. The `prompt-smoke.test.mjs` already validates some of this implicitly; formalize it.

### 2b. Template Inheritance for Expert Variants (Medium Value)

Scion's `BaseTemplate` field enables template inheritance — a child template extends a parent and overrides specific fields. AgentHistoric experts currently have no inheritance:

**Use case:** Create expert *profiles* — a "strict" Popper that demands falsification evidence before any claim, vs. a "pragmatic" Popper that permits HYPOTHESIS labels more freely. These would inherit from the base Popper expert and override only `behavioralGuardrails` or `failureSignals`.

This directly addresses the TP3 edge case ("flaky test → write a fix") where the right answer may depend on the *strictness profile* rather than on adding more routing signals.

### 2c. Scoped Configuration Overrides (Medium Value)

Scion's three-tier scope system (global → grove → user) maps directly to AgentHistoric's `constraintHierarchy` (Global Runtime → Router → Modifier → Expert). But AgentHistoric has no mechanism for **project-level overrides** — every user gets the same routing weights.

**Improvement:** A `project-overrides.json` (like Scion's grove-level `default_grove_settings.yaml`) that lets teams:
- Boost or suppress specific experts for their domain (a pure-backend team suppresses Rogers)
- Override `experimentFlags` per-project
- Add project-specific disambiguation entries

This stays true to the MoE architecture — not changing experts, just tuning the router per deployment context.

### 2d. Agent Status Contract for Experiments (Low Effort)

Scion's `sciontool status` commands (`ask_user`, `blocked`, `task_completed`) create a structured lifecycle. Experiment and regression scripts dump markdown but have no structured status contract:

**Add a status schema for experiments:**
```json
{
  "phase": "running|completed|failed",
  "currentCase": "TP3",
  "progress": "12/74",
  "currentTarget": "cursor",
  "latestScore": 2,
  "elapsedMs": 4200
}
```
Write this to `.logs/experiment-status.json` during runs. Enables tooling to monitor long regression suites without tailing logs.

### 2e. Plugin Expert Registration (Future Value)

Scion's plugin system (`pluginManager.HasPlugin(pluginType, name)`) lets external harnesses register without modifying core code. AgentHistoric could support **community experts** the same way:

- A `plugins/` directory where third-party expert JSONs can be dropped
- The build system auto-discovers and renders them alongside built-in experts
- Regression cases can target plugin experts

This is a longer-term play, but it mirrors Scion's extensibility story.

---

## 3. Specific Wins from Scion Patterns

| Scion Pattern | AgentHistoric Application |
|---|---|
| **Template chain resolution** (`ResolveContentInChain`) | Layer override files: `system.json` → `project-overrides.json` → resolved config |
| **Convention-based auto-detection** (agents.md fallback) | Auto-detect `project-overrides.json` in workspace root without explicit config |
| **Optimistic locking** (`StateVersion`) | Version field in `cases.json` to detect merge conflicts in regression fixtures |
| **Ancestry chain** (agent hierarchy) | Track handoff lineage in pipeline test results: who handed off to whom and why |
| **Labels/Annotations pattern** | Add `labels` to regression cases for metadata queries (e.g., filter by "known-divergent") |
| **Multi-trial aggregation** | Already exists in the runner. Scion's parallel broker execution suggests running all targets in parallel for a single case |

---

## 4. Priority Ranking

1. **Target harness expansion** (cursor, codex, claude, gemini, opencode) — directly validates build artifacts work correctly in each format
2. **Renderer interface protocol** — reduces risk of silent drift between targets
3. **Pipeline integration test suite** — the most complex features are currently the least tested
4. **Model parity as first-class suite** — systematizes the divergence tracking already being done manually
5. **Project-scoped overrides** — unlocks adoption in diverse team contexts
6. **Automated ablation runs** — the infrastructure exists, just needs to be run
7. **Expert variant profiles** — addresses genuine routing ambiguity at the expert level
8. **Experiment status contract** — small quality-of-life for long-running suites

All of these stay within AgentHistoric's identity as a **prompt-time persona architecture**. None require runtime orchestration or container infrastructure — they borrow Scion's *design patterns* (interface contracts, scoped overrides, lifecycle phases, template inheritance) without taking its runtime concerns.
