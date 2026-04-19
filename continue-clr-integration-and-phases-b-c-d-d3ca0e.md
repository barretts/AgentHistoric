# Continue AgentHistoric: clr Linux port, A.6/X.7 validation, then Phases B/C/D

Port the hard-coded macOS clr paths to a Linux-aware env-var, create the missing `agent-print` / `claude-print` profiles, validate the end-to-end clr pipeline on smoke and 8 fixed routing cases, then execute the remaining roadmap (Phase B ablation, Phase C verbalized sampling + variable substitution, Phase D report).

Routing: **Simon** (orchestrator) primary for plan sequencing; handoffs to **Peirce** (implementation), **Popper** (verification), **Knuth** (ablation measurement), **Dennett** (VS exploration), **Blackmore** (Phase D report).

---

## Preconditions verified

- `cli-runner-learner` built at `/home/barrett/code/cli-runner-learner/dist/cli.js`.
- `cursor-agent`, `claude`, `agent` all resolve via `/home/barrett/.local/bin/`.
- Wrappers executable: `@/home/barrett/code/AgentHistoric/scripts/clr-wrappers/agent-print.sh`, `@/home/barrett/code/AgentHistoric/scripts/clr-wrappers/claude-print.sh`.
- Working tree clean except the two plan docs. On branch `cli-integration`.
- 111/111 unit tests baseline (per progress doc, not re-verified yet — step 1 confirms).

## Known gaps to fix

1. `@/home/barrett/code/AgentHistoric/scripts/lib/clr-runner.mjs:25-27` hard-codes `/Users/ephem/lcode/cli-runner-learner` — must become `CLR_ROOT` env var with Linux default.
2. clr's `profiles/` dir has only `agent.json` / `claude.json`; `agent-print.json` / `claude-print.json` profiles (X.2) were never created on this machine.
3. Node 20.20.1 present. ✓

---

## Phase P — Port & Smoke (new, required first)

- **P.1** Verify baseline: `npm run build:prompts && npm run test:unit` → expect 111/111.
- **P.2** Port `@/home/barrett/code/AgentHistoric/scripts/lib/clr-runner.mjs:25-27`:
  ```js
  const CLR_ROOT = process.env.CLR_ROOT || "/home/barrett/code/cli-runner-learner";
  ```
  Add an `existsSync(CLR_CLI)` guard in `runCasesViaClr` that throws with a clear "run `npm install && npm run build` in CLR_ROOT" message if `dist/cli.js` is missing.
