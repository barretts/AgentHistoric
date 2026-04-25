Yes. Here’s the plan I’d actually build.

The core diagnosis stays the same: AgentHistoric is getting pulled toward Peirce and Popper because the current system makes one primary expert mandatory, routes with a priority-ordered heuristic table, and evaluates against a suite that still encodes a lot of implementation and debugging expectations. That is a real architectural prior, not a lack of imagination on your part. ([GitHub][1])

The research says the fix is **not** “add more philosophers and hope for variety.” Persona prompting is mixed on objective tasks, can be highly sensitive to irrelevant details, and sometimes hurts reasoning when misapplied. At the same time, alignment and preference tuning reduce diversity, and expert-recommendation audits show LLMs tend to overselect prominent, high-visibility names. So your project needs better routing, better selection, and better evaluation before it needs a bigger cast. ([arXiv][2])

I also folded in the strongest parts of your uploaded notes: keep the system portable and text-native, preserve the markdown/rules approach, use structured state instead of framework lock-in, and treat diversity forcing as a deliberate operating mode rather than the default for every task.     

## The single plan

### 1. Keep the project prompt-native, but make the prompt system stateful

Do **not** jump to LangGraph or AutoGen as the core product if portability is part of the vision. Keep the source of truth as markdown/JSON specs that can compile into Cursor, Copilot, ChatGPT, Claude, and anything else later. But add a small persistent state layer, like `_historic_state.md`, that stores the current task card, selected mode, candidate experts, and judge verdict. That matters because persona fidelity degrades over longer, goal-oriented conversations; the model tends to drift back toward its default assistant behavior over time. Use compact structured blocks like `<task_card>`, `<route>`, and `<judge_verdict>`, not free-form “thought dumps.”  ([arXiv][3])

### 2. Replace `keyword -> expert` with `task card -> mode -> expert`

This is the biggest upgrade. Your router should stop deciding “Peirce or Popper?” from raw keywords and instead emit a neutral task fingerprint first. The literature is moving hard toward two-stage routing because monolithic routers miss fine-grained distinctions as the pool grows. Build a `router.v2` that first extracts a task card, then chooses a routing mode, then picks the expert or panel. ([arXiv][4])

A good starting schema is:

```json
{
  "task_card": {
    "objective": "implement | diagnose | design | explore | compress | formalize | humanize",
    "artifact": "code | architecture | workflow | prompt | test | docs",
    "ambiguity": 0.0,
    "novelty": 0.0,
    "evidence_mode": "neutral | persona | retrieval",
    "risk_axes": ["correctness", "ux", "maintainability", "cost"],
    "human_exposure": "low | medium | high"
  },
  "mode": "neutral_single | persona_single | self_consistency | panel_select | pipeline",
  "broad_facets": ["implement", "falsify"],
  "candidate_experts": []
}
```

This lets the historical names stay as the UX layer while the actual classification happens in a cleaner internal space.

### 3. Split each expert into three artifacts

Right now the persona is doing too much. Make every expert three things:

* a **router card**: triggers, anti-triggers, typical wins, typical losses, allowed panels
* a **voice card**: the attested style and behavioral guardrails
* an **evidence pack**: 5–10 compact principles, excerpts, or canonical examples

That separation fits the evidence well. Persona details can help when they are task-relevant, but irrelevant persona details can hurt robustness. And for any long-tail or obscure expert, an evidence pack is much safer than asking the model to improvise a convincing cosplay. Retrieval-grounded persona work points the same way: constrain the persona to evidence and allow abstention when the grounding is thin. ([arXiv][5])

Under each historical parent, add **micro-roles** instead of new top-level thinkers first. So Peirce becomes things like `Minimal Patch Implementer`, `Migration Surgeon`, `Boundary Patcher`; Liskov gets `Public API Auditor`; Dijkstra gets `Invariant Checker`; Shannon gets `Compression Refiner`; Simon gets `Workflow Router`. This gives you the minutia you want without exploding the ontology.

