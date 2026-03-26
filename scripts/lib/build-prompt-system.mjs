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

const STARTUP_BODY =
  `If you are a GPT-family model, use the gpt/ subfolder for all rules.\n` +
  `If you prefer sparse, structured rules, use the gpt/ subfolder.\n` +
  `All other models (Claude, etc.) should use the rich/ subfolder.\n`;

// ── Public Entry Point ──────────────────────────────────────────────

export function generateArtifacts(system) {
  const artifacts = new Map();

  // Rich + md frontmatter → .claude/rules/ (no startup needed, Claude auto-loads)
  addSet(artifacts, system, path.join(".claude", "rules"), ".md", mdFm, renderRichInit, renderRichRouter, renderRichExpert);

  // Rich + md frontmatter → .windsurf/rules/rich/
  addSet(artifacts, system, path.join(".windsurf", "rules", "rich"), ".md", mdFm, renderRichInit, renderRichRouter, renderRichExpert);

  // Rich + cursor frontmatter → .cursor/rules/rich/
  addSet(artifacts, system, path.join(".cursor", "rules", "rich"), ".mdc", cursorFm, renderRichInit, renderRichRouter, renderRichExpert);

  // Startup loader → .cursor/rules/ and .windsurf/rules/
  artifacts.set(
    path.join(".cursor", "rules", "00-startup.mdc"),
    HEADER + cursorFm("startup", system) + STARTUP_BODY
  );
  artifacts.set(
    path.join(".windsurf", "rules", "00-startup.md"),
    HEADER + mdFm("startup", system) + STARTUP_BODY
  );

  // Sparse + cursor frontmatter → .cursor/rules/gpt/
  addSet(artifacts, system, path.join(".cursor", "rules", "gpt"), ".mdc", cursorFm, renderSparseInit, renderSparseRouter, renderSparseExpert);

  // Sparse + md frontmatter → .windsurf/rules/gpt/
  addSet(artifacts, system, path.join(".windsurf", "rules", "gpt"), ".md", mdFm, renderSparseInit, renderSparseRouter, renderSparseExpert);

  // Codex (own format, sparse)
  artifacts.set(path.join(".codex", "AGENTS.md"), renderAgents(system));
  for (const expert of system.experts) {
    artifacts.set(
      path.join(".codex", "skills", expert.codexSkillDir, "SKILL.md"),
      renderSkill(system, expert)
    );
  }

  return artifacts;
}

// ── Set Generator ───────────────────────────────────────────────────

function addSet(artifacts, system, dir, ext, fmFn, initFn, routerFn, expertFn) {
  artifacts.set(
    path.join(dir, `00-init${ext}`),
    HEADER + fmFn("init", system) + initFn(system)
  );
  artifacts.set(
    path.join(dir, `01-router${ext}`),
    HEADER + fmFn("router", system) + routerFn(system)
  );
  for (const expert of system.experts) {
    artifacts.set(
      path.join(dir, `${expert.id}${ext}`),
      HEADER + fmFn("expert", system, expert) + expertFn(system, expert)
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

function cursorFm(kind, _system, expert) {
  if (kind === "startup") {
    return renderCursorFrontmatter({
      description: "Model routing: directs GPT-family models to the gpt/ subfolder. Always active.",
      alwaysApply: true
    });
  }
  if (kind === "init") {
    return renderCursorFrontmatter({
      description: "Global runtime for the philosopher prompt system. Always active.",
      alwaysApply: true
    });
  }
  if (kind === "router") {
    return renderCursorFrontmatter({
      description: "MoE router for selecting one primary philosopher expert or an explicit pipeline.",
      alwaysApply: true
    });
  }
  return renderCursorFrontmatter({
    description: `${expert.activationDescription}. This expert is dormant unless selected by the router.`,
    alwaysApply: true
  });
}
