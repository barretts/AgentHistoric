# Expert Effectiveness and Baseline Evaluation Roadmap

Build an evidence program that proves whether AgentHistoric experts are used, improve outcomes over neutral baselines, and are worth maintaining as a routing-and-workflow system.

## Context from the codebase

- Existing assets already support much of this: `scripts/run-regressions.mjs`, `scripts/run-experiment.mjs`, `scripts/run-ablation.mjs`, `scripts/run-batch-experiment.mjs`, `scripts/analyze-traces.mjs`, `scripts/run-compliance-audit.mjs`, `regression/fixtures/cases.json`, and `regression/ablation-manifest.json`.
- Existing suites cover routing accuracy, expert diversity, specialist pressure, mixed intent, two-pass routing, adversarial verification, persona-vs-neutral, and model parity.
- Prior results in `docs/experiments/full-results-2026-04-06.md` show the right style of report, but the current evidence is still more like validation than a durable product-quality dashboard.
- There is trace support for offline evals, but no explicit production usage telemetry proving which experts are used during real sessions.

## Decision questions

1. **Are experts being used?** Track selected expert distribution, handoffs, unused experts, over-selected experts, and drift by model/target.
2. **Are experts effective?** Measure score, pass@k, pass^k, routing consistency, section compliance, concision, over-engineering, false claims, diagnostic discipline, and judge-rubric quality per expert.
3. **Is the workflow prompt better than baseline?** Compare full AgentHistoric prompts against neutral/no-expert/control prompts on identical tasks and models.
4. **Are experts worth maintaining?** Combine usage, lift, maintenance cost, token cost, and failure rate into a keep/rewrite/merge/deprecate scorecard.

## Phase 1: Define the evidence scoreboard

Create a concise `docs/experiments/expert-effectiveness-dashboard.md` report format that can be regenerated from logs.

Metrics to include:

- **Usage:** selected count by expert, expected count by expert, actual/expected ratio, unused experts, top over-routed experts.
- **Routing quality:** exact match, ambiguous partial credit, model parity, target parity, hard-case pass rate.
- **Behavior quality:** score distribution, pass@k, pass^k, concision, over-engineering, false-claim findings, diagnostic-before-fix findings.
- **Workflow lift:** full prompt vs neutral baseline delta, per-suite delta, per-expert delta.
- **Cost:** rendered bytes/tokens by target, real-model call count, estimated eval cost, maintenance churn.

Useful first gate:

- Keep an expert if it has meaningful usage or high lift on a domain-specific suite.
- Rewrite an expert if usage is healthy but score is weak.
- Merge or deprecate an expert if usage is near-zero and neutral/broader experts match its quality.

## Phase 2: Add real usage instrumentation

The repo can currently evaluate fixtures, but it does not yet prove real-world usage. Add opt-in trace/telemetry-style records for local use.

Implementation idea:

- Extend trace records from `scripts/lib/tracer.mjs` to include:
  - rendered target and model
  - selected expert
  - explicit handoffs
  - matched routing heuristic or disambiguation reason, when available
  - prompt category or suite when known
  - prompt hash only, not raw user content, for privacy by default
- Add `scripts/analyze-expert-usage.mjs` to aggregate traces into:
  - expert distribution
  - route entropy / collapse risk
  - stale experts with no selections
  - frequent cross-expert confusion pairs
  - target/model differences

Outcome:

- A concrete answer to “which experts are actually used?”
- Early detection of expert collapse into Peirce, Popper, or Descartes.

## Phase 3: Strengthen baseline comparisons

The current `persona-vs-neutral` suite is a good start but too small to prove overall workflow lift.

Add three baseline modes:

1. **Neutral baseline:** same user prompt, generic assistant instructions, no expert roster.
2. **Router-only baseline:** routing rules present, but expert persona files omitted or minimized.
3. **Single-generalist baseline:** one generic coding expert prompt with no MoE routing.

Use identical cases, model, target, and trials for each condition.

Recommended command shape after implementation:

```bash
node scripts/run-baseline-comparison.mjs --suite effectiveness --targets cursor,codex --trials 3 --baseline neutral,router-only,generalist
```

Report deltas:

- exact expert match is not meaningful for neutral baseline; compare task-quality rubric scores instead.
- use LLM-judge rubrics from `scripts/lib/eval-judge.mjs` plus code-based behavioral assertions.
- show per-suite and per-expert lift over baseline.

Outcome:

