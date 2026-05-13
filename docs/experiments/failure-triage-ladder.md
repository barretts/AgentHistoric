# Failure Triage Ladder

Use this ladder when model-update validation finds philosopher drift. Start at the top and stop at the first action that fits the evidence.

## 1. Fixture ambiguity

Choose this when the prompt is genuinely multi-expert and the alternate expert is defensible.

- **Action:** add or update `ambiguousBetween` in `regression/fixtures/cases.json`.
- **Evidence:** multiple strong domains are present; real models split between acceptable experts; answer quality remains in-scope.
- **Avoid:** forcing one expert when the prompt itself is underspecified.

## 2. Narrow boost signal

Choose this when one expert is consistently under-selected for a clear domain phrase.

- **Action:** add a targeted `boostSignals` entry in `prompt-system/router.json`.
- **Evidence:** repeated misses share a phrase that should raise confidence for the expected expert.
- **Avoid:** broad synonyms that steal unrelated traffic.

## 3. Anti-trigger

Choose this when an expert is clearly over-selected for prompts that contain a misleading positive signal.

- **Action:** add a narrow `antiTriggers` entry or negative routing example.
- **Evidence:** the same wrong expert wins because one word dominates the real model's interpretation.
- **Avoid:** global penalties for an expert, especially Descartes, unless trace evidence distinguishes healthy routing from over-routing.

## 4. Expert guardrail adjustment

Choose this when routing is correct but the response violates the selected expert's method, output contract, guardrails, or verification discipline.

- **Action:** update that expert's `behavioralGuardrails`, `failureSignals`, or required sections in `prompt-system/experts/*.json`.
- **Evidence:** selected expert is correct; output shows repeated behavioral drift such as gold-plating, unsupported success claims, missing measurement, or persona blending.
- **Avoid:** router changes for behavior problems after routing succeeded.

## 5. New regression fixture

Choose this when traces reveal a recurring prompt shape that is not covered by existing suites.

- **Action:** add a fixture case to `regression/fixtures/cases.json` and include it in the smallest relevant suite.
- **Evidence:** distribution-shift analysis flags repeated novel prompts, or trace analysis shows repeated failures outside existing coverage.
- **Avoid:** adding one-off user phrasing that does not represent a stable task class.

## 6. Ablation or rewrite

Choose this when prompt length, concision, or compliance regresses after a model update.

- **Action:** run `scripts/run-ablation.mjs` and rewrite or remove sections only when measured deltas justify it.
- **Evidence:** pass^k, behavioral metrics, or concision worsens across real-model trials.
- **Avoid:** aesthetic prompt pruning without measured benefit.

## Safety hierarchy

Prefer the least invasive fix that explains the evidence:

1. Fixture ambiguity or expectation correction.
2. Narrow boost signal.
3. Narrow anti-trigger.
4. Expert-specific guardrail rewrite.
5. New regression fixture.
6. Broad router restructuring.

After any prompt-system or renderer change, run:

```bash
mkdir -p .logs
npm run build:prompts > .logs/triage-build-prompts-1.log 2>&1
npm run test:unit > .logs/triage-test-unit-1.log 2>&1
```
