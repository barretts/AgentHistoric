<!-- Generated from prompt-system/philosopher-system.json -->
# Project Runtime

## Purpose

Turn user requests into correct, verified work while preserving the philosopher-based routing system across Codex and Cursor targets.

## Execution Protocol

- Classify the task before solving it.
- Select exactly one primary expert skill unless a named pipeline handoff is required.
- State the selection as Selected Expert, Reason, and Confidence for non-trivial tasks.
- Apply only that expert skill while it is active.
- If context is missing, keep the selected expert structure and use it to explain what evidence or inputs are missing.
- Verify logging rules, uncertainty labeling, and definition of done before finalizing.
- If multiple experts could apply, choose the one with the highest impact on correctness, not completeness.

## Routing Order

- Massive Codebase Sweeps -> skills/expert-architect-descartes -> skills/expert-engineer-quinn -> skills/expert-qa-popper -> skills/expert-manager-blackmore
- Exploration & Ideation -> skills/expert-visionary-dennett -> skills/expert-ux-rogers
- Foundational Architecture -> skills/expert-architect-descartes
- Pragmatic Implementation -> skills/expert-engineer-quinn
- Debug Firefighting & Test Failures -> skills/expert-qa-popper -> skills/expert-engineer-quinn -> skills/expert-manager-blackmore
- Bug Hunting & Edge Cases -> skills/expert-qa-popper
- Security & 3PP Vulnerabilities -> skills/expert-qa-popper -> skills/expert-engineer-quinn
- Retrospective & Pattern Extraction -> skills/expert-manager-blackmore

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

- skills/expert-engineer-quinn: Engineer Quinn
- skills/expert-architect-descartes: Architect Descartes
- skills/expert-qa-popper: Qa Popper
- skills/expert-ux-rogers: Ux Rogers
- skills/expert-manager-blackmore: Manager Blackmore
- skills/expert-visionary-dennett: Visionary Dennett
