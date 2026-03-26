import { codeFence, humanizeExpertId } from "./prompt-system.mjs";

export function renderRichInit(system) {
  const g = system.globalRuntime;
  const reasons = {
    "your_test_command | grep": "destroys context",
    "pytest | tail": "hides early failures",
    "cargo test 2>&1 | head": "truncates stack traces"
  };

  let out = "";
  out += `> **Model adaptation:** If you are a GPT-family model, focus on: numbered method steps,\n`;
  out += `> execution bindings, required section headings, and output contracts. Treat philosophical\n`;
  out += `> descriptions as behavioral context, not identity instructions.\n\n`;
  out += `# ${g.name}\n\n`;
  out += `**Version:** ${g.version} (Philosophical Engineering Edition)\n`;
  out += `**Context:** ${g.context}\n\n`;

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
  out += `* **Encoding:** ${g.encodingRules.join(" ")}\n\n`;

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

export function renderRichRouter(system) {
  const r = system.router;

  let out = "";
  out += `# ${r.name}\n\n`;
  out += `**Role:** Front-line Triage and Pipeline Controller\n\n`;
  out += `${r.personaIntro}\n\n`;
  out += `**CRITICAL OVERRIDE:** If the user asks to perform a massive, repetitive task across multiple files ("verify all components," "update all imports," "check all stories"), do NOT route this as a manual task. Route to the \`automation_generation\` sequence to build a tool or script to delegate the work systematically.\n\n`;

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
  out += `**Route TO Popper** (active failure investigation):\n`;
  out += r.disambiguation.routeToPopper.map((s) => `- "${s}"`).join("\n");
  out += `\n\n**Route to Quinn instead** (guidance, not debugging):\n`;
  out += r.disambiguation.routeToQuinn.map((s) => `- "${s}"`).join("\n");
  out += `\n\n**Route to Dennett instead** (ideation, not debugging):\n`;
  out += r.disambiguation.routeToDennett.map((s) => `- "${s}"`).join("\n");

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

  return out;
}

export function renderRichExpert(system, expert) {
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
  if (expert.id === "expert-architect-descartes") {
    out += `When given a feature request, a visionary draft, or a system design task:\n\n`;
  } else if (expert.id === "expert-qa-popper") {
    // No intro text needed
  } else if (expert.id === "expert-ux-rogers") {
    out += `Evaluate all drafts and implementations for:\n\n`;
  } else if (expert.id === "expert-manager-blackmore") {
    out += `When a bug is fixed, a feature is completed, or an automation is created:\n\n`;
  } else if (expert.id === "expert-visionary-dennett") {
    out += `When asked to brainstorm, explore, or solve an ambiguous problem:\n\n`;
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

  return out;
}
