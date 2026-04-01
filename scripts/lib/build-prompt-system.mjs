import path from "node:path";
import {
  fileHeader,
  renderCursorFrontmatter,
  renderMdFrontmatter
} from "./prompt-system.mjs";
import { renderRichInit, renderRichRouter, renderRichExpert } from "./render-rich.mjs";
import { renderSparseInit, renderSparseRouter, renderSparseExpert } from "./render-sparse.mjs";
import { renderAgents, renderSkill } from "./render-codex.mjs";

const HEADER = fileHeader("Generated from prompt-system/");

// ── Public Entry Point ──────────────────────────────────────────────

export function generateArtifacts(system, options = {}) {
  const artifacts = new Map();

  // Rich + md frontmatter → compiled/claude/rules/
  addSet(artifacts, system, path.join("compiled", "claude", "rules"), ".md", mdFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Rich + windsurf frontmatter → compiled/windsurf/rules/
  addSet(artifacts, system, path.join("compiled", "windsurf", "rules"), ".md", windsurfFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Rich + cursor frontmatter → compiled/cursor/rules/
  addSet(artifacts, system, path.join("compiled", "cursor", "rules"), ".mdc", cursorFm, renderRichInit, renderRichRouter, renderRichExpert, options);

  // Sparse + cursor frontmatter → compiled/cursor/rules/gpt/
  addSet(artifacts, system, path.join("compiled", "cursor", "rules", "gpt"), ".mdc", cursorFm, renderSparseInit, renderSparseRouter, renderSparseExpert, options);

  // Sparse + windsurf frontmatter → compiled/windsurf/rules/gpt/
  addSet(artifacts, system, path.join("compiled", "windsurf", "rules", "gpt"), ".md", windsurfFm, renderSparseInit, renderSparseRouter, renderSparseExpert, options);

  // Codex (own format, sparse)
  artifacts.set(path.join("compiled", "codex", "AGENTS.md"), renderAgents(system, options));
  for (const expert of system.experts) {
    artifacts.set(
      path.join("compiled", "codex", "skills", expert.codexSkillDir, "SKILL.md"),
      renderSkill(system, expert, options)
    );
  }

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
  if (kind === "startup") {
    return renderMdFrontmatter({
      trigger: "always",
      description: "Model routing: directs GPT-family models to the gpt/ subfolder."
    });
  }
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
