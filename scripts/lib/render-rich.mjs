import { codeFence, humanizeExpertId, resolveRequiredSections, VOICE_CALIBRATION, SCAFFOLDED_VOICE } from "./prompt-system.mjs";

export function renderRichInit(system, options = {}) {
  const g = system.globalRuntime;
  const reasons = {
    "your_test_command | grep": "destroys context",
    "pytest | tail": "hides early failures",
    "cargo test 2>&1 | head": "truncates stack traces"
  };

  let out = "";
  out += `# ${g.name}\n\n`;
  out += `**Version:** ${g.version} (Philosophical Engineering Edition)\n`;
  out += `**Context:** ${g.context}\n\n`;

  // Constraint Hierarchy
  if (system.constraintHierarchy) {
    const ch = system.constraintHierarchy;
    out += `## Constraint Hierarchy\n\n`;
    out += `${ch.description}\n\n`;
    for (const layer of ch.layers) {
      out += `- **${layer.name}** (${layer.source}): ${layer.scope}.\n`;
    }
    out += `\n**Invariant:** ${ch.invariant}\n\n`;
  }

  // Section 1: Logging
  out += `## 1. The Non-Destructive Logging Protocol\n\n`;
  out += `**The Hazard:** ${g.logging.hazard}\n\n`;
  out += `**The Principle:** ${g.logging.principle} ${g.logging.required.join(" ")}\n\n`;
  out += `**The Pattern (adapt the command to your runtime):**\n\n`;
  out += codeFence(g.logging.extendedPattern.join("\n"), "bash");
  out += `\n\n**Forbidden:**\n`;
  out += g.logging.forbidden
    .map((cmd) => {
      const r = reasons[cmd];
      return r ? `- \`${cmd}\` (${r})` : `- \`${cmd}\``;
    })
    .join("\n");
  out += `\n\n${g.logging.violationNote}\n\n`;

  // Section 2: Mandate
  out += `## 2. All Test, Build, and Run Commands MUST Be Logged\n\n`;
  out += `${g.logging.mandate}\n\n`;

  // Section 3: Epistemic rules
  out += `## 3. Epistemic Humility & Communication Constraints\n\n`;
  out += `* **Truthfulness:** ${g.uncertaintyRules[0]}\n`;
  out += `* **Uncertainty:** Quantify uncertainty. State claims as VERIFIED (backed by tests/docs) or HYPOTHESIS (needs checking). Provide confidence intervals: "~80% confidence; verify by running X."\n`;
  out += `* **Encoding:** ${g.encodingRules.join(" ")}`;
  out += `\n\n`;

  // Voice section
  const voiceItems = options.scaffolded ? SCAFFOLDED_VOICE : VOICE_CALIBRATION;
  const voiceHeading = options.scaffolded ? "Scaffolded Voice" : "Voice Calibration";
  out += `## ${voiceHeading}\n\n`;
  out += voiceItems.map((item) => `- ${item}`).join("\n");
  out += `\n\n`;

  // Section 4: Done
  out += `## 4. Definition of Done\n\n`;
  out += `"Done" means code + tests + verified. Placeholders, pseudo-code, and "TODOs" in core logic are globally rejected.\n\n`;

  // Section 5: Constraints
  out += `## 5. Foundational Constraints\n\n`;
  out += g.foundationalConstraintsDetailed
    .map((c) => `* **${c.name}:** ${c.description}`)
    .join("\n");
  out += `\n\n`;

  // Section 6: Registry
  out += `## 6. Swarm Registry\n`;
  out += system.experts
    .map((e) => `* **${e.id}:** ${e.summary}`)
    .join("\n");
  out += `\n`;

  return out;
}

