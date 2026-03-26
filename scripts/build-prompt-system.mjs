#!/usr/bin/env node

import path from "node:path";
import {
  codeFence,
  fileHeader,
  humanizeExpertId,
  loadPromptSystemSpec,
  renderCursorFrontmatter,
  renderSkillFrontmatter,
  resolveRequiredSections,
  toHeadingList,
  writeTextFile
} from "./lib/prompt-system.mjs";

const workspaceRoot = process.cwd();
const spec = await loadPromptSystemSpec(workspaceRoot);

await writeCursorBundle();
await writeCodexBundle();

console.log(
  `Generated Cursor and Codex prompt bundles from ${path.join(
    "prompt-system",
    "philosopher-system.json"
  )}`
);

async function writeCursorBundle() {
  const rulesDir = path.join(workspaceRoot, ".cursor", "rules");

  const initPath = path.join(rulesDir, "00-init.mdc");
  const routerPath = path.join(rulesDir, "01-router.mdc");

  await writeTextFile(initPath, renderCursorInit(spec));
  await writeTextFile(routerPath, renderCursorRouter(spec));

  for (const expert of spec.experts) {
    const expertPath = path.join(rulesDir, `${expert.id}.mdc`);
    await writeTextFile(expertPath, renderCursorExpert(spec, expert));
  }
}

async function writeCodexBundle() {
  const agentsPath = path.join(workspaceRoot, "AGENTS.md");
  await writeTextFile(agentsPath, renderAgents(spec));

  for (const expert of spec.experts) {
    const skillPath = path.join(
      workspaceRoot,
      "skills",
      expert.codexSkillDir,
      "SKILL.md"
    );
    await writeTextFile(skillPath, renderSkill(spec, expert));
  }
}

function renderCursorInit(system) {
  const global = system.globalRuntime;
  return (
    fileHeader("Generated from prompt-system/philosopher-system.json") +
    renderCursorFrontmatter({
      description:
        "Global runtime for the philosopher prompt system. Always active.",
      alwaysApply: true
    }) +
    `# ${global.name}\n\n` +
    `**Version:** ${global.version}\n` +
    `**Context:** ${global.context}\n\n` +
    `## Execution Binding\n\n` +
    toHeadingList(global.executionBinding) +
    `\n\n## Routing Decision Format\n\n` +
    toHeadingList(global.routingDecisionFields) +
    `\n\n## Logging Protocol\n\n` +
    `**Principle:** ${global.logging.principle}\n\n` +
    toHeadingList(global.logging.required) +
    `\n\n` +
    codeFence(global.logging.pattern.join("\n"), "bash") +
    `\n\n**Forbidden**\n\n` +
    toHeadingList(global.logging.forbidden.map((item) => `\`${item}\``)) +
    `\n\n## Uncertainty Rules\n\n` +
    toHeadingList(global.uncertaintyRules) +
    `\n\n## Definition Of Done\n\n` +
    toHeadingList(global.definitionOfDone) +
    `\n\n## Foundational Constraints\n\n` +
    toHeadingList(global.foundationalConstraints) +
    `\n\n## Active Expert Registry\n\n` +
    toHeadingList(
      system.experts.map((expert) => `${expert.id}: ${expert.title}`)
    ) +
    `\n`
  );
}

function renderCursorRouter(system) {
  const router = system.router;
  return (
    fileHeader("Generated from prompt-system/philosopher-system.json") +
    renderCursorFrontmatter({
      description:
        "MoE router for selecting one primary philosopher expert or an explicit pipeline.",
      alwaysApply: true
    }) +
    `# ${router.name}\n\n` +
    `**Role:** ${router.role}\n\n` +
    `${router.description}\n\n` +
    `**Massive Task Override:** ${router.massiveTaskOverride}\n\n` +
    `## Router Contract\n\n` +
    toHeadingList(router.contracts) +
    `\n\n## Routing Heuristics\n\n` +
    router.routingHeuristics
      .map(
        (heuristic) =>
          `### Priority ${heuristic.priority}: ${heuristic.domain}\n\n` +
          `**Experts:** ${heuristic.experts.join(" -> ")}\n\n` +
          `**Signals:** ${heuristic.signals.join(", ")}\n`
      )
      .join("\n") +
    `\n## Disambiguation\n\n` +
    `### Route To Popper\n\n` +
    toHeadingList(router.disambiguation.routeToPopper) +
    `\n\n### Route To Quinn\n\n` +
    toHeadingList(router.disambiguation.routeToQuinn) +
    `\n\n### Route To Dennett\n\n` +
    toHeadingList(router.disambiguation.routeToDennett) +
    `\n\n## Pipeline Sequences\n\n` +
    router.pipelines
      .map(
        (pipeline) =>
          `### ${pipeline.name}\n\n` +
          toHeadingList(
            pipeline.steps.map((step, index) => `${index + 1}. ${step}`)
          ) +
          "\n"
      )
      .join("\n") +
    `\n## Response Requirement\n\n` +
    `Before solving any non-trivial request, emit a short routing block using the fields from \`00-init.mdc\`. After that, activate only the chosen expert unless a named handoff is required.\n` +
    `When multiple domains appear in one request, prefer the expert with the highest impact on correctness and foundations over the expert that is merely broader or more exploratory.\n`
  );
}

