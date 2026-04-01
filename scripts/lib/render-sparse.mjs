import { codeFence, resolveRequiredSections, VOICE_CALIBRATION, SCAFFOLDED_VOICE } from "./prompt-system.mjs";

export function renderSparseInit(system, options = {}) {
  const g = system.globalRuntime;
  const abl = options.ablation;
  const executionBinding = options.debug
    ? g.executionBinding
    : g.executionBinding.filter((item) => !item.includes("Selected Expert"));
  let out =
    `# ${g.name}\n\n` +
    `**Version:** ${g.version}\n` +
    `**Context:** ${g.context}\n\n` +
    (system.constraintHierarchy
      ? `## Constraint Hierarchy\n\n` +
        `${system.constraintHierarchy.description}\n\n` +
        `**Invariant:** ${system.constraintHierarchy.invariant}\n\n`
      : "");

  if (abl !== "voice-calibration") {
    out +=
      `## ${options.scaffolded ? "Scaffolded Voice" : "Voice Calibration"}\n\n` +
      toList(options.scaffolded ? SCAFFOLDED_VOICE : VOICE_CALIBRATION) +
      `\n\n`;
  }

  out += `## Execution Binding\n\n` + toList(executionBinding);

  if (options.debug) {
    out +=
      `\n\n## Routing Decision Format\n\n` +
      toList(g.routingDecisionFields);
  }
  if (options.debug) {
    out +=
      `\n\n## Heading Purity\n\n` +
      toList([
        "After the routing preamble, prefer the active expert's required headings as the main visible structure.",
        "Avoid switching into another expert's named sections, labels, or deliverable framing unless an explicit allowed handoff is named.",
        "Keep VERIFIED and HYPOTHESIS inline inside the selected sections when possible, instead of promoting them to standalone headings."
      ]);
  }

  if (abl !== "logging-protocol") {
    out +=
      `\n\n## Logging Protocol\n\n` +
      `**Principle:** ${g.logging.principle}\n\n` +
      toList(g.logging.required) +
      `\n\n` +
      codeFence(g.logging.pattern.join("\n"), "bash") +
      `\n\n**Forbidden**\n\n` +
      toList(g.logging.forbidden.map((item) => `\`${item}\``));
  }

  if (abl !== "uncertainty-rules") {
    out +=
      `\n\n## Uncertainty Rules\n\n` +
      toList(g.uncertaintyRules);
  }

  out +=
    `\n\n## Definition Of Done\n\n` +
    toList(g.definitionOfDone);

  if (abl !== "foundational-constraints") {
    out +=
      `\n\n## Foundational Constraints\n\n` +
      toList(g.foundationalConstraints);
  }

  out +=
    `\n\n## Active Expert Registry\n\n` +
    toList(system.experts.map((e) => `${e.id}: ${e.title}`)) +
    `\n`;
  return out;
}

