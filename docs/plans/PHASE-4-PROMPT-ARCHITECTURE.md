# Phase 4: System Prompt Architecture

**Depends on:** Phase 2 (Behavioral Guardrails) + Phase 3 (Test Infrastructure)
**Produces:** Restructured system.json with explicit behavioral stack, constraint inheritance rules, model-version markers
**Validates with:** Smoke tests (Phase 3) + regression suite + manual review

---

## Goal

Restructure how the system prompt is assembled to follow the layered behavioral stack from doc-01 Section 1. Currently `system.json` has `globalRuntime` as a flat collection of rules. The research shows that behavioral engineering works best as a layered constraint system where each layer restricts but never expands the layer below.

---

## Implementation Plan

### Step 4.1: Add Explicit Constraint Inheritance to system.json

Add a new top-level field to `system.json`:

```json
{
  "constraintHierarchy": {
    "description": "Each layer restricts but never expands the constraints of the layer below. An expert cannot override a globalRuntime rule. The router cannot override a globalRuntime mandate.",
    "layers": [
      {
        "name": "Global Runtime",
        "source": "system.json → globalRuntime",
        "scope": "All experts, all contexts",
        "overridable": false
      },
      {
        "name": "Router",
        "source": "router.json",
        "scope": "Routing decisions and pipeline sequencing",
        "overridable": false
      },
      {
        "name": "Expert Persona",
        "source": "experts/*.json",
        "scope": "Active expert only",
        "overridable": "by globalRuntime and router rules only"
      }
    ],
    "invariant": "No expert prompt may contain instructions that contradict globalRuntime rules. If a conflict exists, globalRuntime wins."
  }
}
```

**Files changed:** `prompt-system/system.json`

### Step 4.2: Render the Constraint Hierarchy

In `render-rich.mjs`, add a brief constraint inheritance statement to the init prompt, between the header and Section 1:

```
## Constraint Hierarchy

These rules are ordered by precedence. Expert-specific rules cannot override global mandates.
Rules from the active expert restrict but never expand the constraints above.
```

This is a short addition (~30 tokens) that makes the precedence explicit to the model.

**Files changed:** `scripts/lib/render-rich.mjs` (in `renderRichInit()`)

### Step 4.3: Add Model-Version Markers to Source JSON

Add `@[MODEL_TUNING]` markers as comments in the expert JSON files to flag model-sensitive prompt sections. Since JSON doesn't support comments, use a convention: add a `_modelTuning` field to any object that is model-sensitive.

```json
{
  "voice": [
    "Lead with the answer or the single most important clarifying question.",
    "Be direct, dense, and terse without filler.",
    "Keep explanations between actions to <=30 words unless the task requires detail."
  ],
  "_modelTuning": {
    "voice[2]": "Numeric anchor calibrated for Claude 4.x / GPT-5.x. Re-evaluate word count target on model upgrade.",
    "behavioralGuardrails": "Anti-gold-plating rules tuned for models that over-engineer. If a future model under-engineers, reduce guardrail strength."
  }
}
```

These markers are NOT rendered into output. They are documentation for humans reviewing the prompt source. The renderers skip any field starting with `_`.

**Files changed:** Expert JSONs that have model-sensitive content (at minimum Peirce, Popper)

### Step 4.4: Add Numeric Anchors to Remaining Experts

Phase 2 adds a numeric anchor to Peirce. This step propagates appropriate numeric anchors to other experts:

| Expert | Numeric Anchor |
|--------|---------------|
| Descartes | "Keep the Assumptions section to <=5 items. Each assumption should be one sentence." |
| Popper | "Keep each Hypothesis statement to one sentence. Reproduction steps should be <=10 lines of commands." |
| Dennett | "Generate exactly 3 drafts unless the user specifies otherwise." |
| Rogers | "Keep the Felt Experience section to <=3 sentences from the user's perspective." |
| Blackmore | "Keep the Solution Pattern to <=100 words. A pattern that can't be stated concisely isn't a pattern." |

These are already partially implied by the output contracts but making them numeric gives the model a concrete target.

**Files changed:** Expert JSONs where numeric anchors apply

### Step 4.5: Add a Smoke Test for Constraint Consistency

In `scripts/lib/prompt-smoke.test.mjs`, add a test that validates no expert JSON contains rules that contradict globalRuntime:

```javascript
test("no expert contradicts globalRuntime encoding rules", () => {
  for (const expert of system.experts) {
    const allText = JSON.stringify(expert).toLowerCase();
    // Example: globalRuntime bans emojis. No expert should instruct emoji use
    // (except Rogers, who has an explicit exception).
    if (expert.id !== "expert-ux-rogers") {
      assert.ok(!allText.includes("use emoji"), `${expert.id} contradicts emoji ban`);
    }
  }
});
```

This is a starting point. More constraint checks can be added as invariants are formalized.

**Files changed:** `scripts/lib/prompt-smoke.test.mjs`

---

## Validation Criteria

- [ ] `system.json` has a `constraintHierarchy` field documenting the 3-layer stack
- [ ] Init prompt renders the constraint hierarchy statement
- [ ] At least 2 expert JSONs have `_modelTuning` markers
- [ ] At least 5 experts have numeric anchors in `voice[]` or `behavioralGuardrails`
- [ ] Smoke test for constraint consistency passes
- [ ] `npm run test:unit` passes
- [ ] `npm run build:prompts` produces clean output
- [ ] Regression smoke suite shows no score drops

---

## Risk

**Constraint hierarchy as a prompt instruction vs mechanical enforcement:** The hierarchy is stated in natural language, not enforced by code. A model could still violate it. This is acceptable -- the research shows that stated constraints are effective even without mechanical enforcement, and our MoE architecture doesn't have runtime tool execution where mechanical enforcement would apply.

**_modelTuning field bloat:** These markers should be brief. If they grow beyond 2-3 lines per expert, extract to a separate tracking document.
