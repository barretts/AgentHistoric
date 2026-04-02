# Agent Instructions

- `compiled/` directories are generated artifacts and are out of scope for agent instruction loading.
- Do not load or apply any `AGENTS.md` files located under `compiled/`.
- Ignore `compiled/` directory contents unless a user explicitly asks to edit those files.

## Project Architecture

This is a Mixture-of-Experts prompt generation system. The canonical source is `prompt-system/` (JSON). Renderers in `scripts/lib/` transform JSON into IDE-specific rule files across 6 output targets.

### Key Conventions

- Every expert JSON in `prompt-system/experts/` must have a `behavioralGuardrails` array with at least one Failure Mode → Rule → Anti-Over-Correction triple.
- Renderers (`render-rich.mjs`, `render-sparse.mjs`, `render-codex.mjs`) emit a "Behavioral Guardrails" section for every expert.
- After any change to `prompt-system/` or `scripts/lib/render-*.mjs`, run `npm run build:prompts && npm run test:unit` to rebuild and verify.
- 32 unit tests across 3 test files validate frontmatter, structural sections, expert cross-references, guardrail completeness, token budgets, behavioral assertions, and artifact sync.