- **P.3** Create the two missing clr profiles by running `clr learn` (minimal, stub mode) OR by hand-authoring the JSON from the `_template.json` + existing `agent.json` / `claude.json` as references. Target files (outside this repo, created in clr's profiles dir):
  - `/home/barrett/code/cli-runner-learner/profiles/agent-print.json` → `interaction_mode: "args"`, command = absolute path to `agent-print.sh`.
  - `/home/barrett/code/cli-runner-learner/profiles/claude-print.json` → same, command = absolute path to `claude-print.sh`.
  Preference: hand-author to avoid burning API calls on `learn`.
- **P.4** Smoke-test profiles directly (no AH involvement): two-task manifest from `scripts/clr-wrappers/smoke-manifest.json`, confirm sentinel JSON extraction works.
- **P.5** X.7 validation: `npm run test:regressions:clr:smoke -- --targets cursor` then `--targets claude`. Inspect `.logs/clr-summary-*.md`. Fix any `claude-print.sh` stdout parse fragility here (per newer doc's open risk).
- **Gate:** P ends when both `cursor` and `claude` return parseable sentinel JSON for R1, R2, Q1, P1.

## Phase A.6 — Real-LLM spot-check (resume from pending)

- **A.6.1** Run the 8 fixed cases on both targets:
  ```bash
  node scripts/run-via-clr.mjs --targets cursor,claude \
    --case TP3,TP3b,TP5,TP5b,SP-Kn2,SP-Kn3,MI3,MI3b
  ```
- **A.6.2** Expected: ≥7/8 correct per target. Record exact misroutes in `.logs/clr-summary-*.md`.
- **A.6.3** If any regression slips, loop back: augment `prompt-system/router.json` disambiguation/negative rules, rebuild, rerun local + real-LLM.

## Phase B — Ablation + multi-trial (pending, per newer doc)

- **B.1** Add `--local` flag to `@/home/barrett/code/AgentHistoric/scripts/run-ablation.mjs` that swaps real-LLM spawning for `routePrompt(system, prompt)` producing `{ routingDecision: { selectedExpert } }`. Scoring path stays identical.
- **B.2** Local multi-trial baseline: 3 trials per smoke case via the local simulator. Asserts determinism (all 3 trials agree).
- **B.3** Dennett numeric-anchor experiment: add `"Keep each alternative draft to <=120 words."` to `@/home/barrett/code/AgentHistoric/prompt-system/experts/expert-visionary-dennett.json` voice. Add behavioral assertion + guardrail entry. Run local sim + unit tests.
- **B.4** Real-LLM ablation via clr on 3 largest sections (`logging-protocol`, `foundational-constraints`, `behavioral-guardrails`) × 3 trials × smoke suite × cursor target. Write KEEP/REVIEW/REMOVE verdicts into `.logs/ablation-*.md`.
- **Gate:** verdicts exist for all three sections.

## Phase C — Both VS experiments (per selected option)

### C-VS-a: Verbalized Sampling (older doc's Phase C)

- **CVS-1** Add `confidenceDistribution` to expected JSON schema at `@/home/barrett/code/AgentHistoric/scripts/lib/regression.mjs:85-117` (or current location — to be confirmed during implementation). Gate behind `experimentFlags.verbalizedSampling` in `prompt-system/router.json`.
- **CVS-2** A/B via clr on the 4 Descartes-attractor cases (TP5, SP-Li1, SP-Si1, SP-Si2) × both models. Metric: raw routing accuracy VS-on vs VS-off.
- **Ship criterion:** 3/4 correct on VS-on vs baseline misroutes.

### C-VS-b: Variable Substitution (newer doc's Phase C)

- **CVB-1** Add `vs` block to `prompt-system/` JSON with default variables (e.g., `project_name`, `primary_language`). Renderer substitutes from optional gitignored `prompt-system/project-overrides.json`; falls back to defaults for CI determinism.
- **CVB-2** Gate behind a `--vs` build flag. Add unit test covering render with/without overrides.
- **CVB-3** A/B ablation comparing VS-enabled vs default artifacts on smoke + twopass suites.
- **Ship criterion:** routing accuracy equal-or-better AND token savings >10%.

Ordering: CVS-a first (attacks a known routing bug), then CVB (token budget).

## Phase D — Report

- **D.1** Write `@/home/barrett/code/AgentHistoric/docs/plans/PHASE-7-IMPLEMENTATION-REPORT.md` (or `regression/reports/clr-integration-<date>.md` per newer doc — pick the former for continuity with Phase 5/6). Sections:
  - Before/after local simulator accuracy.
  - Before/after real-LLM accuracy per model (A.6 numbers).
  - clr integration architecture diagram + healing/checkpoint benefits measured.
  - Ablation verdicts for the 3 sections (B.4).
  - VS-a A/B delta + ship/no-ship.
  - VS-b token-savings delta + ship/no-ship.
  - Open follow-ups: concurrency>1 in clr-runner, claude stdout-format fragility, any new misroutes, `claude-print` native profile.
- Target length: 2–3 pages.

---

## Execution order & stopping conditions

1. **P.1 → P.5** must all pass before A.6. If P.5 fails on `claude`, adjust `claude-print.sh` (try `--output-format stream-json` per newer doc's risk note) and retry once; if still failing, defer `claude` target to an open follow-up and proceed with cursor-only.
2. **A.6** must achieve ≥7/8 on at least `cursor` before Phase B. If Claude is deferred, that's acceptable.
3. **Phase B** sub-steps in order B.1 → B.2 → B.3 → B.4. B.4 is gated on successful P.5.
4. **Phase C** C-VS-a first, then C-VS-b. C-VS-a is gated on A.6 producing clean baseline numbers.
5. **Phase D** only after B + C have written their artifacts.

Stop and ask the user if:
- Any routing fix in A.6 requires NEW disambiguation signals (may indicate a deeper prompt-system issue).
- Real-LLM cost projection exceeds ~150 calls (newer doc budgets ~90).
- A VS-a A/B shows no improvement — decide whether to ship the infra anyway.

## Risks & mitigations (inherited + new)

- **Transcript correlation at concurrency=1** — keep concurrency pinned; note in clr-runner comment if changed.
- **claude stdout noise** — already flagged; P.5 will surface it.
- **Sentinel instruction drift** — `decorateWrappedPromptForClr` and clr's SentinelAdapter both emit SENTINEL_INSTRUCTIONS. Pin to a shared constant if they diverge.
- **Negative-rule duplication** — `isNegativeMatch` in `regression.mjs` duplicates `router.json` phrases. Revisit if ruleset grows past ~10 per key.
- **New: profile-name mismatch.** If anyone later runs `clr learn --tool agent-print` with a different arg shape, it will overwrite the hand-authored profile. Add a comment in the profile JSON noting it was hand-authored.

## Deliverables

### Files created
- `/home/barrett/code/cli-runner-learner/profiles/agent-print.json`
- `/home/barrett/code/cli-runner-learner/profiles/claude-print.json`
- `@/home/barrett/code/AgentHistoric/docs/plans/PHASE-7-IMPLEMENTATION-REPORT.md`
- Several `.logs/clr-summary-*.md` and `.logs/ablation-*.md` run artifacts.

### Files modified
- `@/home/barrett/code/AgentHistoric/scripts/lib/clr-runner.mjs` (env-var port + existsSync guard)
- `@/home/barrett/code/AgentHistoric/scripts/run-ablation.mjs` (`--local` flag, `--runner clr` integration)
- `@/home/barrett/code/AgentHistoric/scripts/lib/regression.mjs` (VS schema, maybe ablation-local hook)
- `@/home/barrett/code/AgentHistoric/prompt-system/experts/expert-visionary-dennett.json` (numeric anchor)
- `@/home/barrett/code/AgentHistoric/prompt-system/router.json` (experimentFlags + VS-b defaults)
- `@/home/barrett/code/AgentHistoric/prompt-system/system.json` or new `prompt-system/variables.json` (VS-b variable defs)
- `@/home/barrett/code/AgentHistoric/scripts/build-prompt-system.mjs` (VS-b substitution pass)
- `@/home/barrett/code/AgentHistoric/scripts/lib/render-*.mjs` (VS-b template pass)
- `@/home/barrett/code/AgentHistoric/compiled/**` (rebuilt)
- `@/home/barrett/code/AgentHistoric/regression/fixtures/cases.json` (any new regression cases uncovered in A.6 fix loop)

### Files not touched
- `@/home/barrett/code/AgentHistoric/scripts/run-regressions.mjs` (codex path intact)
- `@/home/barrett/code/AgentHistoric/scripts/run-batch-experiment.mjs` (legacy, kept for reference)
- `/home/barrett/code/cli-runner-learner/src/**` (profiles are data; no source edits)

## Cost envelope (real-LLM calls)

| Phase | Calls | Notes |
|---|---:|---|
| P.4 (profile smoke) | ~4 | two tasks × two profiles |
| P.5 (X.7 smoke) | ~8 | 4 cases × 2 targets |
| A.6 | ~16 | 8 cases × 2 targets |
| B.4 | ~40 | 3 sections × 3 trials × 4 smoke cases + control |
| C-VS-a | ~24 | 4 cases × 3 trials × 2 targets × on/off |
| C-VS-b | ~16 | smoke+twopass × on/off × 1 target |
| **Total** | **~108** | within newer doc's ~90-100 estimate, +P buffer |

## Resume checklist (for the next session if paused mid-plan)

1. Re-check `git status` — anything beyond the two plan docs signals mid-session state.
2. Latest `.logs/clr-summary-*.md` tells which target + suite last ran.
3. If `dist/cli.js` missing in `CLR_ROOT`, run `npm install && npm run build` there.
4. `npm run test:unit` should always be 111+/111 green before resuming.
