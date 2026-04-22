# Plan: Execute Live A/B Experiments via CLR Infrastructure

This plan picks up from the completed rule-compliance-signals implementation and gets us to the execution point of live A/B experiments using the existing CLR (Claude Run Learner) infrastructure.

## Current State (Complete ✓)
- All signal interventions implemented (handshake, trailer, fail-closed logging)
- TDD validation complete (162/162 tests passing)
- Compliance-audit tools created and tested locally
- Local A/B experiment demonstrates +100pp lift for fail-closed logging
- Measurement harness ready for transcript analysis

## Execution Gaps to Close

### Gap 1: CLR Integration
The plan anticipated reusing `scripts/run-via-clr.mjs` + `scripts/clr-wrappers/*` but these weren't connected to the compliance experiment runner.

### Gap 2: Live Model Execution
Current experiment uses simulation - need actual model runs through CLR to generate real transcripts.

### Gap 3: Transcript Collection
No pipeline exists to collect real model outputs and feed them into compliance-audit.mjs.

## Execution Plan

### Phase 1: Connect CLR Infrastructure
**Objective**: Wire run-compliance-experiment.mjs to existing CLR wrappers

1. **Examine existing CLR wrappers**
   - Review `scripts/clr-wrappers/*` to understand agent-print, claude-print, crush-print interfaces
   - Identify how to inject different rule sets (Conditions A-D) into each wrapper
   - Document interface requirements

2. **Create condition injection**
   - Modify run-compliance-experiment.mjs to call CLR with tagged rule directories
   - Support passing compiled-exp/{A,B,C,D}/ rule paths to each wrapper
   - Add `--rules-dir` flag to run-compliance-experiment.mjs

3. **Test local execution**
   - Run single prompt through each wrapper to verify injection works
   - Verify generated transcripts contain expected signals

### Phase 2: Build Transcript Collection Pipeline
**Objective**: Automate collection of model outputs into compliance-audit.mjs format

1. **Define transcript JSON schema**
   - Final assistant message → `result` field
   - Tool calls → `tool_calls` array with `{type, command}` objects
   - Session metadata → `id`, timestamp, model used

2. **Create collector module**
   - scripts/lib/compliance-transcript-collector.mjs
   - Converts CLR output format → compliance-audit.mjs input format
   - Handles multiple transcript file formats

3. **Wire to compliance-audit.mjs**
   - Run collector on CLR output directory
   - Feed collected transcripts into runAudit()

### Phase 3: Full A/B Experiment Execution
**Objective**: Execute live experiment and collect results

1. **Define experiment parameters**
   - Number of trials per condition (recommend 10-20)
   - Models to test (agent-print, claude-print, crush-print)
   - Prompt set from compliance-cases.json

2. **Execute experiment**
   ```bash
   node scripts/run-compliance-experiment.mjs --all --trials 10 --models claude,crush
   ```

3. **Collect and analyze results**
   - Transcripts written to .logs/compliance-experiment-{timestamp}/
   - Run compliance-audit.mjs on collected transcripts
   - Generate summary report

### Phase 4: Decision Framework
**Objective**: Apply shipping criteria from plan to decide what ships

- **Condition shipping criteria** (per plan):
  - Must show ≥20pp lift over baseline that lacks only that intervention
  - C over B for fail-closed logging
  - D over C for landmarks

- **Decision rules**:
  - If C shows ≥20pp logging lift → ship fail-closed logging
  - If D shows ≥20pp lift over C → ship landmarks
  - If landmark lift <20pp → drop landmarks, retain A/B/C

## Implementation Tasks

### Task 1: Examine CLR Wrappers
```
File: scripts/clr-wrappers/*.mjs
Action: Read and understand existing wrapper interfaces
Output: Documented interface requirements for condition injection
Done when: Interface requirements documented
```

### Task 2: Create Condition Injection
```
File: scripts/run-compliance-experiment.mjs modifications
Action: Add --rules-dir and --wrapper flags
Output: Experiment runner can invoke CLR with different rule sets
Done when: Single prompt runs through each wrapper with correct rules
```

### Task 3: Build Transcript Collector
```
File: scripts/lib/compliance-transcript-collector.mjs (new)
Files: scripts/run-compliance-audit.mjs modifications
Action: Convert CLR output → compliance-audit.mjs format
Output: Automated transcript collection pipeline
Done when: Pipeline processes sample transcript correctly
```

### Task 4: Execute Full Experiment
```
Files: None new (reuse existing)
Action: Run experiment with live models
Output: Real compliance metrics from live model execution
Done when: Results table populated with real model data
```

### Task 5: Apply Decision Framework
```
Files: None (analysis only)
Action: Apply shipping criteria to results
Output: Decision on what interventions ship
Done when: Clear go/no-go decision for each intervention
```

## Success Criteria

### Must Have
- [ ] CLR integration complete - experiment can trigger live model runs
- [ ] Transcript collection pipeline functional
- [ ] Real A/B results collected from at least one model

### Should Have  
- [ ] Results from 2+ models (e.g., claude-print + crush-print)
- [ ] Statistical significance (≥10 trials per condition)

### Nice to Have
- [ ] Results from all three wrappers
- [ ] Multi-model comparison analysis
- [ ] Automated PR comment with results

## Timeline Estimate

| Task | Complexity | Estimate |
|------|------------|----------|
| Examine CLR wrappers | Low | 30 min |
| Create condition injection | Medium | 2 hrs |
| Build transcript collector | Medium | 2 hrs |
| Execute full experiment | Medium | 4 hrs (includes model run time) |
| Apply decision framework | Low | 1 hr |

**Total**: ~10 hours for full execution

## Dependencies

- **Required**: Existing CLR infrastructure (`scripts/run-via-clr.mjs`, `scripts/clr-wrappers/*`)
- **Required**: Compliance-cases.json (already created)
- **Required**: compliance-audit.mjs (already created)

## Open Questions

1. **Which models for initial testing?**
   - Recommendation: Start with ONE model (e.g., claude-print) to validate pipeline before multiplying

2. **How many trials per condition?**
   - Plan suggests 10 prompts, 1 turn each
   - Consider 10-20 trials per condition for statistical significance

3. **Whatprompt set?**
   - Use compliance-cases.json (10 prompts already defined)
   - Could expand if variance is high

4. **How to handle API costs?**
   - Consider limiting initial run to 1 model × 10 prompts = 10 runs
   - Scale up after pipeline validated

## Next Immediate Action

Start with **Task 1: Examine CLR wrappers**

```bash
ls scripts/clr-wrappers/
# then read each wrapper file to understand interface
```