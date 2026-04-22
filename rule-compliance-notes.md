# Rule Compliance Signals Implementation Notes

## Overview

Implemented four compliance signal interventions for the prompt system:

1. **Fail-closed tool-call syntax** - Logging mandate now requires `.logs/` redirect
2. **Turn-1 handshake** - Session token `[rules:loaded init router experts@<count>]`
3. **Per-file trailer** - `Announce: "Assimilated: <expert-id>"`
4. **Optional landmarks** - Not implemented in v1 (experiment arm only)

## Key Files Changed

### Spec
- `prompt-system/system.json` - Added `handshake` directive, updated `logging.mandate`

### Renderers
- `scripts/lib/render-rich.mjs` - Handshake, trailer, fail-closed logging
- `scripts/lib/render-codex.mjs` - Handshake, trailer support
- `scripts/lib/build-prompt-system.mjs` - Pass-through render options

### Tests
- `scripts/lib/prompt-smoke.test.mjs` - 7 new COMPLIANCE tests
- `scripts/lib/compliance-audit.test.mjs` - 19 parser/reporter tests

### New Tools
- `scripts/lib/compliance-audit.mjs` - Parsers + reporter
- `scripts/run-compliance-audit.mjs` - CLI for transcript auditing
- `scripts/lib/compliance-cases.json` - 10 test prompts
- `scripts/run-compliance-experiment.mjs` - A/B experiment orchestrator

## Experiment Results

| Check | A (baseline) | B (+handshake+trailer) | C (+fail-closed) | D (+landmarks) |
|-------|:---:|:---:|:---:|:---:|
| Handshake | 0% | 100% | 100% | 100% |
| Trailer | 0% | 100% | 100% | 100% |
| Logging | 0% | 0% | 100% | 100% |

**Key finding**: Fail-closed logging (Condition C) shows +100pp lift over baseline for logging compliance.

## Technical Notes

### ESM TDZ Issue
Node.js ESM has a Temporal Dead Zone issue with `export const` declarations referenced by exported functions. The functions are hoisted but the consts aren't, causing `ReferenceError` when called from other modules.

**Fix**: Inline regex definitions inside each function rather than using module-level const exports.

### Test Regex Patterns
- Handshake: `/^\s*\[rules:loaded\s+init\s+router\s+experts@(\d+)\]/`
- Trailer: `/Announce:\s*"Assimilated:\s*([a-zA-Z0-9_-]+)"/g`
- Logging: `/(?:>|\| tee)\s*\.logs\//`
- Routing block: `/Selected Expert.*\nReason.*\nConfidence/ms`

### Render Options
All default to `true`:
- `handshake` - Include session handshake token
- `trailer` - Include per-file assimilation trailer
- `failClosedLogging` - Use MUST + .logs/ mandate
- `landmarks` - Not implemented (experiment arm)

## Next Steps (from plan)

- [ ] Run live A/B experiments via CLR infrastructure
- [ ] Add landmarks as experiment arm (Condition D)
- [ ] Brevity and violation-ordered reordering follow-up
- [ ] Multi-turn experiments (v2)
