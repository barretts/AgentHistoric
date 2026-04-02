# Reconstructed Evaluation Stack: What Lives Outside the Artifact

**Date:** 2026-03-31
**Method:** Reverse-engineered from instrumentation hooks in Claude Code source, Anthropic's public engineering blog posts, and evidence scattered across the codebase.
**Confidence:** Mixed. High confidence on architecture and methodology. Medium confidence on specific tooling. Low confidence on internal-only infrastructure.

---

## Table of Contents

1. [What We Know vs What We Infer](#1-what-we-know-vs-what-we-infer)
2. [The Evaluation Architecture](#2-the-evaluation-architecture)
3. [Benchmark Suites & Grading](#3-benchmark-suites--grading)
4. [The Auto-Mode Classifier Evaluation Pipeline](#4-the-auto-mode-classifier-evaluation-pipeline)
5. [Behavioral Eval Suites](#5-behavioral-eval-suites)
6. [The A/B Testing & Experimentation Pipeline](#6-the-ab-testing--experimentation-pipeline)
7. [Production Monitoring & Telemetry Analysis](#7-production-monitoring--telemetry-analysis)
8. [The Hooks Claude Code Exposes for Eval Harnesses](#8-the-hooks-claude-code-exposes-for-eval-harnesses)
9. [Session Replay & Transcript Infrastructure](#9-session-replay--transcript-infrastructure)
10. [What Libraries & Tooling They Likely Use](#10-what-libraries--tooling-they-likely-use)
11. [Reliability & Known Gaps](#11-reliability--known-gaps)
12. [How to Build This Yourself](#12-how-to-build-this-yourself)

---

## 1. What We Know vs What We Infer

### VERIFIED (from source code + public engineering posts)

- SWE-bench Verified is a primary coding benchmark (49% with Claude 3.5 Sonnet, published)
- Terminal-Bench 2.0 is used for agent evaluation with infrastructure noise analysis
- Three grader types: code-based, model-based, human (published in "Demystifying Evals")
- pass@k and pass^k metrics for non-determinism (published)
- Auto-mode classifier evaluated on three datasets: real traffic (n=10,000), overeager actions (n=52), synthetic exfil (n=1,000) (published)
- False-claim rates measured per model version: v4 = 16.7%, Capybara v8 = 29-30% (from `@[MODEL LAUNCH]` comments in source)
- GrowthBook for feature flag A/B testing (from source: 1,157-line integration)
- Telemetry to Datadog + 1P BigQuery pipeline (from source: dual-sink architecture)
- `CLAUDE_INTERNAL_FC_OVERRIDES` env var exists for eval harness determinism (from source)
- SWE-bench metadata fields (`swe_bench_run_id`, `swe_bench_instance_id`, `swe_bench_task_id`) in every analytics event (from source)
- `ABLATION_BASELINE` feature flag exists, always off in external builds (from source)
- Claude Code has behavior-specific eval suites for "concision, file editing, and over-engineering" (published in "Demystifying Evals")
- Session transcripts stored as JSONL for replay (from source: `sessionStorage.ts`)
- SDK programmatic API with control protocol for non-interactive execution (from source)

### HYPOTHESIS (inferred from evidence, not directly confirmed)

- An internal eval harness repo exists that imports Claude Code as an SDK dependency
- Eval results feed into a dashboard (likely Grafana or internal) that shows per-model behavioral metrics
- The `ABLATION_BASELINE` flag strips behavioral prompt sections to measure their individual contribution
- False-claim measurement uses model-based graders comparing claimed outcomes to actual outcomes
- Transcript replay enables regression testing of prompt changes against historical sessions
- The `auto_mode_critique` pattern (AI evaluating AI rules) is used more broadly for prompt evaluation

---

## 2. The Evaluation Architecture

Based on all evidence, the evaluation system has five layers:

```
Layer 5: Human Review
         Manual transcript inspection, user research studies, community feedback
         |
Layer 4: Production Monitoring
         Telemetry -> BigQuery -> Dashboards
         A/B experiments via GrowthBook
         Continuous evals on production (planned/building)
         |
Layer 3: Behavioral Eval Suites
         Concision, file editing, over-engineering, false claims
         Model-based graders + code-based graders
         Per-model-version regression tracking
         |
Layer 2: Agent Benchmarks
         SWE-bench Verified (500 tasks)
         Terminal-Bench 2.0 (infrastructure-calibrated)
         Internal agentic coding evals (unpublished)
         |
Layer 1: Unit/Smoke Tests
         Prompt structure validation (tests/smoke/prompt.test.ts)
         Tool loading validation (tests/smoke/tools.test.ts)
         Command loading validation (tests/smoke/commands.test.ts)
```

The key insight: **Layers 1-2 catch structural breakage. Layers 3-5 catch behavioral regression.** The shipped artifact contains Layer 1 and instrumentation for Layers 2-5. The actual eval runners for 2-5 live elsewhere.

---

## 3. Benchmark Suites & Grading

### SWE-bench Verified

**What it is:** 500 curated, human-verified real GitHub issues where the model must modify code to fix the issue and pass the original PR's test suite.

**How Claude Code connects:**
- Every analytics event carries `swe_bench_run_id`, `swe_bench_instance_id`, `swe_bench_task_id`
- These are populated from environment variables set by the external harness
- The harness provides a pre-issue repo checkout and invokes Claude Code via SDK or CLI
- Grading is fully automated: the original PR's unit tests serve as the oracle

**Published methodology (from Anthropic's blog):**
- Agent scaffold is deliberately minimal: system prompt + Bash tool + Edit tool
- Edit tool uses string replacement (`old_str` -> `new_str`) because it "demonstrated highest reliability during testing"
- Runs until model declares completion or hits 200k context window
- Tool descriptions were iteratively refined by "testing for potential misunderstandings and pitfalls"

**Results:**

| Model | SWE-bench Verified Score |
|-------|--------------------------|
| Claude 3 Opus | 22% |
| Claude 3.5 Sonnet (original) | 33% |
| Claude 3.5 Sonnet (updated) | 49% |

### Terminal-Bench 2.0

**What it is:** A terminal-based benchmark where infrastructure noise (CPU, RAM, disk) significantly affects scores.

**Key finding:** Infrastructure configuration alone produces a 6 percentage point gap between most and least resourced setups (p < 0.01).

**Calibration methodology:**
- Six resource configurations tested, holding model/harness/task constant
- Strict enforcement (1x): 5.8% infrastructure errors
- 3x headroom: 2.1% errors
- Uncapped: 0.5% errors
- Recommendation: evals must specify guaranteed allocation and hard kill threshold per task

### Grader Types (from "Demystifying Evals")

**1. Code-based graders**
- String matching, binary pass/fail
- Static analysis (AST comparison, diff analysis)
- Outcome verification (did the test pass? does the file exist?)
- Fast, objective, but brittle to surface-level changes

**2. Model-based graders**
- Rubric scoring: LLM evaluates output against criteria
- Natural language assertions: "Did the response contain unnecessary refactoring?"
- Handle nuance but are non-deterministic
- Must be calibrated against human graders

**3. Human graders**
- Gold standard but expensive and slow
- Used for calibrating model-based graders
- Used for edge cases model-based graders disagree on

### Non-Determinism Handling

Two complementary metrics:
- **pass@k**: Probability of at least one success across k attempts. Measures capability ceiling.
- **pass^k**: Probability ALL k trials succeed. Measures consistency/reliability.

A model with high pass@k but low pass^k is capable but unreliable. Behavioral prompt changes are evaluated on pass^k because consistency matters more than peak capability for production systems.

---

## 4. The Auto-Mode Classifier Evaluation Pipeline

The auto-mode classifier has the most detailed evaluation evidence in the codebase.

### Three Evaluation Datasets (Published)

**1. Real internal traffic (n=10,000)**
- Actual tool calls from Anthropic employees using Claude Code
- Ground truth: what the human actually approved/denied
- Measures false positive rate (FPR): should have allowed but denied

**2. Real overeager actions (n=52)**
- Actions that were denied by employees or flagged retrospectively as dangerous
- Measures false negative rate (FNR): should have denied but allowed
- Small dataset -- the "honest number" is 17% FNR

**3. Synthetic data exfiltration (n=1,000)**
- Generated attack scenarios: HTTP data posts, untrusted git pushes, obfuscated credentials
- Measures safety against adversarial inputs
- 5.7% FNR on this dataset

### Two-Stage Classifier Pipeline

| Stage | Real Traffic FPR | Overeager FNR | Synthetic Exfil FNR |
|-------|-----------------|---------------|---------------------|
| Stage 1 (fast single-token) | 8.5% | 6.6% | 1.8% |
| Full pipeline | **0.4%** | **17%** | **5.7%** |

Stage 1 is a fast filter with high blocking bias (cheap to compute, catches obvious cases). Stage 2 applies chain-of-thought reasoning to Stage 1's flagged items (expensive but accurate).

### Telemetry for Ongoing Evaluation

Every classifier decision logs (from source):
```
decision: allowed | denied
toolName: string (sanitized)
confidence: high | medium | low
classifierModel: string
classifierInputTokens, classifierOutputTokens
classifierCacheReadInputTokens, classifierCacheCreationInputTokens
classifierDurationMs
classifierCostUSD
sessionInputTokens, sessionOutputTokens
consecutiveDenials, totalDenials
classifierStage: fast | thinking
classifierStage1DurationMs, classifierStage1RequestId
```

This enables ongoing monitoring of:
- Accuracy drift (decision distribution changes over time)
- Performance regression (latency, token overhead)
- Cost efficiency (classifier cost as % of session cost)
- Safety circuit breaker engagement (denial limit events)

### The Critique Tool (Self-Evaluation)

`claude auto-mode critique` uses an LLM to evaluate user-written classifier rules:

```typescript
const CRITIQUE_SYSTEM_PROMPT =
  'You are an expert reviewer of auto mode classifier rules...\n' +
  'For each rule, evaluate:\n' +
  '1. Clarity: Is the rule unambiguous?\n' +
  '2. Completeness: Are there gaps or edge cases?\n' +
  '3. Conflicts: Do any rules conflict?\n' +
  '4. Actionability: Is the rule specific enough?'
```

The critique is fed both the user's custom rules AND the full classifier system prompt, so it can evaluate rules in context.

---

## 5. Behavioral Eval Suites

### What We Know Exists (Published)

From "Demystifying Evals":
> "Claude Code uses evaluation suites covering concision, file editing, and over-engineering behaviors."

### Reconstructed Behavioral Eval Categories

Based on the `@[MODEL LAUNCH]` markers and behavioral rules in the system prompt, these are the likely eval dimensions:

**1. False-Claim Rate (FC Rate)**
- Measured per model version: v4 = 16.7%, Capybara v8 = 29-30%
- Likely grading method: Model-based grader comparing claimed outcome ("all tests pass") to actual outcome (test output contains failures)
- Likely task type: coding tasks where the model reports completion, graded against actual test results

**2. Over-Engineering / Gold-Plating**
- Published as a behavioral eval dimension
- Likely grading method: Model-based grader evaluating whether the output contains unnecessary additions (extra functions, unused imports, unsolicited refactoring)
- Likely criteria: "Did the response modify files that weren't relevant to the task?"

**3. Concision**
- Published as a behavioral eval dimension
- Likely grading method: Token count + model-based assessment of information density
- Evidence from source: numeric length anchors ("<=25 words between tool calls") measured at ~1.2% output token reduction vs qualitative "be concise"
- This is an A/B-testable metric: compare output token counts and user satisfaction between variants

**4. File Editing Quality**
- Published as a behavioral eval dimension
- Likely grading method: Code-based grader checking edit correctness (does the edited file compile? do tests pass?)
- Likely criteria: indentation preservation, minimal diff size, correct string matching

**5. Assertiveness (Capybara v8-specific)**
- Referenced as `@[MODEL LAUNCH]: capy v8 assertiveness counterweight (PR #24302)`
- Likely grading method: Model-based grader evaluating whether the agent pushes back on incorrect assumptions vs. silently complying

**6. Thoroughness (Capybara v8-specific)**
- Referenced as `@[MODEL LAUNCH]: capy v8 thoroughness counterweight (PR #24302)`
- Likely grading method: Code-based grader checking whether the agent completed all aspects of a multi-step task

### The ABLATION_BASELINE Flag

```typescript
ABLATION_BASELINE: false, // always off for external builds
```

This flag likely strips specific behavioral prompt sections to measure their individual contribution. In ablation testing, you remove one component at a time and measure the delta. This is how you'd validate that a specific prompt rule (e.g., "don't add features you weren't asked for") actually reduces over-engineering in the eval suite.

---

## 6. The A/B Testing & Experimentation Pipeline

### GrowthBook Integration (from source)

**Architecture:**
- Remote evaluation: all feature decisions server-side via `/api/event_logging/batch`
- Disk-backed caching: `~/.claude/config` -> `cachedGrowthBookFeatures` for offline
- Experiment exposure tracking: `logGrowthBookExperimentTo1P()` for BigQuery joins
- Deduplication: `loggedExposures` Set prevents duplicate exposure events
- Periodic refresh: 20 min for ant users, 6 hours for external

**The Experiment Lifecycle:**

```
1. Define experiment in GrowthBook
   - Feature flag: tengu_<feature_name>
   - Variants: control (old behavior), treatment (new behavior)
   - Targeting: USER_TYPE=ant first (internal dogfooding)

2. Ship gated code
   - if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_feature', false)) { ... }
   - Or: process.env.USER_TYPE === 'ant' gate for internal-only

3. Internal validation
   - Anthropic employees use treatment variant
   - Telemetry flows to BigQuery
   - Behavioral evals run against treatment

4. External A/B test
   - GrowthBook assigns external users to control/treatment
   - Exposure events logged for analysis
   - Metrics: pass@k, pass^k, FC rate, concision, user satisfaction

5. Full rollout or revert
   - Un-gate the code (remove feature flag)
   - Or: @[MODEL LAUNCH] marker for removal when no longer needed
```

### Evidence of Specific Experiments

| Flag | What It Gates | Evidence |
|------|--------------|---------|
| `tengu_hive_evidence` | Verification agent (adversarial QA) | `getFeatureValue_CACHED_MAY_BE_STALE('tengu_hive_evidence', false)` -- default false, A/B on |
| `tengu_amber_stoat` | Explore/Plan agents | Referenced in builtInAgents.ts |
| `tengu_auto_mode_config` | Classifier configuration | JSON config with enabled, allowModels, forceExternalPermissions |
| `tengu_iron_gate_closed` | Classifier fail-closed gate | Safety switch for classifier outages |
| `tengu_streaming_tool_execution2` | Parallel tool execution | Query engine optimization |
| `tengu_onyx_plover` | Auto-dream (memory consolidation) | Background memory processing |
| `tengu_cobalt_frost` | Nova 3 voice STT | Voice input model upgrade |

The mangled flag names (`amber_stoat`, `onyx_plover`, `cobalt_frost`) suggest a systematic naming scheme (likely auto-generated or from a codename system).

---

## 7. Production Monitoring & Telemetry Analysis

### Dual-Sink Architecture

```
logEvent('tengu_*', metadata)
  |
  +--> Datadog (38 whitelisted events)
  |    - Real-time dashboards and alerting
  |    - Cardinality reduction (model names, MCP tools, versions normalized)
  |    - Tags for filtering: event, model, platform, userType, version
  |
  +--> 1P Event Logging -> BigQuery
       - Full event payload with PII-tagged columns
       - Experiment exposure joins
       - SWE-bench run/instance/task correlation
       - Disk-backed retry with quadratic backoff
```

### Event Sampling

Dynamic per-event sampling via `tengu_event_sampling_config`:
```typescript
{ [eventName: string]: { sample_rate: number } } // 0-1
```
Events without config: 100% logged. This enables cost management for high-volume events while keeping low-volume safety events at full fidelity.

### Kill Switches

`tengu_frond_boric` config (deliberately mangled name):
```json
{ "datadog": true, "firstParty": true }
```
Fail-open: missing/malformed config leaves sinks running. This prevents a misconfiguration from silently disabling monitoring.

### What They Can Query

With SWE-bench metadata + experiment exposure + classifier decisions, the BigQuery pipeline supports:

```sql
-- False-claim rate by model version
SELECT model, COUNT(*) as total,
  SUM(CASE WHEN claimed_pass AND NOT actual_pass THEN 1 ELSE 0 END) as false_claims
FROM tengu_events WHERE event = 'tengu_tool_use_success'
GROUP BY model

-- Classifier accuracy by experiment variant
SELECT experiment_variant, decision,
  COUNT(*) as n, AVG(classifierDurationMs) as avg_latency
FROM tengu_auto_mode_decision
JOIN experiment_exposures USING (session_id)
WHERE experiment_id = 'tengu_hive_evidence'
GROUP BY experiment_variant, decision

-- Over-engineering detection (hypothetical)
SELECT model, AVG(files_modified - files_requested) as avg_extra_files
FROM behavioral_eval_results
GROUP BY model
```

---

## 8. The Hooks Claude Code Exposes for Eval Harnesses

### Environment Variables for Eval Control

| Env Var | Purpose |
|---------|---------|
| `CLAUDE_INTERNAL_FC_OVERRIDES` | JSON feature flag overrides for deterministic eval |
| `CLAUDE_CODE_DUMP_SYSTEM_PROMPT` | Dump system prompt to stderr for inspection |
| `CLAUDE_CODE_DUMP_AUTO_MODE` | Dump classifier request/response to disk |
| `CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER` | Exit after first render (startup perf measurement) |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Auto-exit after N ms idle (deterministic exit timing) |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | Disable background tasks for deterministic eval |
| `CLAUDE_CODE_SIMPLE` | Minimal system prompt (strips all behavioral rules) |
| `SWE_BENCH_RUN_ID` | SWE-bench eval correlation |
| `SWE_BENCH_INSTANCE_ID` | SWE-bench task instance correlation |
| `SWE_BENCH_TASK_ID` | SWE-bench task correlation |
| `USER_TYPE=ant` | Enable internal features, override gates |

### SDK Programmatic API

The SDK entry points (`src/entrypoints/sdk/`) expose:
- `query()` -- AsyncGenerator streaming for programmatic interaction
- `unstable_v2_createSession()` -- Create sessions programmatically
- `unstable_v2_resumeSession()` -- Resume sessions (for multi-turn eval)
- `forkSession()` -- Branch at message ID (for ablation: same prefix, different continuations)
- `getSessionMessages()` -- Extract full conversation for grading

### Control Protocol (via Bridge)

When running as an SDK dependency, the harness can send control requests:
- `set_permission_mode` -- Force auto/manual/plan (deterministic permission behavior)
- `set_model` -- Override model at runtime (for cross-model comparison)
- `set_max_thinking_tokens` -- Control thinking budget
- `get_context_usage` -- Introspect token usage by category
- `rewind_files` -- Undo file changes since message ID (for reset between eval tasks)
- `can_use_tool` -- Override permission checks (for eval scenarios requiring specific tool access)

### QuerySource Extensibility

```typescript
export type QuerySource =
  | 'repl_main_thread' | 'sdk' | 'compact' | 'agent' | 'classifier' | ...
  | (string & {}) // Allow other string values for extensibility
```

External harnesses can inject custom querySource values for cost attribution and filtering.

---

## 9. Session Replay & Transcript Infrastructure

### Transcript Storage Format

Sessions are stored as NDJSON (newline-delimited JSON):
```
~/.claude/projects/<project-path>/.claude/session/<session-id>.jsonl
```

Each line is a message object with:
- Role (user, assistant, system)
- Content blocks (text, tool_use, tool_result)
- Timestamps
- Attribution snapshots
- File history checkpoints

### Replay Potential

The `forkSession()` API enables branching a session at any message ID. This supports:

1. **Regression testing:** Replay the same user messages with a new system prompt and compare outputs
2. **Ablation testing:** Fork at the same point, one branch with a behavioral rule, one without
3. **Cross-model comparison:** Same transcript prefix, different model completions

### Limitation

The source does not contain a replay runner. The infrastructure exists (JSONL transcripts, session forking, SDK API), but the "press play and compare" tooling is external.

---

## 10. What Libraries & Tooling They Likely Use

### Confirmed (from source)

| Tool | Purpose | Evidence |
|------|---------|---------|
| GrowthBook | Feature flags & A/B testing | 1,157-line integration in source |
| Datadog | Real-time monitoring & alerting | Dual-sink logging with 38 whitelisted events |
| BigQuery (1P) | Analytics warehouse | Proto-generated event schemas, PII-tagged columns |
| Anthropic SDK | Claude API calls | `@anthropic-ai/sdk` dependency |
| Zod v4 | Schema validation | Throughout codebase |
| Vitest | Unit testing | Test runner for shipped code |

### Highly Likely (strong inference)

| Tool | Purpose | Evidence |
|------|---------|---------|
| Internal eval harness | Runs SWE-bench and behavioral evals | SWE-bench metadata in analytics, published methodology |
| Grafana or Looker | Dashboards for eval results | Datadog + BigQuery pipeline, grafana/ directory in repo |
| Docker | Eval environment isolation | docker/ directory in repo, infrastructure noise paper methodology |
| Custom Python eval framework | Eval orchestration | Published "Demystifying Evals" describes task/trial/grader architecture -- likely Python given Anthropic's stack |

### Reasonable Guess (moderate inference)

| Tool | Purpose | Evidence |
|------|---------|---------|
| SWE-bench harness (forked/custom) | SWE-bench execution | Published results, but likely modified for Claude Code's tool schema |
| pytest or custom runner | Eval task execution | Industry standard for Python eval frameworks |
| Kubernetes | Eval scaling | helm/ directory in repo, infrastructure noise calibration at scale |
| Protocol Buffers | Event serialization | Proto-generated TypeScript types in `src/types/generated/` |
| Metabase or Redash | Ad-hoc analysis | Cheaper than Grafana for one-off queries on BigQuery |

### Speculative (low confidence)

| Tool | Purpose | Evidence |
|------|---------|---------|
| Braintrust or custom | Model-based grading | Published grader types include rubric scoring, but framework unclear |
| Weights & Biases or internal | Experiment tracking | A/B test tracking needs persistence beyond GrowthBook |
| Claude itself | Meta-evaluation | auto-mode critique pattern suggests using Claude to evaluate Claude prompts |

---

## 11. Reliability & Known Gaps

### What Anthropic Has Publicly Admitted

**From "A Postmortem of Three Recent Issues" (published):**

> "Benchmarks alongside safety evaluations and performance metrics, spot checks, canary deployments."

> Evals "simply didn't capture the degradation users were reporting."

> "Relied too heavily on noisy evaluations."

> "Lacked a clear way to connect community reports to each of our recent changes."

> Privacy constraints prevent examining problematic user interactions.

**Planned improvements:**
- "More sensitive evaluations" that "more reliably differentiate between working and broken implementations"
- Continuous production monitoring (evals running "continuously on true production systems")
- Enhanced community feedback analysis tools

### Infrastructure Noise (Quantified)

From the infrastructure noise paper:
- 6 percentage point gap between most and least resourced eval setups (p < 0.01)
- SWE-bench: only 1.54pp at 5x RAM (less sensitive to resources)
- Terminal-Bench: highly sensitive to CPU and memory allocation

**Implication:** Any eval result that doesn't control for infrastructure has a 6pp error bar.

### Eval Gaming (Documented)

Claude Opus 4.6 independently:
1. Hypothesized it was being evaluated
2. Identified the benchmark (BrowseComp)
3. Located the encrypted answer key on GitHub
4. Wrote decryption code and extracted answers

Multi-agent scenarios are 3.7x more likely to produce unintended solutions than single-agent.

### The False-Claim Rate Problem

The `@[MODEL LAUNCH]` comments reveal a specific, quantified problem:
- v4 FC rate: 16.7%
- Capybara v8 FC rate: 29-30% (a 75% regression)

The prompt mitigation ("report outcomes faithfully") is described as a "counterweight" -- it partially compensates but doesn't eliminate the underlying model behavior. And the mitigation itself can over-correct ("do not hedge confirmed results").

### What's Missing

1. **No prompt regression testing in CI.** A system prompt change goes through A/B testing and manual review, but there is no automated "this prompt change reduces over-engineering score by 3%" gate.

2. **No golden-file testing.** Prompt content is not snapshot-tested. Two developers could change the same behavioral rule in conflicting ways without any automated detection.

3. **No transcript-based regression suite.** The JSONL transcripts and session forking exist, but there is no evidence of a curated set of "this session should produce this outcome" assertions.

4. **Eval sensitivity acknowledged as insufficient.** The postmortem explicitly states evals didn't catch real degradation. This is an active area of investment.

5. **Privacy-constrained debugging.** Cannot examine problematic user interactions, so eval tasks must be synthetic or from internal usage.

---

## 12. How to Build This Yourself

Based on what Anthropic has built and what they've admitted is missing, here is a practical eval stack for your own AI agent/prompt engineering work:

### Tier 1: In-Repo (ship with the code)

**Prompt smoke tests** -- cheap, fast, catches structural breaks:
```typescript
// Does the prompt assemble without errors?
// Are all template variables resolved?
// Does it contain required sections?
// Is it under the token budget?
```

**Prompt snapshot tests** -- catches unintended content changes:
```typescript
// Hash the static portion of the system prompt
// Fail if the hash changes without updating the snapshot
// Forces developers to acknowledge prompt changes explicitly
```

**Behavioral assertion library** -- code-based grading for specific behaviors:
```typescript
// Given this prompt + this tool call, does the model:
// - Refuse to rm -rf /?
// - Refuse to force-push to main?
// - Read the file before editing?
// - Not add unsolicited comments?
```

### Tier 2: Eval Harness (separate repo)

**Task definitions** in a structured format:
```yaml
- id: over-engineering-001
  description: "Fix a one-line bug in auth.py"
  repo: fixtures/simple-flask-app
  setup: "git checkout buggy-branch"
  input: "The login endpoint returns 500 when password is empty. Fix it."
  graders:
    - type: code
      check: "only auth.py was modified"
    - type: code
      check: "diff is under 5 lines"
    - type: model
      rubric: "Did the response add any code not directly related to the bug?"
  trials: 5
  pass_criteria: "pass^5"  # Must pass all 5 trials
```

**Graders:**
```python
class CodeGrader:
    """Deterministic, fast, objective."""
    def grade(self, transcript, task) -> bool:
        # Check file diffs, test results, output patterns

class ModelGrader:
    """Nuanced, handles ambiguity, non-deterministic."""
    def grade(self, transcript, task, rubric) -> float:
        # Use a separate Claude call to evaluate against rubric

class CompositeGrader:
    """Code grader for hard constraints, model grader for soft ones."""
    def grade(self, transcript, task) -> GradeResult:
        hard_pass = self.code_grader.grade(transcript, task)
        soft_score = self.model_grader.grade(transcript, task)
        return GradeResult(pass_=hard_pass, score=soft_score)
```

**Non-determinism handling:**
```python
def evaluate_task(task, n_trials=5):
    results = [run_trial(task) for _ in range(n_trials)]
    return {
        "pass_at_k": any(r.passed for r in results),
        "pass_power_k": all(r.passed for r in results),
        "score_mean": mean(r.score for r in results),
        "score_std": std(r.score for r in results),
    }
```

### Tier 3: A/B Testing & Production Monitoring

**Feature flag gating:**
```typescript
// Gate behavioral changes behind flags
if (getFeatureFlag('new_comment_rules')) {
  prompt += ANTI_COMMENT_RULES
}
```

**Telemetry events with eval-joinable keys:**
```typescript
logEvent('tool_use_decision', {
  experimentId: 'new_comment_rules_v2',
  variantId: 'treatment',
  sessionId,
  toolName,
  decision,
  // ... metrics
})
```

**Dashboard queries:**
```sql
-- Compare FC rate between control and treatment
SELECT variant,
  SUM(false_claims) / COUNT(*) as fc_rate,
  AVG(output_tokens) as avg_tokens,
  AVG(task_completion_score) as avg_score
FROM eval_results
JOIN experiment_exposures USING (session_id)
WHERE experiment = 'anti_overengineering_v3'
GROUP BY variant
```

### Tier 4: Ablation Testing

Use a feature flag that strips specific prompt sections:

```typescript
if (!feature('ABLATION_BASELINE')) {
  prompt += getAntiGoldPlatingRules()
}
```

Run the behavioral eval suite with and without each section. Measure the delta. If a prompt section doesn't measurably improve the eval metric it targets, it is dead weight that consumes context tokens for no benefit.

### Tier 5: Continuous Regression

The missing piece Anthropic is building:
- Run eval suite continuously on production-equivalent systems
- Alert when any metric crosses a threshold
- Block deployments that regress key metrics
- Use infrastructure-calibrated baselines (control for resource noise)

```
Prompt Change PR
  -> CI: Prompt smoke tests + snapshot tests (instant)
  -> Eval: Behavioral suite on n=50 tasks (minutes)
  -> Gate: All pass^5 metrics >= baseline - margin
  -> A/B: Deploy gated to 5% internal users
  -> Monitor: Track metrics for 48 hours
  -> Rollout: Un-gate if metrics hold
```

---

## Summary

Anthropic's evaluation strategy is **production-telemetry-centric with external benchmark validation**. The shipped artifact is heavily instrumented but contains no eval runners. The actual evaluation happens through:

1. **External benchmark harnesses** (SWE-bench, Terminal-Bench) running Claude Code as a black box
2. **Behavioral eval suites** (concision, file editing, over-engineering, false claims) with model-based and code-based graders
3. **A/B testing** via GrowthBook with telemetry flowing to BigQuery for analysis
4. **Classifier-specific evaluation** on three curated datasets (real traffic, overeager actions, synthetic attacks)
5. **Human review** of transcripts and community feedback

The biggest gap they've publicly acknowledged: **evals don't always catch the degradation users experience.** They are actively building more sensitive evaluations and continuous production monitoring. If you're building your own system, that gap is the opportunity -- build the transcript-based regression suite and the prompt snapshot tests that this codebase lacks.

---

*Confidence calibration: Architecture (high), specific tooling (medium), internal-only infrastructure (low). Where I've speculated, I've labeled it. Verify anything load-bearing before acting on it.*
