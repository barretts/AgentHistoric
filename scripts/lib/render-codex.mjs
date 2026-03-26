import {
  codeFence,
  fileHeader,
  humanizeExpertId,
  renderSkillFrontmatter,
  resolveRequiredSections
} from "./prompt-system.mjs";

export function renderAgents(system, options = {}) {
  const g = system.globalRuntime;
  return (
    fileHeader("Generated from prompt-system/") +
    `# Project Runtime\n\n` +
    `## Purpose\n\n` +
    `Turn user requests into correct, verified work using the Agent Historic attested-persona routing system across all supported targets.\n\n` +
    `## Execution Protocol\n\n` +
    toList([
      "Classify the task before solving it.",
      "Select exactly one primary expert skill unless a named pipeline handoff is required.",
      ...(options.debug
        ? [
            "State the selection as Selected Expert, Reason, and Confidence for non-trivial tasks, and include those labels in the visible user-facing response."
          ]
        : []),
      "Apply only that expert skill while it is active.",
      "If context is missing, keep the selected expert structure and use it to explain what evidence or inputs are missing.",
      "Use the selected expert's required section headings verbatim.",
      ...(options.debug
        ? [
            "After the routing preamble, use only the active expert's required headings unless an explicit allowed handoff is named.",
            "Do not emit headings, section labels, or deliverable names from another expert while a different expert is active.",
            "Keep VERIFIED and HYPOTHESIS inline inside the selected sections, never as standalone headings."
          ]
        : []),
      "When a request mixes exploration with architecture, debugging, or UX, prefer the expert with the highest impact on correctness and foundations.",
      "If the user asks whether something should be built and only secondarily mentions UX or friendliness, prefer architecture before ideation.",
      "If the user explicitly asks for multiple options, drafts, or redesign alternatives, keep ideation primary unless the prompt also requests concrete architecture artifacts such as schemas, trust boundaries, or contracts.",
      "Verify logging rules, uncertainty labeling, and definition of done before finalizing.",
      "If multiple experts could apply, choose the one with the highest impact on correctness, not completeness."
    ]) +
    `\n\n## Routing Order\n\n` +
    toList(
      system.router.routingHeuristics.map(
        (h) =>
          `${h.domain} -> ${h.experts
            .map((id) => `dot-codex/skills/${skillPathForExpert(system, id)}`)
            .join(" -> ")}`
      )
    ) +
    `\n\n## Global Rules\n\n` +
    toList(g.uncertaintyRules) +
    `\n\n` +
    toList(g.foundationalConstraints) +
    `\n\n## Logging\n\n` +
    toList(g.logging.required) +
    `\n\n` +
    codeFence(g.logging.pattern.join("\n"), "bash") +
    `\n\n## Definition Of Done\n\n` +
    toList(g.definitionOfDone) +
    `\n\n## Available Expert Skills\n\n` +
    toList(
      system.experts.map(
        (e) => `dot-codex/skills/${e.codexSkillDir}: ${humanizeExpertId(e.id)}`
      )
    ) +
    `\n`
  );
}

export function renderSkill(_system, expert, options = {}) {
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
    (expert.corePhilosophy?.length
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
    `\n\n## Failure Signals\n\n` +
    toList(expert.failureSignals) +
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
