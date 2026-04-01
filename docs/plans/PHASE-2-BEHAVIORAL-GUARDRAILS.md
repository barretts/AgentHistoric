# Phase 2: Behavioral Guardrails

**Depends on:** Phase 1 (Gap Analysis)
**Produces:** Updated expert JSONs with behavioral guardrails, updated renderers, rebuilt prompts
**Validates with:** Existing regression suite (no regressions) + manual review of generated output

---

## Goal

Apply the "Failure Mode -> Rule -> Anti-Over-Correction" triple pattern from doc-01 Section 18, Pattern 1 to the 11 expert JSONs. Also add numeric length anchors and the four quick-win guardrails identified in Phase 1.

---

## Implementation Plan

### Step 2.1: Define the `behavioralGuardrails` Schema

Add a new optional field to each expert JSON:

```json
{
  "behavioralGuardrails": [
    {
      "failureMode": "Gold-plating: adds features, refactoring, or improvements beyond what was asked",
      "rule": "Don't add features, refactor code, or make improvements beyond what was asked. A bug fix doesn't need surrounding code cleaned up.",
      "antiOverCorrection": "Don't leave work half-finished to avoid gold-plating. Complete what was asked to full working state."
    }
  ]
}
```

Each guardrail is a triple: the observed failure mode, the rule that prevents it, and the guard against over-correcting.

**Files changed:** Expert JSON schema (documented in this plan, no formal schema file exists).

### Step 2.2: Populate Peirce (First Expert)

`prompt-system/experts/expert-engineer-peirce.json` gets these guardrails:

| Failure Mode | Rule | Anti-Over-Correction |
|-------------|------|---------------------|
| Gold-plating: adds features beyond the ask | Don't add features, refactor code, or make improvements beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability. | Don't leave work half-finished to avoid gold-plating. Complete what was asked to a full working state. |
| Premature abstraction | Don't create helpers, utilities, or abstractions for one-time operations. Three similar lines of code is better than a premature abstraction. | When genuine duplication spans three or more call sites, extract the shared logic. |
| Phantom error handling | Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries. | At actual system boundaries (user input, external APIs, untrusted data), validate thoroughly. |
| Comment noise | Default to writing no comments. Only add one when the WHY is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug. | Don't remove existing comments unless you're removing the code they describe or know they're wrong. |
| Blind retry / premature abandonment | If an approach fails, diagnose why before switching tactics. Read the error, check assumptions, try a focused fix. Don't retry blindly. | Don't abandon a viable approach after a single failure either. Escalate only after genuine investigation. |
| Scope creep via approval extrapolation | Match the scope of your actions to what was actually requested. A user approving an action once does not authorize it in all contexts. | When the user's request clearly implies related changes (e.g., "rename this function" implies updating call sites), include them. |

Also add numeric anchor to `voice[]`:
```json
"Keep explanations between actions to <=30 words unless the task requires detail."
```

**Files changed:** `prompt-system/experts/expert-engineer-peirce.json`

### Step 2.3: Populate Popper (QA Expert -- Highest Behavioral Leverage)

`prompt-system/experts/expert-qa-popper.json` gets:

| Failure Mode | Rule | Anti-Over-Correction |
|-------------|------|---------------------|
| Verification avoidance: reading code instead of running it | Reading code is not verification. Run the test, execute the script, check the output. No "the code looks correct" shortcuts. | When the environment genuinely prevents execution (no test runner, no build tool), state this explicitly rather than faking verification. |
| Seduced by the first 80% | After the happy path passes, test at least one adversarial probe: boundary values, concurrent access, idempotency, or orphan references. | Don't block on exhaustive edge-case coverage when the user asked for a targeted fix. Scale probing to the blast radius of the change. |
| False claims of success | Report outcomes faithfully. If tests fail, say so with the relevant output. If you did not run a verification step, say that rather than implying success. | Do not hedge confirmed results with unnecessary disclaimers. When a check passed, state it plainly. |
| Rationalization of skipped checks | Reject these rationalizations: "The code looks correct" (run it). "Tests already pass" (verify independently). "This is probably fine" (probably is not verified). "This would take too long" (not your call). | If a verification step is genuinely impossible in the current environment, state that as a known gap rather than rationalizing around it. |

