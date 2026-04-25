You’re seeing a real design effect, not a mirage. AgentHistoric currently forces exactly one primary expert unless a named pipeline is invoked, discourages default blending, and routes with a priority-ordered keyword table. On top of that, Peirce’s activation description is unusually broad, while specialists like Dijkstra, Shannon, Liskov, and Simon are much narrower, and the regression fixtures lean heavily toward implementation and debugging cases. That combination will keep rediscovering Peirce and Popper on programming-heavy prompts. ([GitHub][1])

I would not try to “equalize” expert frequency. Most software work really should still end up near implementation or falsification. The goal is controlled orthogonality: bring in a specialist when the task has a second dimension like public boundary design, state invariants, retrieval compression, workflow control, UX cost, or pattern institutionalization. On the prompt you gave me, I would not start with Peirce; I would start with Simon, then pull in Dennett and Shannon, with Popper as critic. That matches the actual object of the task better than “implementation/debugger first.” ([GitHub][2])

The strongest research signal is not “add more historical detail.” It is “use finer-grained routing and more test-time structure.” Solo Performance Prompting found that dynamically identified fine-grained personas outperform fixed coarse personas, and even suggested that a fine-grained persona name can sometimes be enough without a long profile. But newer persona studies also warn that expert personas are mixed in effect, highly sensitive to irrelevant details, and strongly task-dependent; one EMNLP 2025 paper reports large performance drops from irrelevant persona attributes, and another recent study shows that persona prompt formulation itself materially changes outcomes. So richer biography is not automatically better. ([arXiv][3])

What I would change in AgentHistoric v2:

1. **Split each expert into a router card and a voice layer.**
   The router should see capability metadata, anti-overlap rules, example tasks, and team roles. The active expert prompt can still carry the historical voice, guardrails, and attested framing. That separation fits the literature: persona details can help when they are task-relevant, but irrelevant persona detail can hurt robustness, so the routing surface should be leaner than the performance surface. ([arXiv][4])

2. **Move from keyword → expert to task fingerprint → routing mode → expert.**
   Your “route general, then route again to hyper-focused” idea is good, and it has support. Least-to-most prompting, Plan-and-Solve, and Tree of Thoughts all show that decomposition before final solving improves hard tasks, while newer prompt-routing work argues that manual taxonomies miss fine-grained distinctions and that two-stage routing beats monolithic routing. I would make the router first emit a task fingerprint with fields like `objective`, `artifact`, `risk_axes`, `ambiguity`, `novelty`, `evidence_mode`, `scope`, `recurrence`, and `human_exposure`, then choose a routing mode from `single`, `pair`, `panel`, `pipeline`, or `neutral_control`, and only then select the actual expert(s). ([OpenReview][5])

3. **Add dynamic micro-roles under each historical parent instead of adding a pile of new philosophers first.**
   Keep Peirce, Simon, Dijkstra, Liskov, Shannon, and the rest as top-level archetypes, but generate task-specific child roles like “Minimal Patch Implementer,” “Stopping-Condition Designer,” “Plugin Boundary Auditor,” or “State Transition Checker.” That gives you the extra minutia you want without exploding the ontology. It also lines up well with the finding that dynamically identified fine-grained personas outperform fixed general personas, while overloading prompts with irrelevant persona detail can reduce robustness. ([arXiv][3])

4. **Relax the single-primary rule with uncertainty-triggered team routing.**
   Self-consistency, multi-agent debate, Mixture-of-Agents, and simple sampling-and-voting all point in the same direction: multiple reasoning paths plus aggregation often beat a single pass. But Self-MoA is an important warning that quality matters more than blindly mixing sources. For your repo, that means starting with the same strong base model and varying persona/micro-role prompts, not immediately mixing lots of different models. I would use panels only when router margin is low, ambiguity is high, or the task has orthogonal objectives. ([OpenReview][6])

A few panel templates are enough to start. For ambiguous feature strategy, use **Dennett → Rogers → Descartes**. For routing/workflow problems, use **Simon → Shannon → Blackmore**. For stateful correctness, use **Dijkstra → Popper → Peirce**. For public API or plugin boundaries, use **Liskov → Descartes → Peirce**. Those teams are not random variety; they are orthogonal lenses drawn from the responsibilities your experts already claim. ([GitHub][7])

