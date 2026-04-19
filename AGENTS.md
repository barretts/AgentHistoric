# Agent Instructions

- `compiled/` directories are generated artifacts and are out of scope for agent instruction loading.
- Do not load or apply any `AGENTS.md` files located under `compiled/`.
- Ignore `compiled/` directory contents unless a user explicitly asks to edit those files.

## Project Architecture

This is a Mixture-of-Experts prompt generation system. The canonical source is `prompt-system/` (JSON). Renderers in `scripts/lib/` transform JSON into IDE-specific rule files across 6 output targets.

### Key Conventions

- Every expert JSON in `prompt-system/experts/` must have a `behavioralGuardrails` array with at least one Failure Mode → Rule → Anti-Over-Correction triple.
- Renderers (`render-rich.mjs`, `render-codex.mjs`) emit a "Behavioral Guardrails" section for every expert.
- A **Renderer Protocol** (documented in `build-prompt-system.mjs`) defines the semantic invariants every render target must satisfy. Cross-target equivalence tests (`PROTOCOL:` prefix in `prompt-smoke.test.mjs`) enforce parity between the rich and codex render paths.
- After any change to `prompt-system/` or `scripts/lib/render-*.mjs`, run `npm run build:prompts && npm run test:unit` to rebuild and verify.
- 136 unit tests across 3 test files validate frontmatter, structural sections, expert cross-references, guardrail completeness, token budgets, behavioral assertions, routing evolution features, cross-target semantic equivalence, model-parity suite structure, variable substitution, and artifact sync.

### Routing Evolution Features

Five features enhance the routing layer. All are defined in `prompt-system/router.json` and rendered automatically into every target by the build system.

#### Negative Routing Examples (`negativeExamples`)

Anti-pattern rules that prevent common mis-routes. The router checks these *before* confirming a positive signal match.

- **Activation:** Automatic. The rendered "Routing Anti-Patterns" section appears in every router artifact. `routePrompt()` in `regression.mjs` enforces negative guards during local simulation.
- **Data:** `router.json` → `negativeExamples` with keys `doNotRouteToPeirce`, `doNotRouteToPopper`, `doNotRouteToDennett`.
- **Example:** The word "refactor" normally matches Peirce, but if the prompt also mentions "module boundaries" or "coupling," the negative guard redirects to Liskov.
- **Tests:** Cases NE1-NE4 in `cases.json` (`negative` suite). Unit tests verify the section renders in all router outputs.

#### Diversified Routing Heuristics (sub-domains)

Broad domains like "Pragmatic Implementation" and "Debug Firefighting" are split into granular sub-domains with specific lead experts, reducing Peirce/Popper over-selection.

- **Activation:** Automatic. The expanded `routingHeuristics` array (18+ entries, up from 13) is rendered into the routing heuristics table in every target.
- **Data:** `router.json` → `routingHeuristics`. New sub-domains include Test Failure Diagnosis, Build & Config Errors, Quick Fix & Patch, General Implementation, Refactoring & Restructuring, Test Authoring, and Runtime Error Investigation.
- **Disambiguation:** `router.json` → `disambiguation` now has 9 keys (added `routeToLiskov`, `routeToSimon`, `routeToShannon`, `routeToKnuth`, `routeToDescartes`) with explicit example phrases for underrepresented experts.
- **Tests:** Cases RB1-RB9 in `cases.json` (`diversity` suite). Unit tests verify heuristic count and sub-domain existence.

#### Progressive Two-Pass Routing (`refinementHeuristics`)

For ambiguous prompts, the router classifies the broad domain first, then refines to a specific expert based on task nuance.

- **Activation:** Automatic. The rendered "Two-Pass Routing Refinement" section instructs the model to state both the broad domain and the refined expert selection. A contract rule in `router.json` → `contracts` mandates two-pass routing for ambiguous requests.
- **Data:** `router.json` → `refinementHeuristics` with `description`, `contract`, and `refinements` array. Each refinement maps a broad domain to sub-domains with leads and signals.
- **Tests:** Cases TP1-TP3 in `cases.json` (`twopass` suite). Unit tests verify the section renders in all targets.

#### Deliberation Council Pipeline

A judge-mediated multi-expert pipeline for tasks that span multiple concerns. The router selects 2-3 experts, each contributes from their domain, and the router synthesizes a consensus.

- **Activation:** Triggered when router confidence is below 0.65 and 2+ domains match, or when the user explicitly requests multiple perspectives (e.g., "review from multiple angles"). The `autoTrigger` condition and `triggerSignals` are defined in the pipeline.
- **Data:** `router.json` → `pipelines` entry named "Deliberation Council" with 5 steps, `description`, `triggerSignals`, and `autoTrigger`.
- **Design rationale:** Based on ICLR 2025 findings that judge-mediated debate outperforms naive multi-agent debate. Convergence is mandatory; the final step names the lead expert for execution.
- **Tests:** Cases CC1-CC4 in `cases.json` (`council` suite). CC4 is a negative case (single clear domain, should NOT trigger council). Unit tests verify pipeline structure, trigger signals, and auto-trigger condition.

#### Adversarial Verification Pipeline (`Implement & Verify`)

After implementation, a separate adversarial verification step by Popper prevents the "I wrote it and it looks good to me" failure mode.

- **Activation:** Triggered for implementation tasks involving 3+ file edits, backend/API changes, or infrastructure changes. The pipeline is defined in `router.json` → `pipelines` entry named "Implement & Verify".
- **Data:** Popper's expert JSON (`expert-qa-popper.json`) has a `verificationContract` section with 7 rules. The contract requires running code (not just reading), testing boundary conditions, and issuing exactly one of `VERDICT: PASS` or `VERDICT: FAIL`.
- **Design rationale:** Inspired by Claude Code's verification agent pattern. Explicitly names rationalization patterns to reject.
- **Tests:** Cases AV1-AV3 in `cases.json` (`verification` suite). Unit tests verify the pipeline has a VERDICT step and the verification contract renders on Popper.

#### Model Parity Suite

A dedicated regression suite for tracking cross-model routing agreement. Cases are tagged with `expectedParity: true` (models should agree) or `expectedParity: false` (known divergence, documented with `parityNote`).

- **Data:** `cases.json` → `suites.model-parity` (13 cases). Cases with `expectedParity: false` include SP-Kn2 (GPT→Popper vs Claude→Knuth) and MI3 (Claude→Descartes vs GPT→Simon).
- **Usage:** `node scripts/run-regressions.mjs --suite model-parity`
- **Tests:** Unit tests verify suite structure, `expectedParity` field presence, and `parityNote` on divergent cases.