**Files changed:** `prompt-system/experts/expert-qa-popper.json`

### Step 2.4: Populate Remaining Experts

Apply relevant guardrails to each expert. Not every expert needs every guardrail. Selection based on the expert's domain:

| Expert | Key Guardrails |
|--------|---------------|
| Descartes (Architect) | Gold-plating, premature abstraction, security awareness, scope creep |
| Liskov (Abstractions) | Premature abstraction (primary concern), gold-plating |
| Dijkstra (Formal) | Phantom error handling, premature abstraction |
| Dennett (Visionary) | Premature convergence (the anti-failure for an ideation expert), gold-plating on recommendations |
| Rogers (UX) | Scope creep into implementation details, gold-plating on UI suggestions |
| Blackmore (Manager) | Pattern over-extraction (finding patterns where none exist) |
| Knuth (Performance) | Premature optimization (the classic), gold-plating on benchmarks |
| Shannon (Information) | Over-compression (losing signal while reducing noise) |
| Simon (Orchestrator) | Over-orchestration (adding coordination where simple sequential execution suffices) |

**Files changed:** All 11 expert JSONs in `prompt-system/experts/`

### Step 2.5: Update the Renderers

#### render-rich.mjs

In `renderRichExpert()`, add a new section after "Failure Signals" and before "Allowed Handoffs":

```javascript
if (expert.behavioralGuardrails?.length) {
  section++;
  out += `## ${section}. Behavioral Guardrails\n\n`;
  for (const g of expert.behavioralGuardrails) {
    out += `**Failure mode:** ${g.failureMode}\n`;
    out += `**Rule:** ${g.rule}\n`;
    out += `**But:** ${g.antiOverCorrection}\n\n`;
  }
}
```

#### render-codex.mjs

In `renderSkill()`, add a Behavioral Guardrails section after Failure Signals:

```javascript
(expert.behavioralGuardrails?.length
  ? `\n\n## Behavioral Guardrails\n\n` +
    expert.behavioralGuardrails
      .map(g =>
        `- **Failure mode:** ${g.failureMode}\n  **Rule:** ${g.rule}\n  **But:** ${g.antiOverCorrection}`
      )
      .join("\n\n") + "\n"
  : "")
```

**Files changed:** `scripts/lib/render-rich.mjs`, `scripts/lib/render-codex.mjs`

### Step 2.6: Rebuild and Validate

```bash
npm run build:prompts
npm run test:unit          # Confirms generated artifacts match committed files
```

Then manually review:
- `dot-cursor/rules/expert-engineer-peirce.mdc` -- confirm guardrails section renders correctly
- `dot-cursor/rules/expert-qa-popper.mdc` -- confirm rationalization rejection list renders
- `dot-codex/skills/expert-engineer-peirce/SKILL.md` -- confirm Codex format

### Step 2.7: Run Existing Regression Suite

```bash
npm run test:regressions:smoke
```

Confirm no score regressions. The guardrails should not change routing behavior -- they add constraints to expert behavior, not routing signals.

---

## Validation Criteria

- [ ] All 11 expert JSONs have a `behavioralGuardrails` array (can be empty for experts where no guardrails apply)
- [ ] Peirce has >= 5 guardrail triples
- [ ] Popper has >= 4 guardrail triples including the named rationalization rejection list
- [ ] `npm run test:unit` passes
- [ ] `npm run build:prompts` produces clean output
- [ ] Generated `.mdc` and `.md` files contain the new "Behavioral Guardrails" section
- [ ] Regression smoke suite shows no score drops
- [ ] At least Peirce `voice[]` has a numeric length anchor

---

## Risk

**Over-constraining expert behavior:** Adding too many guardrails could make experts overly cautious. The anti-over-correction field mitigates this, but we should watch for hedging in regression outputs.

**Token budget:** Each guardrail triple adds ~40-60 tokens. With 5 guardrails per expert, that is 200-300 tokens added to each expert prompt. This is within budget for Cursor (which has generous context) but should be monitored for Codex (which is more constrained).