- A direct answer to “is the workflow prompt an improvement over baseline?”

## Phase 4: Expand the fixture set around expert value

Add an `effectiveness` suite that tests each expert against tasks where the expert should outperform a neutral or neighboring expert.

Suggested case families:

- **Peirce:** targeted implementation without gold-plating.
- **Popper:** falsification, failure isolation, no unsupported success claims.
- **Descartes:** assumptions, trust boundaries, failure modes before implementation.
- **Liskov:** stable interfaces, substitutability, consumer-specific boundaries.
- **Knuth:** measurement before optimization, bottleneck localization.
- **Shannon:** context compression without losing decision-critical signal.
- **Simon:** sequencing, gates, rollback, stopping conditions.
- **Dijkstra:** invariants, concurrency, state machines, proof obligations.
- **Rogers:** accessibility, cognitive load, user harm reduction.
- **Dennett:** meaningfully distinct alternatives, not cosmetic option lists.
- **Blackmore:** pattern extraction and reusable automation without premature abstraction.
- **Crawford:** deliberate manual review when automation would destroy judgment.

Each expert should get at least:

- 2 clear positive cases
- 1 near-neighbor confusion case
- 1 negative-routing case
- 1 neutral-baseline comparison case

Outcome:

- Every expert has a measurable reason to exist.

## Phase 5: Turn ablations into maintenance decisions

Use `scripts/run-ablation.mjs` and `regression/ablation-manifest.json` to answer which prompt sections earn their token cost.

Near-term ablations:

- `behavioral-guardrails`
- `expert-philosophy`
- `failure-signals`
- `voice-calibration`
- `uncertainty-rules`
- `foundational-constraints`

Add expert-level ablations:

- remove one expert from the roster and route its cases to nearest neighbors
- compress one expert to output contract + guardrails only
- compare current expert prompt vs neutralized version with the same headings

Decision rules:

- **Keep:** clear quality lift or prevents specific regressions.
- **Rewrite:** positive intent but weak measurable lift.
- **Compress:** same quality with fewer tokens.
- **Merge/deprecate:** no usage and no lift over neighboring expert.

## Phase 6: Fix known evaluation gaps first

Prioritize these fixes before large feature work:

1. **AV3 real-model routing failure:** all tested surviving branches routed adversarial concurrency verification to Dijkstra instead of Popper. Decide whether this should be accepted as ambiguous or fixed with stronger “adversarial tester / verify under load” Popper routing.
2. **Expected expert trace bug:** `buildTrace()` currently appears to derive `expectedExpert` from selected/routingMatch state instead of the fixture’s expected expert. Fix before relying on trace analytics.
3. **Baseline suite too small:** expand beyond `PN1-PN4`; current persona-vs-neutral coverage is not enough to prove workflow lift.
4. **Usage data absent:** add opt-in trace aggregation before claiming experts are used in practice.
5. **Dashboard missing:** reports exist, but there is no single “expert health” view.

## Phase 7: Add user-facing reports and badges

Create stable artifacts that make maintenance decisions visible:

- `docs/experiments/expert-health-latest.md`
- `docs/experiments/baseline-comparison-latest.md`
- `docs/experiments/usage-distribution-latest.md`
- `docs/experiments/ablation-latest.md`

Optional site feature:

- Add an “Evidence” section to the site with expert health cards:
  - used in N eval cases
  - selected in X% of traces
  - lift over neutral baseline
  - known failure modes
  - maintenance verdict

Outcome:

- Users can see that AgentHistoric is evidence-driven, not just persona-themed.

## Suggested first milestone

Implement a small vertical slice before building the whole system:

1. Add an `effectiveness` fixture suite with 2 cases per expert.
2. Add neutral baseline mode for those cases.
3. Run `cursor` with 3 trials on current `debulk-heavy`.
4. Produce one markdown scorecard with usage, lift, and keep/rewrite recommendations.
5. Use the result to decide whether to expand to full dashboard and telemetry.

## Definition of done

- A repeatable command can answer: “Which experts were selected, how often, and did they help?”
- Baseline comparison shows whether full AgentHistoric beats neutral/generalist prompts on task quality, not just routing structure.
- Every expert has a documented keep/rewrite/merge/deprecate rationale.
- Known hard failures like `AV3` are either fixed or explicitly tagged as acceptable ambiguity.
- Results are saved as durable markdown under `docs/experiments/`, with raw JSON/logs under `.logs/`.
