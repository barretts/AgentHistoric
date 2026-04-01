# Phase 6: Ablation Testing

**Depends on:** Phase 4 (Prompt Architecture) + Phase 5 (Eval Maturity)
**Produces:** Ablation build mode, section-by-section impact measurement, ablation report
**Validates with:** Statistical comparison of with/without variants across multi-trial regression runs

---

## Goal

Build the capability to strip individual prompt sections and measure their contribution, inspired by the `ABLATION_BASELINE` flag from doc-02 Section 5. This answers the question: "Does this prompt section actually improve behavior, or is it dead weight consuming context tokens?"

---

## Implementation Plan

### Step 6.1: Ablation Manifest

Create `regression/ablation-manifest.json` that defines which sections can be ablated:

```json
{
  "sections": [
    {
      "id": "logging-protocol",
      "description": "Non-Destructive Logging Protocol (init sections 1-2)",
      "source": "system.json → globalRuntime.logging",
      "expectedImpact": "Logging compliance in debug/test scenarios"
    },
    {
      "id": "voice-calibration",
      "description": "Voice Calibration / Scaffolded Voice section",
      "source": "VOICE_CALIBRATION constant",
      "expectedImpact": "Output style (prose vs scaffolded)"
    },
    {
      "id": "foundational-constraints",
      "description": "Foundational Constraints (visual verification, ownership, stewardship, dependency investigation)",
      "source": "system.json → globalRuntime.foundationalConstraintsDetailed",
      "expectedImpact": "Code quality and investigation thoroughness"
    },
    {
      "id": "behavioral-guardrails",
      "description": "Behavioral Guardrails section from expert prompts",
      "source": "experts/*.json → behavioralGuardrails",
      "expectedImpact": "Over-engineering, gold-plating, false claims"
    },
    {
      "id": "uncertainty-rules",
      "description": "Epistemic Humility & uncertainty labeling rules",
      "source": "system.json → globalRuntime.uncertaintyRules",
      "expectedImpact": "VERIFIED/HYPOTHESIS labeling behavior"
    },
    {
      "id": "expert-philosophy",
      "description": "Core Philosophy section from expert prompts",
      "source": "experts/*.json → corePhilosophy",
      "expectedImpact": "Expert-specific reasoning approach"
    },
    {
      "id": "failure-signals",
      "description": "Failure Signals section from expert prompts",
      "source": "experts/*.json → failureSignals",
      "expectedImpact": "Avoidance of known failure patterns"
    }
  ]
}
```

**Files created:** `regression/ablation-manifest.json`

### Step 6.2: Ablation Mode in Build Script

Add `--ablation <section-id>` flag to `scripts/build-prompt-system.mjs`:

```bash
# Generate prompts WITHOUT the logging protocol
node scripts/build-prompt-system.mjs --ablation logging-protocol

# Generate prompts WITHOUT behavioral guardrails
node scripts/build-prompt-system.mjs --ablation behavioral-guardrails
```

When `--ablation` is set, the build passes an `ablation` option to the renderers. Each renderer checks `options.ablation` and skips the corresponding section.

Implementation in `render-rich.mjs`:

```javascript
export function renderRichInit(system, options = {}) {
  const g = system.globalRuntime;
  let out = "";
  // ... header ...

  if (options.ablation !== "logging-protocol") {
    // Section 1: Logging
    out += `## 1. The Non-Destructive Logging Protocol\n\n`;
    // ...
  }

  if (options.ablation !== "uncertainty-rules") {
    // Section 3: Epistemic rules
    out += `## 3. Epistemic Humility\n\n`;
    // ...
  }

  // ... etc
}
```

**Files changed:** `scripts/build-prompt-system.mjs`, `scripts/lib/render-rich.mjs`, `scripts/lib/render-codex.mjs`

### Step 6.3: Ablation Runner Script

Create `scripts/run-ablation.mjs` that orchestrates the full ablation cycle:

```
For each section in ablation-manifest.json:
  1. Build prompts with --ablation <section-id> to a temp directory
  2. Run regression suite with --trials 3 against the ablated prompts
  3. Build prompts without --ablation (control)
  4. Run regression suite with --trials 3 against the control prompts
  5. Compare pass^k, behavioral metrics, and score distributions
  6. Record the delta
```

Output: `regression/ablation-report-<timestamp>.json` with per-section deltas.

**Files created:** `scripts/run-ablation.mjs`

### Step 6.4: Ablation Report Renderer

Add a markdown renderer for the ablation report:

```markdown
# Ablation Report

| Section | Tokens Saved | pass^k Delta | Over-Engineering Delta | Concision Delta | Verdict |
|---------|-------------|-------------|----------------------|-----------------|---------|
| logging-protocol | ~350 | -0.04 | +0.00 | +0.00 | KEEP (marginal cost, supports logging behavior) |
| behavioral-guardrails | ~250 | -0.15 | -0.25 | +0.05 | KEEP (significant over-engineering reduction) |
| voice-calibration | ~120 | +0.00 | +0.00 | -0.08 | KEEP (measurable concision impact) |
| expert-philosophy | ~200 | +0.00 | +0.00 | +0.00 | REVIEW (no measurable impact) |
| failure-signals | ~100 | -0.02 | +0.00 | +0.00 | KEEP (small but positive) |
```

Verdict logic:
- **KEEP:** Section shows a measurable positive delta on any behavioral metric
- **REVIEW:** Section shows no measurable delta -- candidate for removal or rewriting
- **REMOVE:** Section shows a measurable negative delta (makes behavior worse)

**Files changed:** `scripts/lib/regression.mjs` (new `formatAblationReport()`)

### Step 6.5: Package Script

Add to `package.json`:

```json
{
  "scripts": {
    "test:ablation": "node scripts/run-ablation.mjs"
  }
}
```

**Files changed:** `package.json`

---

## Validation Criteria

- [ ] `regression/ablation-manifest.json` exists with >= 5 ablatable sections
- [ ] `--ablation <section-id>` flag works in the build script
- [ ] Ablated prompts are structurally valid (pass smoke tests minus the ablated section)
- [ ] `run-ablation.mjs` produces a comparison report
- [ ] At least one section shows a measurable delta (proving the methodology works)
- [ ] Report includes token savings, pass^k delta, and behavioral metric deltas
- [ ] Verdict logic correctly classifies KEEP/REVIEW/REMOVE

---

## Risk

**Cost:** Full ablation run = 7 sections x 14 cases x 3 trials x 2 (ablated + control) x 2 targets = 1,176 LLM API calls. At ~$0.05/call = ~$59/run. This is an infrequent operation (pre-release only), not a CI gate.

**Statistical significance:** With only 3 trials per condition, deltas smaller than ~0.15 are likely noise. Consider 5 trials for higher confidence, at proportionally higher cost.

**Section interdependence:** Ablating one section may change the behavior of another. Single-section ablation doesn't capture interactions. If needed, add pairwise ablation as a follow-up, but start with single-section for the initial assessment.

---

## Expected Outcomes

Based on the research findings and our prompt structure:

1. **behavioral-guardrails** should show the largest positive delta on over-engineering metrics. If it doesn't, the guardrails need rewriting.

2. **voice-calibration** should show a measurable concision impact, consistent with the V5 experiment results.

3. **expert-philosophy** is the most likely candidate for REVIEW. The philosophical grounding (Pragmatism, Fallibilism) may be stylistic flavor that doesn't measurably affect task completion.

4. **logging-protocol** is domain-specific. It should show impact only on cases that involve running commands. If the regression suite doesn't include command-execution cases, it will show no delta -- which is a signal to add such cases, not to remove the section.
