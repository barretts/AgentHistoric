import path from "node:path";
import {
  fileHeader,
  renderCursorFrontmatter,
  renderMdFrontmatter
} from "./prompt-system.mjs";
import { renderRichInit, renderRichRouter, renderRichExpert } from "./render-rich.mjs";

import { renderAgents, renderSkill } from "./render-codex.mjs";

const HEADER = fileHeader("Generated from prompt-system/");

/**
 * Renderer Protocol
 *
 * Every render target must produce artifacts that satisfy these semantic invariants
 * (enforced by cross-target equivalence tests in prompt-smoke.test.mjs):
 *
 * INIT artifact:
 * - References every expert ID from system.experts
 * - Contains Constraint Hierarchy, Logging, Definition of Done, Foundational Constraints
 * - Contains Execution Binding (production or debug variant)
 * - Contains Voice Calibration section
 * - Contains Modifiers section (when modifiers exist)
 * - Contains Swarm Registry / expert listing
 *
 * ROUTER artifact:
 * - Contains every routing domain from router.routingHeuristics
 * - Contains every contract rule from router.contracts
 * - Contains Routing Anti-Patterns (negative examples)
 * - Contains Two-Pass Routing Refinement
 * - Contains Pipeline Sequences
 * - Contains Modifier Activation
 *
 * EXPERT artifact (one per expert):
 * - Contains all required sections from expert.requiredSections (default + complex)
 * - Contains Method, Voice, Deliverables, Output Contract, Failure Signals
 * - Contains Behavioral Guardrails (at least one triple)
 * - Contains Allowed Handoffs
 *
 * Frontmatter is target-specific and NOT part of the semantic protocol.
 */

// ── Variable Substitution ───────────────────────────────────────────

/**
 * Apply variable substitution to artifact content.
 * Replaces {{VAR_NAME}} patterns with resolved values.
 * In strict mode, throws on unresolved variables.
 */
export function applyVariableSubstitution(content, system, options = {}) {
  if (!options.vsEnabled) return content;

  const variables = buildVariableMap(system);
  const varPattern = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
  let match;
  let result = content;
  const unresolved = [];

  while ((match = varPattern.exec(content)) !== null) {
    const varName = match[1];
    if (variables[varName] !== undefined) {
      result = result.split(match[0]).join(variables[varName]);
    } else {
      unresolved.push(varName);
    }
  }

  if (unresolved.length > 0) {
    if (options.vsStrict) {
      throw new Error(`Unresolved VS variables: ${unresolved.join(", ")}`);
    }
    // Non-strict: leave variables in place, warn
    console.warn(`[VS] Unresolved variables (non-strict): ${unresolved.join(", ")}`);
  }

  return result;
}

/**
 * Build variable map from system spec.
 * Combines defaults with project overrides if present.
 */
function buildVariableMap(system) {
  const vars = {};

  // EXPERT_ROSTER: full Swarm Registry markdown with summaries
  if (system.experts) {
    vars.EXPERT_ROSTER = "## 7. Swarm Registry\n" +
      system.experts.map(e => `* **${e.id}:** ${e.summary}`).join("\n") +
      "\n";
  }

  // EXPERT_ID_ALLOWLIST: comma-separated for echo-friendly display
  if (system.experts) {
    vars.EXPERT_ID_ALLOWLIST = system.experts.map(e => e.id).join(", ");
  }

  // CONSTRAINT_HIERARCHY_LAYERS: readable layer summary
  if (system.constraintHierarchy?.layers) {
    vars.CONSTRAINT_HIERARCHY_LAYERS = system.constraintHierarchy.layers
      .map(l => `${l.name} (${l.source}): ${l.scope}`)
      .join(". ");
  }

  // VERIFICATION_WORKFLOW_STEPS: standard workflow
  vars.VERIFICATION_WORKFLOW_STEPS = "1. build:prompts 2. test:unit 3. test:regressions:smoke";

  return vars;
}

// ── Public Entry Point ──────────────────────────────────────────────

