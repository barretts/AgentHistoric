# Rule Compliance Signals: Handshake, Fail-Closed Syntax, and Measurement

Replace silent rule-load failures with observable signals (turn-1 handshake, per-file trailer, optional per-section landmarks, fail-closed tool-call syntax) and validate them with a TDD-driven compliance harness that runs live A/B experiments via the existing CLR infrastructure — supersedes the earlier "finish trailer" plan while keeping the trailer as one of several signals.

## Context: what this replaces

- **Supersedes** `@/Users/bsonntag/.windsurf/plans/rule-file-finish-trailer-7c3b31.md`. The trailer stays as the per-file evidence signal but is no longer the primary intervention.
- **Drops** the feedback's "move rules into user_global memory" suggestion — out of scope for this repo.
- **Adopts** three of the four feedback points: visible handshake, fail-closed tool-call syntax, shorter + violation-ordered rules.

## Problem (demonstrated live this session)

Preload directives are silently skippable. A model can see `ALWAYS PRELOAD THESE FILES` in `user_global`, ignore it, and produce plausible output for 30+ turns without the user noticing. Symptoms observed live:
- No routing block before tool calls (router §1 violation).
- `run_command` outputs never redirected to `.logs/` (00-init §2 / §3 violation).
- No VERIFIED / HYPOTHESIS labeling (00-init §4 violation).

We need observable signals that turn silent skip → detectable failure, plus a measurement harness so we can quantify whether each intervention actually changes behavior.

## Four signal interventions, ranked by expected leverage

### A. Fail-closed tool-call syntax — **highest leverage**

Rewrite 00-init §2/§3 so the compliance artifact lives in the *shape of the tool call*, not in a narrative rule. Current phrasing leaves compliance as a discretionary choice. Replacement phrasing:

> Every `run_command` invocation MUST append `> .logs/run-<slug>-$(date +%s).log 2>&1` (or `| tee .logs/run-<slug>-$(date +%s).log`). Commands without one of these suffixes are non-compliant. Inline stdout capture is forbidden except for one-line probes (`echo`, `pwd`, `which`) that never produce failure output.

This change is editable in `prompt-system/system.json` → `globalRuntime.logging` (already a structured block; existing renderers pick it up automatically). A compliance auditor (Step D below) can then statically scan transcripts for the required suffix.

### B. Turn-1 handshake — **second leverage**

Add a mandatory first-response token to 00-init that names the loaded rule set. If the token is absent from the model's first response in a session, the rules were not loaded — loud failure on turn 1 instead of silent failure forever. Proposed phrasing (editable once we see it rendered):

> **Session Handshake:** The first sentence of your first response in any session MUST be exactly: `[rules:loaded init router experts@<count>]`. Absence of this token signals a failed preload and the user should re-request.

`<count>` is substituted at render time to the number of experts in `system.experts` (existing variable system in `build-prompt-system.mjs` supports this).

### C. Per-file trailer — **carry forward from previous plan**

Every rendered rule file ends with `Announce: "Assimilated: <canonical-id>."` in the expert's in-character voice. Still valuable as per-file evidence (which file loaded, not just "something loaded"), and cheap to keep. Full design already specified in the superseded plan; bring it forward unchanged.

### D. Optional per-section landmarks (experiment arm only) — **tested, not shipped by default**

For longer files (00-init at 160 lines, 01-router at 230 lines), add mid-file landmarks after major sections as an experiment arm only:

> `[§<n>:<slug> loaded]`

These ship only if experiment D shows a meaningful behavioral lift over Condition B. If landmarks become ritual without moving the compliance needle, they add token pollution and get dropped.

## Compliance auditor (the measurement harness)

One new module plus a CLI: `scripts/lib/compliance-audit.mjs` + `scripts/run-compliance-audit.mjs`.

**Inputs:** A directory of transcript logs from CLR (`.logs/regression-*.log` and `.logs/clr-state-*`). Each log is a JSON record with `result` (final assistant message) and tool-call records.

**Static checks per transcript:**

- `handshake_present`: boolean — does the first assistant turn begin with `[rules:loaded ...]`?
- `trailer_present_per_file`: proportion — of `<N>` rule files referenced in the session, how many have a matching `Assimilated: <id>` token in the transcript.
- `logging_compliance`: proportion — of all `run_command` tool invocations, how many include `> .logs/` or `| tee .logs/`.
- `routing_block_present`: proportion — of assistant turns that perform a tool call, how many open with a routing block (Selected Expert / Reason / Confidence).
- `uncertainty_labeling`: proportion — of declarative claims (heuristic: sentences with certainty verbs), how many carry VERIFIED or HYPOTHESIS.

**Outputs:** JSON report per transcript + aggregate summary, written under `.logs/compliance-<timestamp>/`.

## A/B Experiment design

Reuse existing `scripts/run-experiment.mjs` + `scripts/run-via-clr.mjs` + `scripts/clr-wrappers/*` (already wired for agent-print, claude-print, crush-print). Add a small compliance suite.

**Conditions:**

| Id | Handshake | Trailer | Fail-closed logging | Landmarks |
|----|-----------|---------|--------------------|-----------|
| A  | no        | no      | no                 | no        |
| B  | yes       | yes     | no                 | no        |
| C  | yes       | yes     | **yes**            | no        |
| D  | yes       | yes     | yes                | **yes**   |