5. **Add a neutral control path.**
   This is the part I would treat as non-optional. Recent persona work is pretty clear that personas can help, but they can also hurt accuracy when they are misaligned with task type. Jekyll & Hyde shows that role-prompt + neutral-prompt ensembles are more robust than unilateral role prompting, and PRISM’s early 2026 results point in the same direction: personas may help alignment while hurting accuracy unless routing is intent-conditioned. So for high-stakes or ambiguous tasks, run `neutral` in parallel with `persona`, then let a critic or judge choose. That gives you a real answer to “did the persona actually help here?” instead of relying on aesthetics. ([arXiv][8])

6. **Stop hand-editing prompts in the dark and optimize them against the suite.**
   APE and Promptbreeder both show that automatic instruction search/evolution can beat human-crafted prompts. Your repo already has regression fixtures, and your own review doc says you now have pass@k/pass^k and ablation infrastructure. That means you are in a good position to optimize activation descriptions, routing exemplars, handoff phrasing, and even the “thin vs rich persona” prompt formats against actual outcomes instead of tuning by intuition alone. ([arXiv][9])

The first concrete ablations I would run are these:

1. **Thin vs medium vs rich personas.**
   Thin = name + 3 axioms + 2 guardrails. Medium = capability card + 1 historical line. Rich = current full attested prompt. My guess is that routing and execution will often benefit from thin/medium more than rich, especially for specialists, but this is exactly the kind of thing the literature says to test rather than assume. ([arXiv][4])

2. **Hierarchical router vs current router.**
   Baseline current priority-keyword routing, then compare against `task fingerprint -> mode -> expert`. Measure not just pass@1, but specialist hit-rate on prompts written for Liskov/Dijkstra/Shannon/Simon/Blackmore, plus router calibration and regret against an oracle best expert. ([GitHub][10])

3. **Single expert vs pair vs panel vs neutral-control.**
   Measure panel uplift, neutral-vs-persona uplift, and cost. Debate/MoA-style systems often win, but only when the extra calls buy real orthogonality. High token cost with no uplift means the panel is theatrical, not useful. ([arXiv][11])

4. **Rebalanced regression coverage.**
   Right now the suite helps preserve Peirce/Popper wins. Add more mixed-intent prompts and more “specialist should obviously win” prompts. You do not need equal counts, but you do need enough pressure that Liskov, Dijkstra, Shannon, Simon, Rogers, Knuth, and Blackmore can actually earn their keep. ([GitHub][12])

The blunt version is this: **the next level is not more philosophers first**. It is finer task fingerprints, dynamic micro-roles, uncertainty-aware panels, a neutral control path, and automatic prompt optimization. Keep Peirce; just stop letting him occupy half the ontology. The next best move is a `router.v2` schema and an expanded regression suite built to test these hypotheses head to head.

[1]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/system.json "https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/system.json"
[2]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/experts/expert-orchestrator-simon.json "https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/experts/expert-orchestrator-simon.json"
[3]: https://arxiv.org/html/2307.05300v3 "https://arxiv.org/html/2307.05300v3"
[4]: https://arxiv.org/abs/2508.19764 "https://arxiv.org/abs/2508.19764"
[5]: https://openreview.net/forum?id=WZH7099tgfM "https://openreview.net/forum?id=WZH7099tgfM"
[6]: https://openreview.net/forum?id=1PL1NIMMrw "https://openreview.net/forum?id=1PL1NIMMrw"
[7]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/experts/expert-visionary-dennett.json "https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/experts/expert-visionary-dennett.json"
[8]: https://arxiv.org/html/2408.08631v1 "https://arxiv.org/html/2408.08631v1"
[9]: https://arxiv.org/abs/2211.01910 "https://arxiv.org/abs/2211.01910"
[10]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/compiled/cursor/rules/01-router.mdc "https://raw.githubusercontent.com/barretts/AgentHistoric/main/compiled/cursor/rules/01-router.mdc"
[11]: https://arxiv.org/abs/2305.14325 "https://arxiv.org/abs/2305.14325"
[12]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/regression/fixtures/cases.json "https://raw.githubusercontent.com/barretts/AgentHistoric/main/regression/fixtures/cases.json"