function renderCursorExpert(system, expert) {
  const { defaultSections: structure, complexSections: complexStructure } =
    resolveRequiredSections(expert.requiredSections);

  return (
    fileHeader("Generated from prompt-system/philosopher-system.json") +
    renderCursorFrontmatter({
      description: `${expert.activationDescription}. This expert is dormant unless selected by the router.`,
      alwaysApply: true
    }) +
    `# PERSONA INIT: ${expert.id}\n\n` +
    `**Role:** ${expert.title}\n` +
    `**Philosophy:** ${expert.philosophy}\n\n` +
    `${expert.summary}\n\n` +
    `## Execution Binding\n\n` +
    toHeadingList([
      "This expert is inactive unless the router selects it as the primary expert.",
      "When active, follow this expert method in order.",
      "Do not borrow another expert voice or structure unless the router names an explicit handoff.",
      "Translate philosophy into concrete actions and observable output.",
      "Use the required section headings verbatim.",
      "Do not invent replacement headings for the expert contract.",
      "If context is incomplete, explain what is missing inside the required sections rather than adding new sections."
    ]) +
    `\n\n## Voice\n\n` +
    toHeadingList(expert.voice) +
    `\n\n## Method\n\n` +
    toHeadingList(expert.methodSteps) +
    `\n\n## Output Contract\n\n` +
    `### Default Structure\n\n` +
    toHeadingList(structure) +
    `\n\n### Complex Structure\n\n` +
    toHeadingList(complexStructure) +
    `\n\n### Verbatim Heading Rule\n\n` +
    `Use these headings exactly as written when they apply. Do not rename, merge, or paraphrase them.\n` +
    `\n\nIf context is incomplete, preserve the selected structure and use the sections to explain what is missing rather than collapsing to a generic answer.\n` +
    `\n\n## Deliverables\n\n` +
    toHeadingList(expert.deliverables) +
    `\n\n## Failure Signals\n\n` +
    toHeadingList(expert.failureSignals) +
    `\n\n## Allowed Handoffs\n\n` +
    toHeadingList(expert.handoffRules) +
    `\n`
  );
}

function renderAgents(system) {
  const global = system.globalRuntime;
  return (
    fileHeader("Generated from prompt-system/philosopher-system.json") +
    `# Project Runtime\n\n` +
    `## Purpose\n\n` +
    `Turn user requests into correct, verified work while preserving the philosopher-based routing system across Codex and Cursor targets.\n\n` +
    `## Execution Protocol\n\n` +
    toHeadingList([
      "Classify the task before solving it.",
      "Select exactly one primary expert skill unless a named pipeline handoff is required.",
      "State the selection as Selected Expert, Reason, and Confidence for non-trivial tasks.",
      "Apply only that expert skill while it is active.",
      "If context is missing, keep the selected expert structure and use it to explain what evidence or inputs are missing.",
      "Use the selected expert's required section headings verbatim.",
      "When a request mixes exploration with architecture, debugging, or UX, prefer the expert with the highest impact on correctness and foundations.",
      "Verify logging rules, uncertainty labeling, and definition of done before finalizing.",
      "If multiple experts could apply, choose the one with the highest impact on correctness, not completeness."
    ]) +
    `\n\n## Routing Order\n\n` +
    toHeadingList(
      system.router.routingHeuristics.map(
        (heuristic) =>
          `${heuristic.domain} -> ${heuristic.experts
            .map((expertId) => `skills/${skillPathForExpert(system, expertId)}`)
            .join(" -> ")}`
      )
    ) +
    `\n\n## Global Rules\n\n` +
    toHeadingList(global.uncertaintyRules) +
    `\n\n` +
    toHeadingList(global.foundationalConstraints) +
    `\n\n## Logging\n\n` +
    toHeadingList(global.logging.required) +
    `\n\n` +
    codeFence(global.logging.pattern.join("\n"), "bash") +
    `\n\n## Definition Of Done\n\n` +
    toHeadingList(global.definitionOfDone) +
    `\n\n## Available Expert Skills\n\n` +
    toHeadingList(
      system.experts.map(
        (expert) =>
          `skills/${expert.codexSkillDir}: ${humanizeExpertId(expert.id)}`
      )
    ) +
    `\n`
  );
}

function renderSkill(_system, expert) {
  const {
    defaultSections: defaultStructure,
    complexSections: complexStructure
  } = resolveRequiredSections(expert.requiredSections);
  return (
    fileHeader("Generated from prompt-system/philosopher-system.json") +
    renderSkillFrontmatter({
      name: expert.id,
      description: expert.summary
    }) +
    `# ${humanizeExpertId(expert.id)}\n\n` +
    `## Goal\n\n` +
    `${expert.title}\n\n` +
    `## Philosophy\n\n` +
    `${expert.philosophy}\n\n` +
    `## Method\n\n` +
    toHeadingList(expert.methodSteps) +
    `\n\n## Output Contract\n\n` +
    `### Default Structure\n\n` +
    toHeadingList(defaultStructure) +
    `\n\n### Complex Structure\n\n` +
    toHeadingList(complexStructure) +
    `\n\n### Verbatim Heading Rule\n\n` +
    `Use these headings exactly as written when they apply. Do not rename, merge, or paraphrase them.\n` +
    `\n\nIf context is incomplete, preserve the selected structure and use the sections to explain what is missing rather than collapsing to a generic answer.\n` +
    `\n\n## Failure Signals\n\n` +
    toHeadingList(expert.failureSignals) +
    `\n\n## Allowed Handoffs\n\n` +
    toHeadingList(expert.handoffRules) +
    `\n`
  );
}

function skillPathForExpert(system, expertId) {
  return system.experts.find((expert) => expert.id === expertId)?.codexSkillDir;
}
