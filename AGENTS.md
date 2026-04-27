# Agent Instructions

- `compiled/` directories are generated artifacts and are out of scope for agent instruction loading.
- Do not load or apply any `AGENTS.md` files located under `compiled/`.
- Ignore `compiled/` directory contents unless a user explicitly asks to edit those files.

## Project Architecture

This is a Mixture-of-Experts prompt generation system. The canonical source is `prompt-system/` (JSON). Renderers in `scripts/lib/` transform JSON into IDE-specific rule files across 6 output targets.

## Key Conventions

- Every expert JSON in `prompt-system/experts/` must have a `behavioralGuardrails` array with at least one Failure Mode → Rule → Anti-Over-Correction triple.
- Renderers (`render-rich.mjs`, `render-codex.mjs`) emit a "Behavioral Guardrails" section for every expert.
- A **Renderer Protocol** (documented in `build-prompt-system.mjs`) defines the semantic invariants every render target must satisfy. Cross-target equivalence tests (`PROTOCOL:` prefix in `prompt-smoke.test.mjs`) enforce parity between the rich and codex render paths.
- After any change to `prompt-system/` or `scripts/lib/render-*.mjs`, run `npm run build:prompts && npm run test:unit` to rebuild and verify.

## Further Reading

For routing-evolution features (negative routing, diversified heuristics, two-pass refinement, deliberation council, adversarial verification, model parity), see `README.md` and `CLAUDE.md` in this directory. The router data lives in `prompt-system/router.json`; the regression cases that exercise each feature live under suite tags in `regression/fixtures/cases.json` (`negative`, `diversity`, `twopass`, `council`, `verification`, `model-parity`).