You’re not imagining it. The current repo structurally favors Peirce and Popper. I counted from the JSON: Peirce appears in eight routing heuristics and all four pipelines, Popper in five heuristics and three pipelines, while Liskov, Knuth, Dijkstra, Shannon, and Simon only appear in one or two heuristics each. Peirce and Popper also get very broad trigger language, and the regression set leans toward them as expected-primary experts more often than the narrower specialists. In other words, the system already contains a good roster of lenses, but the routing prior gives two of them much more surface area than the rest. ([GitHub][1])

The bigger research takeaway is this: do **not** solve this mainly by adding more persona names. The literature is pretty clear that persona prompting is mixed. One large study found that personas in system prompts generally did not improve objective-task performance and that automatically picking the best persona was difficult, often near random. A newer EMNLP paper found expert personas can help, but models are highly sensitive to irrelevant persona details, with performance drops approaching 30 points in some settings. And the newest PRISM paper says the effect depends on task type, prompt length, placement, and model family; personas help more on generative/alignment tasks than on discriminative ones. ([arXiv][2])

So the move I’d make is: **separate routing from persona**. Route first in a neutral task space, then attach a persona only when that lens is likely to help. Recent routing work is moving exactly this way. FineRouter uses a two-stage design: first discover fine-grained task types, then do task-aware quality estimation, and it beat baselines while outperforming the strongest single model at less than half the cost. RouteLLM likewise shows that learned routing from preference data can preserve quality while reducing cost substantially. My inference for AgentHistoric is that “historical persona” should be the **rendering/execution layer**, not the first classifier. ([arXiv][3])

A concrete version for your project would be a 3-step progression:

1. **Neutral task card.** Extract: objective, artifact, ambiguity, risk axes, operation needed, and evidence requirement.
2. **Broad route.** Choose a shortlist by facets like `explore`, `implement`, `falsify`, `compress`, `orchestrate`, `humanize`, `abstract`, `measure`, `state reasoning`.
3. **Hyper-focused reroute.** Once the task card is sharper, choose the specialist or opt into a panel.

That directly matches your instinct about “router to general, route again to hyper-focused.” It is also much closer to the evidence than a one-pass keyword router with coarse SDLC buckets. ([arXiv][3])

The second change is to add a **neutral baseline path** for objective tasks. A very relevant paper, *Persona is a Double-edged Sword*, found role-play prompts hurt Llama 3 on 7 of 12 reasoning datasets, and their “Jekyll & Hyde” fix was to run both a persona-prompted and a neutral-prompted path, then select the better answer with an evaluator. They also found LLM-generated personas were more stable than handcrafted ones. For AgentHistoric, that means Peirce should not be the only shot at a coding task; you should often compare `neutral` vs `Peirce`, or `neutral` vs `Popper`, and pick the better one. ([arXiv][4])

The third change is to use **team routing only with strong selection**, not freeform synthesis. The multi-agent literature is now pretty explicit that selector quality matters more than “diversity” by itself. The original Mixture-of-Agents paper showed that layered multi-agent setups can outperform strong single models. But newer work complicates that: *Rethinking Mixture-of-Agents* found that aggregating outputs from a single top model often beats mixing different models, because average output quality matters a lot; and *When Agents Disagree* found judge-based selection dramatically outperformed synthesis-style aggregation, with the selector being the key lever. So for your system, “multiple points of view” should mean **independent drafts plus a judge**, not one mashed-up blended answer. ([arXiv][5])

That suggests a very good default panel shape for AgentHistoric: **generator + falsifier + judge**. For example, on a novel systems question: Dennett generates alternatives, Popper attacks assumptions, Shannon compresses the real signal, and a neutral judge or Descartes selects the next move. On a workflow question: Simon decomposes the procedure, Popper attacks failure modes, Blackmore extracts the durable pattern, and the judge decides the plan. This is stronger than “blend personas,” and it still respects your current rule that personas should not be blended by default unless the router explicitly authorizes a handoff or pipeline. ([arXiv][6])

