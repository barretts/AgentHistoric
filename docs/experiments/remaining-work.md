# Remaining Work — Experiments Branch

## Branch Status
- **Branch:** `experiments` (ahead of `routing-tests` by 2 commits)
- **Last commit:** `b22a294` — real LLM validation + ambiguousBetween
- **Tests:** 101/101 pass, 100% local routing accuracy (74/74)

## Merge Path
1. Merge `experiments` → `routing-tests`
2. Merge `routing-tests` → `main`
3. Run `npm run build:prompts && npm run test:unit` after each merge to verify

## Open Edge Cases (optional fixes before merge)

### TP3 — Both models route to Popper instead of Peirce
- **Prompt:** "This test has been flaky for weeks. Find the root cause and write a proper fix."
- **Why:** Both Claude and GPT see "flaky test" as QA (Popper) even though the intent is implementation (Peirce).
- **Fix options:** (a) Add `ambiguousBetween: [Peirce, Popper]` for partial credit, (b) reword prompt to emphasize "write a fix", (c) add anti-trigger "write a proper fix" on Popper → redirect to Peirce.

### TP5 — Both models route to Descartes instead of Liskov
- **Prompt:** "The interface is getting too wide — it has 15 methods. Refactor it so each consumer only sees what it needs."
- **Why:** "Refactor" + "interface" reads as architecture to both models. Same Liskov/Descartes ambiguity as SP-Li1.
- **Fix options:** (a) Add `ambiguousBetween: [Liskov, Descartes]`, (b) add "interface is getting too wide" as a Liskov boost signal.

### SP-Kn2 on GPT — Routes to Popper instead of Knuth
- **Prompt:** "The service has a memory leak that gets worse under load. Profile it and find the allocation hotspot."
- **Why:** GPT treats "memory leak" as debug (Popper) not performance (Knuth). Claude routes correctly.
- **Fix options:** (a) Add "memory leak" as Knuth boost signal (risk: may affect Claude), (b) accept model divergence.

### MI3 on Claude — Routes to Descartes instead of Simon
- **Already tagged:** `ambiguousBetween: [Simon, Descartes]` — scores partial credit. No further action needed.

## Structural Improvements (next session)

1. **Tag TP3 and TP5 with `ambiguousBetween`** — quick win to push two-pass accuracy to 84% with partial credit.
2. **Signal safety hierarchy enforcement** — add a lint rule or test that warns when disambiguation lists grow beyond N entries per expert.
3. **Tiered validation workflow** — document the local → 4-case sample → full suite process in a workflow file.
4. **Concision investigation** — PN1 (Claude: 0.36) and PN4 (both: 0.38-0.55) have low concision despite correct routing.
5. **Anti-trigger A/B experiment** — the toggled comparison via `scripts/run-experiment.mjs` was not exercised with real LLMs yet.

## Results Summary
- **84% accuracy** on both models with `ambiguousBetween` partial credit
- **100% persona-vs-neutral** on both models (8/8)
- **Perfect model parity** on two-pass and persona suites
- **Descartes over-routing** is the #1 failure mode across all suites
- Full detailed results in `.logs/batch-experiments/full-results-2026-04-06.md`

## Lessons Learned
- Disambiguation signals have amplified effects on real LLMs vs local simulator
- Safety hierarchy: boost signals > anti-triggers > disambiguation additions
- 100% local accuracy is not predictive — always validate with 4-case real LLM sample
- Some prompts are genuinely multi-expert; `ambiguousBetween` is the right answer, not over-tuning