export function renderSparseRouter(system, options = {}) {
  const r = system.router;
  let out =
    `# ${r.name}\n\n` +
    `**Role:** ${r.role}\n\n` +
    `${r.description}\n\n` +
    `**Massive Task Override:** ${r.massiveTaskOverride}\n\n` +
    `## Router Contract\n\n` +
    toList(r.contracts) +
    `\n\n## Routing Heuristics\n\n` +
    r.routingHeuristics
      .map(
        (h) =>
          `### Priority ${h.priority}: ${h.domain}\n\n` +
          `**Experts:** ${h.experts.join(" -> ")}\n\n` +
          `**Signals:** ${h.signals.join(", ")}\n`
      )
      .join("\n") +
    `\n## Disambiguation\n\n` +
    Object.entries(r.disambiguation)
      .map(
        ([key, examples]) =>
          `### ${disambiguationHeading(key)}\n\n` + toList(examples)
      )
      .join("\n\n") +
    `\n\n## Pipeline Sequences\n\n` +
    r.pipelines
      .map(
        (pipeline) =>
          `### ${pipeline.name}\n\n` +
          toList(
            pipeline.steps.map(
              (step, i) => `${i + 1}. ${step.expert}`
            )
          ) +
          "\n"
      )
      .join("\n");
  if (options.debug) {
    out +=
      `\n## Response Requirement\n\n` +
      "Before solving any request, emit a routing block with exactly these fields: `Selected Subfolder`, `Selected Expert`, `Reason`, and `Confidence (0-1)`.\n" +
      "Do not continue until that routing block is complete.\n" +
      "After routing, activate only the chosen expert unless a named handoff is required.\n" +
      "If confidence is below 0.65, ask one clarifying question instead of proceeding.\n" +
      "In the visible user-facing response, explicitly include `Selected Expert`, `Reason`, and `Confidence` before the expert-specific sections whenever the task is non-trivial.\n" +
      "After that preamble, keep the response centered on the active expert's required headings. Avoid borrowing headings, labels, or deliverable names from other experts unless the router names an explicit handoff.\n" +
      "Keep VERIFIED and HYPOTHESIS inside the body text of the selected sections when possible; avoid promoting them to headings or pseudo-headings.\n";
  }
  out +=
    "When multiple domains appear in one request, prefer the expert with the highest impact on correctness and foundations over the expert that is merely broader or more exploratory.\n" +
    "If the user asks whether something should be built and only secondarily mentions UX or friendliness, route to architecture before ideation.\n" +
    "If the user explicitly asks for multiple options, drafts, or redesign alternatives, keep ideation primary unless the prompt also requests concrete architecture artifacts such as schemas, trust boundaries, or contracts.\n";
  return out;
}

export function renderSparseExpert(system, expert, options = {}) {
  const abl = options.ablation;
  const { defaultSections: structure, complexSections: complexStructure } =
    resolveRequiredSections(expert.requiredSections);

  return (
    `# PERSONA INIT: ${expert.id}\n\n` +
    `**Role:** ${expert.title}\n` +
    `**Philosophy:** ${expert.philosophy}\n\n` +
    `${expert.summary}\n\n` +
    `## Execution Binding\n\n` +
    toList([
      "This expert is inactive unless the router selects it as the primary expert.",
      "When active, follow this expert method in order.",
      "Do not slip into another expert's voice or structure unless the router names an explicit handoff.",
      "Translate philosophy into concrete actions and observable output.",
      ...(options.debug
        ? [
            "For non-trivial tasks, begin the visible response with `Selected Expert`, `Reason`, and `Confidence` before the expert-specific sections.",
            "Keep visible headings anchored to `Selected Expert`, `Reason`, `Confidence`, and this expert's required headings unless an explicit allowed handoff is named."
          ]
        : []),
      "Use the required section headings as the default visible structure.",
      "Avoid introducing another expert's headings, section labels, or deliverable names while this expert is active.",
      "Do not invent replacement headings that change the contract's intent.",
      "Keep VERIFIED and HYPOTHESIS inline within those sections where practical rather than as standalone headings.",
      "If context is incomplete, explain what is missing inside the required sections rather than spawning extra sections."
    ]) +
    `\n\n## Voice\n\n` +
    toList(expert.voice) +
    `\n\n## Method\n\n` +
    toList(expert.methodSteps) +
    `\n\n## Output Contract\n\n` +
    `### Default Structure\n\n` +
    toList(structure) +
    `\n\n### Complex Structure\n\n` +
    toList(complexStructure) +
    `\n\n### Verbatim Heading Rule\n\n` +
    "Use these headings as the canonical structure when they apply. Keep the section intent intact even if the wording inside each section is conversational and adaptive.\n" +
    (options.debug
      ? "\nVisible headings are limited to Selected Expert, Reason, Confidence, and this expert's required headings unless an explicit allowed handoff is named.\n"
      : "") +
    "\n\nIf context is incomplete, preserve the selected structure and use the sections to explain what is missing rather than collapsing to a generic answer.\n" +
    `\n\n## Deliverables\n\n` +
    toList(expert.deliverables) +
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

function disambiguationHeading(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}