For reasoning-heavy tasks, there is also a simpler trick that is probably underused in your design: **multiple independent drafts from the same expert before switching experts**. Self-consistency showed that sampling multiple reasoning paths and selecting the most consistent answer gives large gains on reasoning benchmarks. Combined with the newer Self-MoA result, that suggests a strong pattern: before you build a big heterogeneous team, first try `same expert x3` or `neutral x2 + persona x1`. In practice, that means you may get better results from three independent Peirce drafts with a selector than from Peirce + Popper + Descartes all talking over each other. ([arXiv][7])

What I would change in the repo first, without rewriting the whole concept:

* Narrow Peirce and Popper triggers. Generic verbs like `build`, `fix`, `implement`, `debug`, `broken`, and `code review` are too broad to be first-pass selectors. Move them into the neutral task-card phase. ([GitHub][8])
* Add **anti-triggers**. Example: if the task mentions `public API`, `contract`, or `plugin boundary`, Peirce should lose score and Liskov should gain. If it mentions `retrieval`, `token budget`, or `compression`, Popper should lose score and Shannon should gain. That fixes a big part of the “Peirce everywhere” problem. ([GitHub][9])
* Rebalance the regression suite. Right now it teaches the system that Peirce/Popper are the center of gravity. Add 8–10 hard cases each for Liskov, Shannon, Simon, Dijkstra, Knuth, and mixed-intent rerouting cases. Evaluate not just “did it pick the expected expert,” but “did the answer win in pairwise comparison.” ([GitHub][10])
* Add a `panel` pipeline type that is opt-in and explicit: `independent_drafts -> judge_select` instead of `conversation -> synthesis`. Research is much more favorable to that shape. ([arXiv][11])
* Keep the philosopher layer, but route on **facets** internally. The historical names are good UX. They are not a great latent taxonomy by themselves. That distinction is the cleanest way to preserve what you like about Peirce without letting him eat the whole system. ([arXiv][12])

The newest persona/routing papers I leaned on here are March 2026 arXiv preprints, so I’d treat them as strong signals rather than settled law. But they line up with the older, more established evidence: personas are useful in some regimes, harmful in others, and the quality of routing and selection matters more than adding more colorful names. ([arXiv][13])

Next move: rewrite `router.json` around a neutral task-card plus shortlist scorer, then rebalance `cases.json` so the underused specialists finally get a fair fight.

[1]: https://github.com/barretts/AgentHistoric "GitHub - barretts/AgentHistoric: Philosopher-based prompt system for multi-editor AI agent routing · GitHub"
[2]: https://arxiv.org/abs/2311.10054 "[2311.10054] When \"A Helpful Assistant\" Is Not Really Helpful: Personas in System Prompts Do Not Improve Performances of Large Language Models"
[3]: https://arxiv.org/pdf/2603.19415 "Scalable Prompt Routing via Fine-Grained Latent Task Discovery"
[4]: https://arxiv.org/abs/2408.08631 "[2408.08631] Persona is a Double-edged Sword: Mitigating the Negative Impact of Role-playing Prompts in Zero-shot Reasoning Tasks"
[5]: https://arxiv.org/abs/2406.04692 "[2406.04692] Mixture-of-Agents Enhances Large Language Model Capabilities"
[6]: https://arxiv.org/abs/2305.19118 "[2305.19118] Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate"
[7]: https://arxiv.org/abs/2203.11171 "[2203.11171] Self-Consistency Improves Chain of Thought Reasoning in Language Models"
[8]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/experts/expert-engineer-peirce.json "raw.githubusercontent.com"
[9]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/prompt-system/experts/expert-abstractions-liskov.json "raw.githubusercontent.com"
[10]: https://raw.githubusercontent.com/barretts/AgentHistoric/main/regression/fixtures/cases.json "raw.githubusercontent.com"
[11]: https://arxiv.org/abs/2603.20324 "[2603.20324] When Agents Disagree: The Selection Bottleneck in Multi-Agent LLM Pipelines"
[12]: https://arxiv.org/abs/2508.19764 "[2508.19764] Principled Personas: Defining and Measuring the Intended Effects of Persona Prompting on Task Performance"
[13]: https://arxiv.org/abs/2603.18507 "[2603.18507] Expert Personas Improve LLM Alignment but Damage Accuracy: Bootstrapping Intent-Based Persona Routing with PRISM"