export function renderRichRouter(system, options = {}) {
  const r = system.router;

  let out = "";
  out += `# ${r.name}\n\n`;
  out += `**Role:** Front-line Triage and Pipeline Controller\n\n`;
  out += `${r.personaIntro}\n\n`;
  out += `**CRITICAL OVERRIDE:** If the user asks to perform a massive, repetitive task across multiple files ("verify all components," "update all imports," "check all stories"), do NOT route this as a manual task. Route to the \`automation_generation\` sequence to build a tool or script to delegate the work systematically.\n\n`;
  if (options.debug) {
    out += `**Heading Purity Rule:** Once a primary expert is selected, the visible response may contain only **Selected Expert**, **Reason**, **Confidence**, and that expert's required headings unless an explicit allowed handoff is named. VERIFIED and HYPOTHESIS are inline uncertainty labels, never headings.\n\n`;
  }

  // Routing heuristics table
  out += `## 1. Routing Heuristics\n\n`;
  out += `Analyze the prompt against these heuristics, in priority order:\n\n`;
  out += `| Priority | Domain | Expert(s) | Keywords / Signals |\n`;
  out += `|----------|--------|-----------|-------------------|\n`;
  for (const h of r.routingHeuristics) {
    const experts = h.experts.map((id) => humanizeExpertId(id)).join(" -> ");
    const signals = h.signals.map((s) => `"${s}"`).join(", ");
    out += `| ${h.priority} | ${h.domain} | ${experts} | ${signals} |\n`;
  }

  // Disambiguation
  out += `\n### Routing Disambiguation\n\n`;
  for (const [key, examples] of Object.entries(r.disambiguation)) {
    const heading = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
    out += `**${heading}:**\n`;
    out += examples.map((s) => `- "${s}"`).join("\n");
    out += `\n\n`;
  }

  // Pipeline tables
  out += `\n\n## 2. Pipeline Sequences\n\n`;
  out += `When a task spans multiple domains, adopt the sequence below. Apply the primary expert's constraints first, then shift methodology as the domain changes.\n\n`;
  for (const pipeline of r.pipelines) {
    out += `### ${pipeline.name}\n`;
    out += `| Step | Expert | Task |\n|------|--------|------|\n`;
    for (let i = 0; i < pipeline.steps.length; i++) {
      const s = pipeline.steps[i];
      out += `| ${i + 1} | ${humanizeExpertId(s.expert)} | ${s.task} |\n`;
    }
    out += `\n`;
  }

  // Automation
  out += `## 3. Automation over Attrition\n\n`;
  out += `${r.automationOverAttrition}\n`;
  if (options.debug) {
    out += `\nBefore solving any request, emit a routing block with exactly: **Selected Subfolder**, **Selected Expert**, **Reason**, and **Confidence (0-1)**.\n`;
    out += `Do not continue until that routing block is complete.\n`;
    out += `If confidence is below 0.65, ask one clarifying question instead of proceeding.\n`;
    out += `For non-trivial requests, the visible response must begin with **Selected Expert**, **Reason**, and **Confidence** before any expert-specific sections.\n`;
    out += `After that preamble, use only the active expert's required headings. Do not emit headings, labels, or deliverable names from any other expert unless the router names an explicit handoff.\n`;
    out += `Keep VERIFIED and HYPOTHESIS inside the body text of the selected sections; do not promote them to headings or pseudo-headings.\n`;
  }

  return out;
}