export function generateArtifacts(system, options = {}) {
  const artifacts = new Map();

  // Rich + md frontmatter → compiled/claude/rules/
  addSet(artifacts, system, path.join("compiled", "claude", "rules"), ".md", mdFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Rich + windsurf frontmatter → compiled/windsurf/rules/
  addSet(artifacts, system, path.join("compiled", "windsurf", "rules"), ".md", windsurfFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Rich + cursor frontmatter → compiled/cursor/rules/
  addSet(artifacts, system, path.join("compiled", "cursor", "rules"), ".mdc", cursorFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Codex (own format)
  artifacts.set(path.join("compiled", "codex", "AGENTS.md"), renderAgents(system, options));
  for (const expert of system.experts) {
    artifacts.set(
      path.join("compiled", "codex", "skills", expert.codexSkillDir, "SKILL.md"),
      renderSkill(system, expert, options)
    );
  }

  // Rich + md frontmatter → compiled/crush/rules/
  addSet(artifacts, system, path.join("compiled", "crush", "rules"), ".md", crushFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Rich + HTML comment marker (no YAML frontmatter) → compiled/gemini/rules/
  addSet(artifacts, system, path.join("compiled", "gemini", "rules"), ".md", geminiFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  return artifacts;
}

// ── Set Generator ───────────────────────────────────────────────────

function addSet(artifacts, system, dir, ext, fmFn, initFn, routerFn, expertFn, options = {}) {
  artifacts.set(
    path.join(dir, `00-init${ext}`),
    HEADER + fmFn("init", system) + initFn(system, options)
  );
  artifacts.set(
    path.join(dir, `01-router${ext}`),
    HEADER + fmFn("router", system) + routerFn(system, options)
  );
  for (const expert of system.experts) {
    artifacts.set(
      path.join(dir, `${expert.id}${ext}`),
      HEADER + fmFn("expert", system, expert) + expertFn(system, expert, options)
    );
  }
}

// ── Frontmatter Factories ───────────────────────────────────────────

function mdFm(kind, _system, expert) {
  if (kind === "init") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "Global OS for the MoE Swarm Architecture. Loaded into every agent context. Defines universal mandates that supersede individual expert personas."
    });
  }
  if (kind === "router") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "MoE Orchestrator / Router. Front-line triage agent. Analyzes intent and routes to the correct pipeline or expert. Use when the task type is ambiguous or spans multiple concerns."
    });
  }
  return renderMdFrontmatter({
    trigger: expert.trigger,
    description: expert.activationDescription
  });
}

function windsurfFm(kind, _system, expert) {
  if (kind === "init") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "Global OS for the MoE Swarm Architecture. Loaded into every agent context. Defines universal mandates that supersede individual expert personas."
    });
  }
  if (kind === "router") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "MoE Orchestrator / Router. Front-line triage agent. Analyzes intent and routes to the correct pipeline or expert. Use when the task type is ambiguous or spans multiple concerns."
    });
  }
  return renderMdFrontmatter({
    trigger: "model_decision",
    description: expert.activationDescription
  });
}

function crushFm(kind, _system, expert) {
  if (kind === "init") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "Global OS for the MoE Swarm Architecture. Loaded into every agent context. Defines universal mandates that supersede individual expert personas."
    });
  }
  if (kind === "router") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "MoE Orchestrator / Router. Front-line triage agent. Analyzes intent and routes to the correct pipeline or expert. Use when the task type is ambiguous or spans multiple concerns."
    });
  }
  return renderMdFrontmatter({
    trigger: "model_decision",
    description: expert.activationDescription
  });
}

function geminiFm(_kind, _system, _expert) {
  return "<!-- managed_by: agent-historic -->\n";
}

function cursorFm(kind, _system, expert) {
  if (kind === "init") {
    return renderCursorFrontmatter({
      description: "Global runtime for the Agent Historic persona system. Always active.",
      alwaysApply: true
    });
  }
  if (kind === "router") {
    return renderCursorFrontmatter({
      description: "MoE router for selecting one primary attested persona or an explicit pipeline.",
      alwaysApply: true
    });
  }
  return renderCursorFrontmatter({
    description: `${expert.activationDescription}. This expert is dormant unless selected by the router.`,
    alwaysApply: false
  });
}
