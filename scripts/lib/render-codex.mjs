import {
  codeFence,
  fileHeader,
  humanizeExpertId,
  renderSkillFrontmatter,
  resolveRequiredSections,
  VOICE_CALIBRATION,
  SCAFFOLDED_VOICE
} from "./prompt-system.mjs";

export function renderAgents(system, options = {}) {
  const g = system.globalRuntime;
  const r = system.router;
  const abl = options.ablation;
  return (
    fileHeader("Generated from prompt-system/") +
    `---\nmanaged_by: agent-historic\n---\n` +
    `# Project Runtime\n\n` +
    `## Purpose\n\n` +
    `Turn user requests into correct, verified work using the Agent Historic attested-persona routing system across all supported targets.\n\n` +
    (system.constraintHierarchy
      ? `## Constraint Hierarchy\n\n` +
        `${system.constraintHierarchy.description}\n\n` +
        system.constraintHierarchy.layers
          .map((l) => `- **${l.name}** (${l.source}): ${l.scope}.`)
          .join("\n") +
        `\n\n**Invariant:** ${system.constraintHierarchy.invariant}\n\n`
      : "") +
    `## Execution Protocol\n\n` +
    toList(g.executionBinding) +
    `\n\n## Router Contract\n\n` +
    toList(r.contracts) +
    `\n\n## Routing Preference\n\n` +
    toList([
      "When a request mixes exploration with architecture, debugging, or UX, prefer the expert with the highest impact on correctness and foundations.",
      "If the user asks whether something should be built and only secondarily mentions UX or friendliness, prefer architecture before ideation.",
      "If the user explicitly asks for multiple options, drafts, or redesign alternatives, keep ideation primary unless the prompt also requests concrete architecture artifacts such as schemas, trust boundaries, or contracts."
    ]) +
    (abl !== "voice-calibration"
      ? `\n\n## ${options.scaffolded ? "Scaffolded Voice" : "Voice Calibration"}\n\n` +
        toList(options.scaffolded ? SCAFFOLDED_VOICE : VOICE_CALIBRATION)
      : "") +
    `\n\n## Routing Order\n\n` +
    toList(
      system.router.routingHeuristics.map(
        (h) =>
          `${h.domain} -> ${h.experts
            .map((id) => `.codex/skills/${skillPathForExpert(system, id)}`)
            .join(" -> ")}`
      )
    ) +
    `\n\n## Global Rules\n\n` +
    (abl !== "uncertainty-rules" ? toList(g.uncertaintyRules) + `\n\n` : "") +
    (abl !== "foundational-constraints" ? toList(g.foundationalConstraints) : "") +
    (abl !== "logging-protocol"
      ? `\n\n## Logging\n\n` +
        toList(g.logging.required) +
        `\n\n` +
        codeFence(g.logging.pattern.join("\n"), "bash")
      : "") +
    `\n\n## Definition Of Done\n\n` +
    toList(g.definitionOfDone) +
    `\n\n## Available Expert Skills\n\n` +
    toList(
      system.experts.map(
        (e) => `.codex/skills/${e.codexSkillDir}: ${humanizeExpertId(e.id)}`
      )
    ) +
    `\n`
  );
}

export function renderSkill(_system, expert, options = {}) {
  const abl = options.ablation;
  const {
    defaultSections: defaultStructure,
    complexSections: complexStructure
  } = resolveRequiredSections(expert.requiredSections);
  const singleSectionAnswer =
    defaultStructure.length === 1 && defaultStructure[0] === "Answer";
  return (
    fileHeader("Generated from prompt-system/") +
    renderSkillFrontmatter({
      name: expert.id,
      description: expert.summary
    }) +
    `# ${humanizeExpertId(expert.id)}\n\n` +
    `## Goal\n\n` +
    `${expert.title}\n\n` +
    `${expert.personaIntro}\n\n` +
    `## Philosophy\n\n` +
    `${expert.philosophy}\n\n` +
    (expert.corePhilosophy?.length && abl !== "expert-philosophy"
      ? expert.corePhilosophy
          .map((p) => `- **${p.name}:** ${p.description}`)
          .join("\n") + "\n\n"
      : "") +
    `## Voice\n\n` +
    toList(expert.voice) +
    `\n\n## Method\n\n` +
    toList(expert.methodSteps) +
    (options.debug
      ? `\n\n## Response Preamble\n\n` +
        toList([
          "For non-trivial tasks, begin the visible response with Selected Expert, Reason, and Confidence.",
          "Then continue with the expert-specific required sections in order.",
          "Do not omit the selected expert declaration when the task requires structured output.",
          "Visible headings are limited to Selected Expert, Reason, Confidence, and this expert's required headings unless an explicit allowed handoff is named.",
          "Do not emit another expert's headings, section labels, or deliverable names while this expert is active.",
          "Keep VERIFIED and HYPOTHESIS inline within those sections rather than as standalone headings.",
          ...(singleSectionAnswer
            ? [
                "When the required structure is only Answer, keep assumptions, edge cases, risks, and verification guidance inside the Answer body as plain prose or bullets, not labeled subheadings such as Assumptions, Edge Cases, Risk, or Verification."
              ]
            : [])
        ])
      : "") +
    `\n\n## Output Contract\n\n` +
    `### Default Structure\n\n` +
    toList(defaultStructure) +
    `\n\n### Complex Structure\n\n` +
    toList(complexStructure) +
    `\n\n### Verbatim Heading Rule\n\n` +
    "Use these headings exactly as written when they apply. Do not rename, merge, or paraphrase them.\n" +
    (options.debug
      ? "Visible headings are limited to Selected Expert, Reason, Confidence, and this expert's required headings unless an explicit allowed handoff is named.\n" +
        "Do not emit another expert's headings, section labels, or deliverable names while this expert is active.\n" +
        "Keep VERIFIED and HYPOTHESIS inline within those sections rather than as standalone headings.\n"
      : "") +
    (singleSectionAnswer
      ? "When the only required section is Answer, do not create internal labeled mini-sections such as Assumptions, Edge Cases, Risk, or Verification inside that Answer block. Keep that material inline as sentences or bullets.\n"
      : "") +
    "\n\nIf context is incomplete, preserve the selected structure and use the sections to explain what is missing rather than collapsing to a generic answer.\n" +
    (abl !== "failure-signals"
      ? `\n\n## Failure Signals\n\n` + toList(expert.failureSignals)
      : "") +
    (expert.behavioralGuardrails?.length && abl !== "behavioral-guardrails"
      ? `\n\n## Behavioral Guardrails\n\n` +
        expert.behavioralGuardrails
          .map(
            (g) =>
              `- **Failure mode:** ${g.failureMode}\n  **Rule:** ${g.rule}\n  **But:** ${g.antiOverCorrection}`
          )
          .join("\n\n") +
        "\n"
      : "") +
    `\n\n## Allowed Handoffs\n\n` +
    toList(expert.handoffRules) +
    `\n`
  );
}

function toList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function skillPathForExpert(system, expertId) {
  return system.experts.find((e) => e.id === expertId)?.codexSkillDir || expertId;
}
