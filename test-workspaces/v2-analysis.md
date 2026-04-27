# V2 Analysis: Self-Contained Prompt Model Comparison

**Run ID:** persona-prompting-model-comparison-v2  
**Prompt:** "Design the data model and trust boundaries for a user notification system that supports email, SMS, and push channels with per-user preferences and rate limiting."  
**Date:** 2026-03-26  
**Global rules:** Hidden during run (~/.cursor/rules, ~/.codex backed up and restored)

## Experimental Design

Same three rule conditions as V1:
- **Sparse:** GPT-optimized explicit structural scaffolding
- **Rich + Preamble:** Full philosophical narrative with GPT adaptation preamble
- **Rich Pure:** Full philosophical narrative, no adaptation hints

Same six models as V1.

Key change: Self-contained prompt eliminates the "what feature?" confound from V1.

## Timing (seconds)

| Model | Sparse | Rich-Preamble | Rich-Pure |
|-------|--------|---------------|-----------|
| GPT 5.4 Medium | 63.5 | 70.0 | 68.3 |
| GPT 5.1 | 52.6 | 46.0 | 52.3 |
| GPT 5.4 Nano | 18.8 | 19.3 | 19.2 |
| Claude 4 Sonnet | 36.1 | 30.6 | 25.6 |
| Grok 4.20 | 37.8 | 33.8 | 26.2 |
| Gemini 3.1 Pro | 28.4 | 28.6 | 28.2 |

## V1 → V2 Delta

Every model now produces full, substantive output in all 3 conditions. The V1 confound was dominant:

- **Gemini:** V1 refused in all 3 conditions → V2 full Descartes-contract output with TS types, circuit breakers, DLQs
- **Nano:** V1 identical "I need more info" across all conditions → V2 differentiated output with labeled indices, TS schemas, trust boundaries
- **Claude rich-preamble:** V1 clarifying question only → V2 full design with categorized assumptions (Data/Network/User/Trust)

## Condition Differences

With the confound removed, persona differences are subtler but real — they appear in framing, epistemic stance, and reasoning style:

### Claude 4 Sonnet
- **Sparse:** Numbered lists, "Router Decision: expert-architect-descartes", procedural tone. 36s.
- **Rich-preamble:** "stripping away assumptions and building on bedrock principles" — philosophy in the framing. Categorized assumptions by type. 30.6s.
- **Rich-pure:** "from first principles" framing, versioned preferences, most streamlined. Fastest at 25.6s.

### GPT 5.4 Medium
- **Sparse:** HYPOTHESIS labels, CreateNotificationIntent single-entry-point design. 63.5s.
- **Rich-preamble:** VERIFIED by requirements + HYPOTHESIS with explicit refutation criteria ("Refute by showing…"). Most epistemic.
- **Rich-pure:** Added confidence percentages (85%/70%) and encryption-at-rest mentions. Uncertainty quantification emerged only under rich-pure.

### Gemini 3.1 Pro
- **Sparse:** Clean enumeration, Trust Boundaries as numbered zones, TS types.
- **Rich-preamble:** Paired assumption↔failure↔fallback by number. Contact status state machines.
- **Rich-pure:** "This is false." — explicitly negates its own assumptions. Most Cartesian doubt behavior of any output across all 36 runs.

### Grok 4.20
- **Sparse:** Challenged assumptions with italicized rebuttals. Tried to mkdir -p .logs (following logging protocol literally).
- **Rich-preamble:** Practical, direct. Clean TS schemas.
- **Rich-pure:** Most concise + fastest (26.2s). Privacy-first defaults, opt-in by default.

### GPT 5.1
- **Sparse:** Fail-closed preference enforcement, critical vs non-critical split. Most detailed TS schema.
- **Rich-preamble:** Similar depth, slight rewording.
- **Rich-pure:** Trust model section with explicit VPC/external distinction, PII isolation emphasis.
- Most condition-invariant of the full-size models.

### GPT 5.4 Nano
- **Sparse:** Full Descartes contract, sub-bulleted failure modes.
- **Rich-preamble:** Labeled indices (A1-A4, F1-F8, B1-B8) — most mechanically structured output of any model/condition.
- **Rich-pure:** Natural enumeration, idempotency focus.
- Now shows measurable condition differentiation. V1's "category 4: absent" was wrong.

## Revised Taxonomy

V1's four-category taxonomy revised based on V2 data:

| Category | V1 Label | V2 Reality | Models |
|----------|----------|------------|--------|
| 1 | Semantic Activator | **Framing Shifter** — persona changes epistemic stance and reasoning style | Claude, Gemini (rich-pure) |
| 2 | Template Follower | **Contract Filler** — persona parsed as output format instruction, rich-pure can still shift voice | GPT 5.4, GPT 5.1 |
| 3 | Chain-Mediated | **Agentic Interpreter** — persona influences tool use and workflow | Grok |
| 4 | Absent | **Eliminated** — Nano and Gemini both show persona sensitivity with substantive prompts | — |

## Key Insight

Persona prompting's effect is on framing, epistemic stance, and reasoning quality — not on whether the model produces output. V1 conflated "model can't respond to a vague prompt" with "model can't respond to persona steering."

Strongest single signal: Gemini rich-pure saying "This is false" about its own assumptions — methodological doubt emerging from the Descartes persona in a model that refused to engage at all in V1.