export function renderRichExpert(system, expert, options = {}) {
  let out = "";
  let section = 0;

  // Header
  out += `# PERSONA INIT: ${expert.id}\n\n`;
  out += `**Role:** ${expert.title}\n`;
  out += `**Philosophy:** ${expert.philosophy}\n\n`;
  out += `${expert.personaIntro}\n\n`;

  // Core Philosophy
  if (expert.corePhilosophy?.length) {
    section++;
    out += `## ${section}. Core Philosophy\n\n`;
    for (const p of expert.corePhilosophy) {
      out += `**${p.name}:** ${p.description}\n\n`;
    }
  }

  // Method
  section++;
  out += `## ${section}. Method\n\n`;
  if (expert.methodIntro) {
    out += `${expert.methodIntro}\n\n`;
  }
  for (let i = 0; i < expert.methodSteps.length; i++) {
    out += `${i + 1}. **${expert.methodSteps[i]}**\n`;
  }
  out += `\n`;

  // Contextual notes (Descartes)
  if (expert.contextualNotes?.length) {
    out += expert.contextualNotes.map((n) => `${n}\n`).join("\n");
    out += `\n`;
  }

  // Logging pattern (Popper)
  if (expert.loggingPattern?.length) {
    out += codeFence(expert.loggingPattern.join("\n"), "bash");
    out += `\n\n`;
  }

  // Meme cycle (Blackmore)
  if (expert.memeCycle?.length) {
    out += `The meme lifecycle:\n`;
    for (let i = 0; i < expert.memeCycle.length; i++) {
      out += `${i + 1}. **${expert.memeCycle[i]}**\n`;
    }
    out += `\n`;
  }

  // Pattern template (Blackmore)
  if (expert.patternTemplate) {
    section++;
    out += `## ${section}. Pattern Storage\n\n`;
    if (expert.storageRules?.length) {
      out += expert.storageRules.map((r) => `- ${r}`).join("\n");
      out += `\n\n`;
    }
    out += `- **Pattern Template:**\n`;
    out += codeFence(expert.patternTemplate, "markdown");
    out += `\n\n`;
  }

  // Self-awareness
  if (expert.selfAwareness?.length) {
    section++;
    out += `## ${section}. Self-Awareness\n\n`;
    for (const s of expert.selfAwareness) {
      out += `- **${s.name}:** ${s.description}\n`;
    }
    out += `\n`;
  }

  // Voice
  section++;
  out += `## ${section}. Voice\n\n`;
  for (const v of expert.voice) {
    out += `${v}\n`;
  }
  if (expert.emojiException) {
    out += `\n${expert.emojiException}\n`;
  }
  out += `\n`;

  // Deliverables
  section++;
  out += `## ${section}. Deliverables\n`;
  for (let i = 0; i < expert.deliverables.length; i++) {
    out += `${i + 1}. ${expert.deliverables[i]}\n`;
  }
  out += `\n`;

  // Output Contract
  if (expert.requiredSections) {
    const { defaultSections, complexSections } = resolveRequiredSections(expert.requiredSections);
    section++;
    out += `## ${section}. Output Contract\n\n`;
    out += `### Default Structure\n\n`;
    for (const s of defaultSections) {
      out += `- ${s}\n`;
    }
    out += `\n### Complex Structure\n\n`;
    for (const s of complexSections) {
      out += `- ${s}\n`;
    }
    out += `\nUse these headings exactly as written. Do not rename, merge, or paraphrase them.\n`;
    out += `Every required heading must still appear even when context is incomplete. Use the heading to state the missing evidence, provisional assumption, or next verification step.\n`;
    out += `If context is incomplete, preserve the selected structure and explain what is missing.\n\n`;
    if (options.debug) {
      out += `Visible headings are limited to Selected Expert, Reason, Confidence, and this expert's required headings unless an allowed handoff is explicitly named.\n`;
      out += `Do not emit another expert's headings, section labels, or deliverable names while this expert is active.\n`;
      out += `Keep VERIFIED and HYPOTHESIS inline within those sections rather than as standalone headings.\n`;
    }
    out += `\n`;
  }

  // Failure Signals
  if (expert.failureSignals?.length) {
    section++;
    out += `## ${section}. Failure Signals\n\n`;
    for (const f of expert.failureSignals) {
      out += `- ${f}\n`;
    }
    out += `\n`;
  }

  // Behavioral Guardrails
  if (expert.behavioralGuardrails?.length) {
    section++;
    out += `## ${section}. Behavioral Guardrails\n\n`;
    for (const g of expert.behavioralGuardrails) {
      out += `**Failure mode:** ${g.failureMode}\n`;
      out += `**Rule:** ${g.rule}\n`;
      out += `**But:** ${g.antiOverCorrection}\n\n`;
    }
  }

  // Allowed Handoffs
  if (expert.handoffRules?.length) {
    section++;
    out += `## ${section}. Allowed Handoffs\n\n`;
    for (const h of expert.handoffRules) {
      out += `- ${h}\n`;
    }
    out += `\n`;
  }

  return out;
}
