# Research Notes: docs-more Synthesis

Extraction from 9 research documents (ChatGPT & Gemini) analyzed for AgentHistoric v2 routing experiments.

## What Was Adopted (Experiments 1-4)

### 1. Specialist Rebalancing — Experiment 1 (prerequisite)
**Sources:** ChatGPT v2changes §rebalanced-regression, ChatGPT planned-v2 §7, ChatGPT AI Persona Bias Research §limitations
**Finding:** Current regression suite structurally favors Peirce/Popper. Scholar recommendation audits show rich-get-richer dynamics. Can't measure routing improvements without specialist-must-win cases.
**Action:** Add ~15 new cases for underrepresented experts + mixed-intent rerouting cases.

### 2. Anti-Triggers — Experiment 2
**Sources:** ChatGPT v2changes §4, ChatGPT AI Persona Bias Research §actionable
**Finding:** Generic verbs like `build`, `fix`, `implement` are too broad as first-pass selectors. Adding negative signals where an expert should *lose* score is cheap and high-signal.
**Action:** Add `antiTriggers` per routing heuristic. If `public API` appears, Peirce deprioritizes; Liskov boosts.

### 3. Two-Pass Routing — Experiment 3
**Sources:** ChatGPT planned-v2 §2, ChatGPT v2changes §2, Gemini Enhancing §3 (Select-Then-Route), Gemini Mode Collapse §actionable
**Finding:** Two-stage routing (broad domain → specific expert) consistently beats single-pass in literature. Select-Then-Route reported 91.7%→94.3% accuracy at ~4× cost reduction. Monolithic keyword routing suffers semantic confusability as expert pool grows.
**Action:** Formalize two-pass as a switchable toggle, add more two-pass test cases.

### 4. Persona vs Neutral Baseline — Experiment 4
**Sources:** ChatGPT v2changes §5 (Jekyll & Hyde), PRISM paper via Gemini Mode Collapse, ChatGPT Mitigating Expert Collapse §actionable
**Finding:** Persona prompting helps alignment/style but hurts accuracy on objective/reasoning tasks. Jekyll & Hyde (persona + neutral, judge selects) showed ~9.98% avg gain on GPT-4. PRISM 2026 confirmed: personas help alignment, damage knowledge retrieval.
**Action:** Add persona-vs-neutral tagged cases. Build comparison logic.

## What Was Deferred (Still Valuable)

### 5. Verbalized Sampling for Expert Selection
**Sources:** ChatGPT Mitigating Expert Collapse §actionable, Gemini Mode Collapse §Verbalized-Sampling, ChatGPT AI Persona Bias Research §actionable
**Finding:** Instead of "pick one expert," generate K candidates with probabilities, sample from tails (p < 0.10). Reports 1.6-2.1× diversity gains. Training-free.
**Why later:** Addresses discovery/diversity, not core routing accuracy. Natural Experiment 5 after routing is proven.

### 6. Selective Debate Routing (iMAD-style)
**Sources:** Gemini Enhancing §iMAD, ChatGPT Mitigating Expert Collapse §actionable, ChatGPT AI Persona Bias Research §actionable
**Finding:** Always-debate is expensive (3-5× tokens) and can degrade accuracy. iMAD's selective trigger cuts 92% tokens, gains 13.5% accuracy. Self-critique → hesitation features → classifier.
**Why later:** Council cases (CC1-CC4) already exist. Full iMAD-style gating needs simpler experiments proven first.

### 7. Panel/Judge-Based Selection
**Sources:** ChatGPT v2changes §3, ChatGPT planned-v2 §5, "When Agents Disagree" paper
**Finding:** Judge-based selection dramatically outperforms synthesis (win-rate 0.810). Independent drafts + judge > blended committee. 3-4 agents optimal; 5+ degrades.
**Why later:** Needs panel infrastructure. Test single-expert improvements first.

### 8. Thin vs Rich Persona Ablation
**Sources:** ChatGPT v2changes §first-ablations, Principled Personas paper, ChatGPT planned-v2 §3
**Finding:** Thin (name + 3 axioms + 2 guardrails) may outperform Rich for routing. Irrelevant persona details can cause ~30 point drops.
**Why later:** Ablation infra already exists. Easy add after Experiment 4 reveals whether personas help at all.

### 9. Dynamic Micro-Roles
**Sources:** ChatGPT v2changes §3, ChatGPT planned-v2 §3, Solo Performance Prompting paper
**Finding:** Generate task-specific child roles under existing archetypes (Peirce → "Minimal Patch Implementer"). Fine-grained > fixed coarse.
**Why later:** UX improvement, not core routing/validation. Refine the winner after eval harness proves approach.

### 10. Negative Constraints / Reverse Prompts (ROSE)
**Sources:** Gemini Mode Collapse §Negative-Constraints, ChatGPT AI Persona Bias Research §actionable, ChatGPT Mitigating Expert Collapse §actionable
**Finding:** Suppress mainstream by generating with reverse prompt that induces mainstream, then subtract/penalize overlaps. Up to +13.98% safety score. Needs logit access for full effect.
**Why later:** Requires logit access (open-weight) or two-generation pipeline. Optimization after routing accuracy established.

## Key Numbers

| Finding | Source | Number |
|---------|--------|--------|
| Persona prompts nearly double hallucination rate | Gemini Enhancing §1 | 9.8% → 18.7% |
| Irrelevant persona details cause performance drops | Principled Personas | up to ~30 points |
| Heterogeneous MAD > homogeneous on reasoning | Gemini Mode Collapse §2 | 82% → 91% (GSM-8K) |
| Optimal debate team size | ChatEval | 3-4 agents; 5+ degrades |
| iMAD selective debate token savings | iMAD paper | up to 92% reduction |
| iMAD accuracy improvement | iMAD paper | up to 13.5% |
| Jekyll & Hyde ensemble improvement | Persona Double-edged Sword | ~9.98% avg on GPT-4 |
| Verbalized Sampling diversity gain | VS paper | 1.6-2.1× |
| Select-Then-Route accuracy improvement | StR paper | 91.7% → 94.3% |
| Select-Then-Route cost reduction | StR paper | ~4× |

## Source Documents

1. `chatgpt - AI Persona Bias Researchj.md` — Literature review table + actionable techniques (VS, ROSE, selective debate, anti-mainstream)
2. `chatgpt - Mitigating Expert Collapse in LLM Persona Generation.md` — Deep lit review with architecture diagram, prompt templates, rollout checklist
3. `chatgpt - You're seeing a real design effect, not .md` / `chatgpt - v2changes.md` — Diagnosis of AgentHistoric's structural bias + concrete change list
4. `chatgpt - planned v2.md` — 8-step plan: task card routing, micro-roles, delivery vs discovery mode, panel selection, benchmark rebuild
5. `gemini - Enhancing LLM Personas and Routing.md` — Cosplay fallacy, Select-Then-Route, PRISM, ConfMAD, token economics
6. `gemini - LLM Persona Bias Mitigation Research.md` — Mode collapse etiology, ChatEval, iMAD, Verbalized Sampling, negative constraints
7. `gemini - Mitigating Persona Mode Collapse.md` — Scatter-Gather, DSP, epistemic drift, compounded hallucination loops
8. `gemini - incontext-orc.md` — In-context orchestration without frameworks (portable, IDE-agnostic)
