import { codeFence, resolveRequiredSections } from "./prompt-system.mjs";

export function renderSparseInit(system) {
  const g = system.globalRuntime;
  return (
    `# ${g.name}\n\n` +
    `**Version:** ${g.version}\n` +
    `**Context:** ${g.context}\n\n` +
    `## Execution Binding\n\n` +
    toList(g.executionBinding) +
    `\n\n## Routing Decision Format\n\n` +
    toList(g.routingDecisionFields) +
    `\n\n## Logging Protocol\n\n` +
    `**Principle:** ${g.logging.principle}\n\n` +
    toList(g.logging.required) +
    `\n\n` +
    codeFence(g.logging.pattern.join("\n"), "bash") +
    `\n\n**Forbidden**\n\n` +
    toList(g.logging.forbidden.map((item) => `\`${item}\``)) +
    `\n\n## Uncertainty Rules\n\n` +
    toList(g.uncertaintyRules) +
    `\n\n## Definition Of Done\n\n` +
    toList(g.definitionOfDone) +
    `\n\n## Foundational Constraints\n\n` +
    toList(g.foundationalConstraints) +
    `\n\n## Active Expert Registry\n\n` +
    toList(system.experts.map((e) => `${e.id}: ${e.title}`)) +
    `\n`
  );
}

export function renderSparseRouter(system) {
  const r = system.router;
  return (
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
    `### Route To Popper\n\n` +
    toList(r.disambiguation.routeToPopper) +
    `\n\n### Route To Quinn\n\n` +
    toList(r.disambiguation.routeToQuinn) +
    `\n\n### Route To Dennett\n\n` +
    toList(r.disambiguation.routeToDennett) +
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
      .join("\n") +
    `\n## Response Requirement\n\n` +
    "Before solving any non-trivial request, emit a short routing block using the fields from `00-init.mdc`. After that, activate only the chosen expert unless a named handoff is required.\n" +
    "When multiple domains appear in one request, prefer the expert with the highest impact on correctness and foundations over the expert that is merely broader or more exploratory.\n" +
    "If the user asks whether something should be built and only secondarily mentions UX or friendliness, route to architecture before ideation.\n" +
    "If the user explicitly asks for multiple options, drafts, or redesign alternatives, keep ideation primary unless the prompt also requests concrete architecture artifacts such as schemas, trust boundaries, or contracts.\n"
  );
}

export function renderSparseExpert(system, expert) {
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
      "Do not borrow another expert voice or structure unless the router names an explicit handoff.",
      "Translate philosophy into concrete actions and observable output.",
      "Use the required section headings verbatim.",
      "Do not invent replacement headings for the expert contract.",
      "If context is incomplete, explain what is missing inside the required sections rather than adding new sections."
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
    "Use these headings exactly as written when they apply. Do not rename, merge, or paraphrase them.\n" +
    "\n\nIf context is incomplete, preserve the selected structure and use the sections to explain what is missing rather than collapsing to a generic answer.\n" +
    `\n\n## Deliverables\n\n` +
    toList(expert.deliverables) +
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
