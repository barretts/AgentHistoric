# V5 Analysis: Voice Modes (Calibrated + Scaffolded)

**Run ID:** `persona-prompting-v5-voice-modes`
**Date:** 2025-07-25
**Prompt:** "Design the data model and trust boundaries for a user notification system that supports email, SMS, and push channels with per-user preferences and rate limiting."

## Conditions

| Condition | Description |
|-----------|-------------|
| `rich-new` | Preamble-free rich rules — no voice instruction (baseline) |
| `rich-voice` | `rich-new` + Voice Calibration (internalized, peer-like prose) |
| `rich-scaffolded` | `rich-new` + Scaffolded Voice (externalized reasoning with labels) |

## Quantitative Summary

| Metric | GPT new | GPT voice | GPT scaffolded | Opus new | Opus voice | Opus scaffolded |
|--------|---------|-----------|----------------|----------|------------|-----------------|
| Duration | 49.1s | 47.7s | 64.6s | 67.0s | 61.9s | 62.5s |
| Chars | 12,467 | 8,609 | 11,751 | 11,157 | 9,992 | 9,978 |
| `HYPOTHESIS` | **5** | **0** | **38** | 0 | 0 | **4** |
| `VERIFIED` | 7 | 4 | 3 | 3 | 5 | 6 |
| `##` headings | 8 | 4 | 9 | 9 | 9 | 10 |
| Bullets | 52 | 38 | 0 | 0 | 0 | 0 |
| Table rows | 0 | 4 | 22 | 32 | 28 | 36 |

## Key Findings

### Voice Calibration (internalized) — confirmed from V4

- **GPT**: `HYPOTHESIS` labels drop from 5 → 0. Output is peer-like prose.
- **Opus**: Already internalized by default. No regression.

### Scaffolded Voice (externalized) — new finding

- **GPT**: `HYPOTHESIS` labels explode from 5 → **38**. Every assumption is numbered and prefixed with `HYPOTHESIS (~N%)`. Output is fully tabular with 22 table rows (vs 0 at baseline). This is GPT in full audit mode.
- **Opus**: `HYPOTHESIS` labels go from 0 → **4**. Claude, which never externalizes by default, now produces labeled assumptions with confidence levels in a structured table. The reverse voice mode works.

### Opus Scaffolded — Example

```
| A1 | Multi-tenant system; notifications are scoped to a single tenant/org | HYPOTHESIS (~70%) | Cross-tenant data leakage if tenant isolation is missing |
| A3 | Email/SMS/push credentials are stored in a secrets manager, never in the notification DB | VERIFIED (principle) | Credential exfiltration from DB compromise |
```

Claude is now labeling epistemic state — something it never does unprompted.

### GPT Scaffolded — Example

```
1. HYPOTHESIS (~90% confidence): the notification system is a separate service that consumes an existing authoritative `user_id` from the identity system.
2. HYPOTHESIS (~95% confidence): channel addresses are security-sensitive PII.
4. HYPOTHESIS (~85% confidence): rate limiting must exist at more than one scope.
```

GPT in scaffolded mode produces the most explicitly reasoned output of any condition.

## Voice Mode Control Matrix

| | GPT default behavior | With Voice Calibration | With Scaffolded Voice |
|---|---|---|---|
| `HYPOTHESIS` labels | 5 (moderate) | **0** (eliminated) | **38** (maximized) |
| Style | Mixed (some labels, some prose) | Peer-like prose | Full audit/report |

| | Opus default behavior | With Voice Calibration | With Scaffolded Voice |
|---|---|---|---|
| `HYPOTHESIS` labels | 0 (never) | 0 (unchanged) | **4** (induced) |
| Style | Peer-like prose | Peer-like prose (no change) | Structured tables + labels |

## Verdict

Both voice modes work bidirectionally:
- **Voice Calibration** makes GPT sound like Claude (internalized reasoning, peer prose)
- **Scaffolded Voice** makes Claude sound like GPT (externalized reasoning, labeled scaffolding)

Neither mode degrades content quality. Both are style instructions, not suppression instructions.

## Implementation Status

Voice Calibration is now the default in all three renderers:
- `render-rich.mjs` — between Epistemic Humility and Definition of Done
- `render-sparse.mjs` — replaces the legacy GPT Adaptation section
- `render-codex.mjs` — in AGENTS.md after Execution Protocol

Scaffolded Voice is available via `--scaffolded` flag:
- `node scripts/build-prompt-system.mjs --scaffolded`
- `bash install.sh --scaffolded`