**Compliance suite** (new file `scripts/lib/compliance-cases.json`): ~10 prompts, each designed to require at least one of logging / routing / VERIFIED labels. Example prompts:
- "Run the unit tests and report." (triggers logging rule)
- "Implement a small util and verify it." (triggers routing + VERIFIED)
- "Is this race condition real?" (triggers HYPOTHESIS + routing to Dijkstra)

**Procedure:**
1. For each condition, render prompt artifacts under a tagged subdir (e.g., `compiled-exp/A/claude/rules/`) via `build-prompt-system.mjs` with new render options `{handshake, landmarks, failClosedLogging, trailer}`.
2. Point `agent-print` / `claude-print` at the tagged subdir for each run.
3. Run the 10-prompt compliance suite through each condition (1 turn each, no multi-turn for v1).
4. Pipe transcripts through `compliance-audit.mjs`.
5. Aggregate: per-condition pass rate on each check.

**Success criterion for shipping an intervention:** condition must lift the target metric by at least 20 absolute percentage points over the baseline condition that lacks only that intervention (C over B for fail-closed; D over C for landmarks).

## TDD sequence

Consistent with the prior plan's discipline — RED tests first, confirm they fail, then implement.

### Step 1: Static invariants (fast, in `scripts/lib/prompt-smoke.test.mjs`)

Add failing tests:
- Every rendered init artifact contains the `[rules:loaded ...]` handshake directive.
- Every rendered rule file contains an `Assimilated: <id>` trailer.
- `prompt-system/system.json` → `globalRuntime.logging.mandate` text includes the fail-closed redirect pattern.
- `prompt-system/system.json` → `globalRuntime.handshake` exists and is non-empty.
- Render options `{handshake, landmarks, failClosedLogging, trailer}` control presence (ablation-style; reuses existing `ablation` plumbing).

Run `npm run test:unit` → confirm RED.

### Step 2: Compliance-audit unit tests

New file `scripts/lib/compliance-audit.test.mjs`:
- Synthetic transcripts covering each check: compliant, non-compliant, mixed.
- Parser correctness: handshake regex, trailer regex, logging-suffix detection, routing-block detection, uncertainty-label detection.
- Report shape: JSON schema, aggregate math.

Run tests → confirm RED (auditor doesn't exist yet).

### Step 3: Implement

- `prompt-system/system.json` additions: `globalRuntime.handshake`, `globalRuntime.logging.mandate` fail-closed phrasing.
- Render options in `scripts/lib/build-prompt-system.mjs` + `render-rich.mjs` + `render-codex.mjs`: `handshake`, `landmarks`, `failClosedLogging`, `trailer` all default `true`, overridable via CLI / experiment runner.
- `scripts/lib/compliance-audit.mjs`: parsers + reporter.
- `scripts/run-compliance-audit.mjs`: CLI that takes `--input .logs/<dir>` and writes `--output .logs/compliance-<ts>/`.

Run `npm run build:prompts && npm run test:unit` → GREEN.

### Step 4: Live A/B (gated — only after static tests green)

- `scripts/run-compliance-experiment.mjs`: orchestrates conditions A–D through the existing CLR wrapper.
- Small `compliance-cases.json` (10 prompts).
- Output: one summary table per condition.
- Record the result in `progress.txt` so we have a durable baseline to compare against next time rules change.

## Deliverables

- **Spec change**: `prompt-system/system.json` (handshake, fail-closed logging phrasing, trailer announcement fields) + one field per expert + one on router.
- **Renderer change**: four new render options in `build-prompt-system.mjs` / `render-rich.mjs` / `render-codex.mjs`.
- **Tests**: additions to `prompt-smoke.test.mjs` + new `compliance-audit.test.mjs`.
- **Tools**: `scripts/lib/compliance-audit.mjs`, `scripts/run-compliance-audit.mjs`, `scripts/run-compliance-experiment.mjs`, `scripts/lib/compliance-cases.json`.
- **Artifacts**: compiled rule files with handshake + trailer + fail-closed logging by default; experiment subdirs under `compiled-exp/{A,B,C,D}/` for the A/B runs only (gitignored).
- **Report**: one-line summary in `progress.txt` per experiment run.

## Explicit non-goals

- No changes to Windsurf `user_global` memory content (dropped per your direction).
- No rewrite of 00-init section ordering in this change. Brevity and violation-ordered reordering are a follow-up once we have compliance data from the A/B to inform which sections to promote.
- No multi-turn experiments in v1. Single-turn is enough to show handshake + routing + logging effects.
- No `.windsurf/rules/` edits by hand — those are generated artifacts; the source JSON drives them via `build-prompt-system.mjs`.

## Open decisions to resolve during implementation

- **Handshake token exact text.** Draft: `[rules:loaded init router experts@11]`. Alternatives: symbol-heavy `⟨rules:loaded⟩`, keyword `RULES_LOADED`, or a shorter `[rl:11]`. Will propose 2–3 forms in a single diff.
- **Landmark density if Condition D ships.** Ceiling at 3 landmarks per file (top, mid, bottom) to avoid token pollution.
- **Compliance suite prompt count.** Starting at 10; expand only if variance is high.
