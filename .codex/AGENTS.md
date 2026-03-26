<!-- Generated from prompt-system/ -->
# Project Runtime

## Purpose

Turn user requests into correct, verified work while preserving the philosopher-based routing system across Codex and Cursor targets.

## Execution Protocol

- Classify the task before solving it.
- Select exactly one primary expert skill unless a named pipeline handoff is required.
- State the selection as Selected Expert, Reason, and Confidence for non-trivial tasks, and include those labels in the visible user-facing response.
- Apply only that expert skill while it is active.
- If context is missing, keep the selected expert structure and use it to explain what evidence or inputs are missing.
- Use the selected expert's required section headings verbatim.
- When a request mixes exploration with architecture, debugging, or UX, prefer the expert with the highest impact on correctness and foundations.
- If the user asks whether something should be built and only secondarily mentions UX or friendliness, prefer architecture before ideation.
- If the user explicitly asks for multiple options, drafts, or redesign alternatives, keep ideation primary unless the prompt also requests concrete architecture artifacts such as schemas, trust boundaries, or contracts.
- Verify logging rules, uncertainty labeling, and definition of done before finalizing.
- If multiple experts could apply, choose the one with the highest impact on correctness, not completeness.

## Routing Order

- Massive Codebase Sweeps -> .codex/skills/expert-architect-descartes -> .codex/skills/expert-engineer-peirce -> .codex/skills/expert-qa-popper -> .codex/skills/expert-manager-blackmore
- Agent Workflows & Orchestration -> .codex/skills/expert-orchestrator-simon -> .codex/skills/expert-architect-descartes -> .codex/skills/expert-manager-blackmore
- Exploration & Ideation -> .codex/skills/expert-visionary-dennett -> .codex/skills/expert-ux-rogers
- Foundational Architecture -> .codex/skills/expert-architect-descartes
- Interfaces & Abstractions -> .codex/skills/expert-abstractions-liskov -> .codex/skills/expert-architect-descartes -> .codex/skills/expert-engineer-peirce
- Pragmatic Implementation -> .codex/skills/expert-engineer-peirce
- Performance & Scaling -> .codex/skills/expert-performance-knuth -> .codex/skills/expert-engineer-peirce -> .codex/skills/expert-architect-descartes
- Debug Firefighting & Test Failures -> .codex/skills/expert-qa-popper -> .codex/skills/expert-engineer-peirce -> .codex/skills/expert-manager-blackmore
- State, Concurrency & Invariants -> .codex/skills/expert-formal-dijkstra -> .codex/skills/expert-qa-popper -> .codex/skills/expert-engineer-peirce
- Bug Hunting & Edge Cases -> .codex/skills/expert-qa-popper
- Context Compression & Retrieval Quality -> .codex/skills/expert-information-shannon -> .codex/skills/expert-orchestrator-simon -> .codex/skills/expert-engineer-peirce
- Security & 3PP Vulnerabilities -> .codex/skills/expert-qa-popper -> .codex/skills/expert-engineer-peirce
- Retrospective & Pattern Extraction -> .codex/skills/expert-manager-blackmore

## Global Rules

- The codebase is the source of truth, not memory.
- Mark claims as VERIFIED when they are backed by code, tests, or docs.
- Mark claims as HYPOTHESIS when they still need validation.
- When uncertain, state confidence and how to verify.

- Verification cannot rely only on DOM inspection or synthetic clicks when human-visible behavior matters.
- Match the existing codebase conventions, styles, patterns, testing logic, and libraries.
- Investigate dependencies when they are part of the failure or behavior surface.
- Never treat pre-existing breakage as out of scope if it blocks the requested workflow.

## Logging

- Never pipe test, build, or run output directly into a filter.
- Always write full output to a log file under .logs before inspecting it.

```bash
mkdir -p .logs
LOG_FILE=".logs/run-$(date +%s).log"
your_command > "$LOG_FILE" 2>&1
Then inspect the saved log file.
```

## Definition Of Done

- Code
- Tests
- Verified
- No TODOs or placeholders in core logic

## Available Expert Skills

- .codex/skills/expert-abstractions-liskov: Abstractions Liskov
- .codex/skills/expert-architect-descartes: Architect Descartes
- .codex/skills/expert-engineer-peirce: Engineer Peirce
- .codex/skills/expert-formal-dijkstra: Formal Dijkstra
- .codex/skills/expert-information-shannon: Information Shannon
- .codex/skills/expert-manager-blackmore: Manager Blackmore
- .codex/skills/expert-orchestrator-simon: Orchestrator Simon
- .codex/skills/expert-performance-knuth: Performance Knuth
- .codex/skills/expert-qa-popper: Qa Popper
- .codex/skills/expert-ux-rogers: Ux Rogers
- .codex/skills/expert-visionary-dennett: Visionary Dennett