### 4. Introduce two operating modes: delivery mode and discovery mode

This is where most persona projects get sloppy. You need one mode for **shipping correct work** and another for **discovering novel angles**.

**Delivery mode** should be the default for coding, debugging, and correctness-heavy tasks. Start neutral or lightly persona-conditioned, and compare against a persona path when it is plausible that the lens helps. That is straight out of the “persona is a double-edged sword” result and PRISM’s intent-conditioned routing idea. ([arXiv][6])

**Discovery mode** is where you aggressively seek novelty. Here, use verbalized sampling to ask for multiple candidate experts or micro-roles with estimated probabilities, then prefer the non-obvious but still plausible tail candidates. That is much better than just turning up temperature. In fact, recent auditing work shows higher temperature tends to hurt validity and factuality, while diversity interventions mostly trade one dimension off against another. ([arXiv][7])

A practical discovery prompt pattern is:

```text
List 5 plausible experts or micro-roles for this task.
For each, give:
- relevance score
- mainstreamness score
- one-sentence rationale
Exclude candidates with high overlap in method.
Then nominate the best low-mainstreamness candidate that still clears the relevance threshold.
```

That is where your uploaded “negative constraints” and anti-mainstream forcing belong: **discovery mode only**, not always-on system behavior. 

### 5. Redesign multi-expert routing around selection, not synthesis

When you use a team, do not let them free-blend by default. The strongest pattern in the recent literature is that **selector quality matters more than diversity theater**. Multi-agent systems can help, but heterogeneous roles matter, cloned roles are weak, and judge-based selection often beats mash-up synthesis. Also, debate should not run all the time. ([arXiv][8])

Use this escalation ladder:

1. **neutral single**
2. **persona single**
3. **same expert x3 + self-consistency**
4. **independent panel drafts + judge select**
5. **explicit pipeline**, only when the task really changes form

That third step is important. Before you pay for a big panel, try multiple independent drafts from the same expert and select the most consistent answer. Self-consistency is a cheap, strong baseline. ([arXiv][9])

For panels, keep them small and orthogonal. Three defaults are enough to start:

* **workflow/routing**: Simon + Shannon + Blackmore + neutral judge
* **state/correctness**: Dijkstra + Popper + Peirce + neutral judge
* **public API/product boundary**: Liskov + Descartes + Peirce + neutral judge

Protocol should be `independent_drafts -> judge_select -> optional merge`, not conversation soup.

### 6. Make debate selective and cheap

iMAD is the right instinct here: only trigger debate when uncertainty signals say it is likely to help. A self-critique step that emits hesitation cues, ambiguity, and confidence is enough for a prompt-native version before you ever train a classifier. And once a panel is active, stop when the verdict stabilizes instead of always running fixed rounds. ([arXiv][10])

So in practice:

* if router confidence is high and ambiguity low: stay single-path
* if persona vs neutral disagree: go to judge-select
* if specialist margin is low: use a small panel
* if the judge is stable after one round: stop

That preserves productivity. Most prompts stay cheap. Only the interesting ones pay for extra structure.

### 7. Rebuild the benchmark before adding more experts

Right now the suite mostly preserves the current worldview. Expand it so specialists have to win on their own turf. Add four new suites:

* **specialist routing**: obvious wins for Liskov, Shannon, Simon, Dijkstra, Knuth
* **mixed intent**: prompts that should broad-route, then reroute
* **persona vs neutral**: same task, both paths, pairwise judged
* **persistence**: 10–20 turn conversations to detect drift

This is also where you stop measuring “did it pick the expected philosopher?” as the main outcome. Better metrics are: answer win rate, router calibration, specialist hit rate, panel ROI, neutral-vs-persona uplift, and drift under longer interactions. Persona evaluation work now has better protocols for exactly these questions. ([GitHub][11])

### 8. Only after that, automate prompt optimization

Once the evaluation harness is real, stop hand-tuning every prompt by feel. Use APE or Promptbreeder on:

