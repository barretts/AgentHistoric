# V4 Analysis: Voice Calibration

**Run ID:** `persona-prompting-v4-voice-calibration`
**Date:** 2025-07-25
**Prompt:** "Design the data model and trust boundaries for a user notification system that supports email, SMS, and push channels with per-user preferences and rate limiting."

## Conditions

| Condition | Description |
|-----------|-------------|
| `rich-new` | Preamble-free rich rules (V3 winner) — baseline |
| `rich-voice` | `rich-new` + Voice Calibration section inserted between Epistemic Humility and Definition of Done |

**Voice Calibration text added:**
> - The output contract defines WHAT sections to produce. This section defines HOW to write within them.
> - Integrate reasoning naturally into prose. Do not prefix claims with labels like "HYPOTHESIS:" or "VERIFIED:" unless the output contract explicitly demands them.
> - Use the required section headings, but write within each section as a thoughtful peer explaining their thinking — not as a system presenting a framework.
> - Avoid sounding like a checklist, report template, or method exposition. The structure is for the reader's navigation, not the model's reasoning display.

## Quantitative Summary

| Metric | GPT rich-new | GPT rich-voice | Opus rich-new | Opus rich-voice |
|--------|-------------|---------------|--------------|----------------|
| Duration | 65.0s | 77.7s | 57.3s | 61.1s |
| Output length | 8,580 chars | 10,105 chars (+18%) | 8,934 chars | 11,211 chars (+25%) |
| `HYPOTHESIS` labels | **4** | **0** | 1 | 0 |
| `VERIFIED` labels | 6 | 6 | 7 | 4 |
| `##` headings | 4 | 4 | 9 | 9 |
| Bullet points | 17 | 42 | 0 | 0 |
| Table rows | 8 | 10 | 44 | 28 |

## GPT 5.4 Medium: Qualitative Comparison

### Assumptions section

**rich-new** externalizes reasoning scaffolding:
```
`HYPOTHESIS (~85%)` The system is asynchronous: product code creates a notification
intent, then a worker evaluates preferences, rate limits, and channel delivery.

`HYPOTHESIS (~80%)` Preferences are per user, per notification type, per channel.
```
Every assumption is prefixed with a `HYPOTHESIS (~N%)` label. The confidence percentage is the model showing its work — displaying the epistemic framework as structure.

**rich-voice** integrates reasoning into prose:
```
- A notification is created from an internal business event, not directly from
  arbitrary client input. That is the first trust boundary.
- Users can control preferences for non-mandatory notifications, but some categories
  such as `security` or `transactional` may override channel opt-out when policy or
  law requires delivery.
```
Zero `HYPOTHESIS` labels. The same intellectual rigor is present — trust boundaries, policy overrides, verification requirements — but communicated as a peer explaining their thinking, not a system declaring confidence intervals.

### Failure Modes section

**rich-new** uses paragraph-per-failure with scenario descriptions.
**rich-voice** uses conditional prose: "If X, then Y" — each failure mode reads as a design conversation, not a risk register.

### Foundation section

**rich-new** produces a schema with inline `VERIFIED` tags and terse field lists.
**rich-voice** produces a five-layer model (identity, policy, intent, execution, rate-limiting) with explanatory prose between tables:
> "Reasoning: endpoint verification state is a different concern from user preference state. A verified phone number is an owned destination; whether the user wants promos by SMS is a separate policy question."

This is the strongest signal: the model is **explaining its design decisions** rather than **labeling its epistemic state**. The reasoning is still present — it is just internalized into the narrative.

### Content depth

rich-voice produced 18% more content with:
- Explicit preference resolution order (6-level precedence)
- Separate push_devices table with token rotation tracking
- Notification taxonomy with `allow_fallback_channels` policy
- Dead-letter queue and retry ceiling design
- Per-channel delivery attempt tracking with provider response codes

No quality regression. If anything, the voice calibration freed the model to spend tokens on design depth rather than epistemic labeling.

## Claude Opus 4.6: Qualitative Comparison

### rich-new
Already peer-like by default. Uses tables for assumptions with structured columns (`Confidence`, `Failure Mode`). One `HYPOTHESIS` mention, seven `VERIFIED` mentions.

### rich-voice
Drops to zero `HYPOTHESIS` mentions, four `VERIFIED` mentions. Shifts from pure table-based assumptions to a combined table with inline fallbacks. 25% longer output with more detailed failure mode analysis.

### Impact
Voice calibration has a **mild effect** on Claude — it was already writing in an internalized style. The main change is a reduction in epistemic labels and slightly more expansive prose. No regression.

## Key Finding: This Is Not Another Preamble

The old GPT adaptation preamble said: "Treat philosophical descriptions as behavioral context, not identity instructions." That was a **suppression instruction** — it told the model to *ignore* part of the prompt. It worked by reducing engagement.

The Voice Calibration section says: "Integrate reasoning naturally into prose." This is a **style instruction** — it tells the model *how to express* reasoning, not to suppress it. The difference:

| Dimension | Old Preamble | Voice Calibration |
|-----------|-------------|-------------------|
| Mechanism | Suppression ("ignore philosophy") | Redirection ("integrate into prose") |
| Effect on reasoning | Reduced epistemic engagement | Maintained or improved depth |
| Effect on structure | No change to output format | Same headings, different prose style |
| Content quality | Slightly degraded (V3 finding) | Maintained or improved (+18% content) |
| Reversibility | Binary (on/off) | Gradual (style guidance) |

## Verdict

**Voice calibration works.** It is not a preamble — it is a targeted style instruction that changes HOW reasoning appears in output without changing WHETHER reasoning occurs.

- GPT 5.4: `HYPOTHESIS` labels dropped from 4 to 0. Content depth increased. Design explanations appeared where labels used to be.
- Opus 4.6: Minimal change (was already internalized). No regression.

## Recommendation

Add the Voice Calibration section to `render-rich.mjs` as a permanent part of rich rules. It belongs between the Epistemic Humility section (which defines WHAT epistemic standards to maintain) and the Definition of Done (which defines WHEN work is complete).

The section should be gated so it can be toggled if a user *wants* externalized scaffolding (e.g., for debugging or audit), but the default should be voice-calibrated output.