* router exemplars
* anti-triggers
* micro-role descriptions
* judge rubrics
* discovery-mode candidate prompts

That is a much better use of your time than endlessly rewriting Peirce’s biography. And if you want a later research branch, use a small Directional Stimulus Prompting-style helper to emit instance-specific hints for routing or micro-role selection. But that should come **after** the prompt-native v2 is stable, not before. ([arXiv][12])

## What I would not do yet

Do not add a bunch of new top-level experts. Do not optimize for equal expert frequency. Do not run debate on every prompt. Do not rely on temperature as your main diversity knob. Do not move to LoRA adapters or a heavy orchestration framework until the prompt-only spec has a clean win on your benchmark. Those are all seductive moves, but the evidence says they either blur the signal or move complexity forward before the core design is validated. ([arXiv][2])

## The concrete repo shape I’d target

* `prompt-system/router.v2.json`
* `prompt-system/protocols/modes.md`
* `prompt-system/protocols/panel-select.md`
* `prompt-system/state/_historic_state.md`
* `prompt-system/experts/<expert>.router.json`
* `prompt-system/experts/<expert>.voice.md`
* `prompt-system/experts/<expert>.evidence.md`
* `regression/suites/specialists.json`
* `regression/suites/persona_vs_neutral.json`
* `regression/suites/persistence.json`
* `eval/scorecard.md`

The simplest success condition is this: historical personas become the **execution lens**, not the **first classifier**; diversity becomes a **mode**, not a constant; panels become **judge-driven**, not theatrical; and every change is tested against a benchmark that can prove whether the extra complexity actually helped. The newer 2025–2026 papers are still early, but they line up with the older results well enough to make this a solid direction. ([arXiv][13])

The next best move is to draft `router.v2` and the new benchmark suites together, because those two files will determine almost everything else.

[1]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/system.json "raw.githubusercontent.com"
[2]: https://arxiv.org/abs/2311.10054?utm_source=chatgpt.com "When \"A Helpful Assistant\" Is Not Really Helpful: Personas in System Prompts Do Not Improve Performances of Large Language Models"
[3]: https://arxiv.org/abs/2512.12775?utm_source=chatgpt.com "Persistent Personas? Role-Playing, Instruction Following, and Safety in Extended Interactions"
[4]: https://arxiv.org/abs/2603.19415?utm_source=chatgpt.com "Scalable Prompt Routing via Fine-Grained Latent Task Discovery"
[5]: https://arxiv.org/abs/2508.19764?utm_source=chatgpt.com "Principled Personas: Defining and Measuring the Intended Effects of Persona Prompting on Task Performance"
[6]: https://arxiv.org/abs/2408.08631?utm_source=chatgpt.com "Persona is a Double-edged Sword: Mitigating the Negative Impact of Role-playing Prompts in Zero-shot Reasoning Tasks"
[7]: https://arxiv.org/abs/2510.01171?utm_source=chatgpt.com "Verbalized Sampling: How to Mitigate Mode Collapse and Unlock LLM Diversity"
[8]: https://arxiv.org/abs/2308.07201?utm_source=chatgpt.com "ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate"
[9]: https://arxiv.org/abs/2203.11171?utm_source=chatgpt.com "Self-Consistency Improves Chain of Thought Reasoning in Language Models"
[10]: https://arxiv.org/abs/2511.11306?utm_source=chatgpt.com "iMAD: Intelligent Multi-Agent Debate for Efficient and Accurate LLM Inference"
[11]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/regression/fixtures/cases.json "raw.githubusercontent.com"
[12]: https://arxiv.org/abs/2211.01910?utm_source=chatgpt.com "Large Language Models Are Human-Level Prompt Engineers"
[13]: https://arxiv.org/abs/2603.18507?utm_source=chatgpt.com "Expert Personas Improve LLM Alignment but Damage Accuracy: Bootstrapping Intent-Based Persona Routing with PRISM"
