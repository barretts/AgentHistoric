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
  `You MUST choose exactly one subfolder before any reasoning: gpt/ or rich/.\n` +
  `Routing rules (in order):\n` +
  `1) If model family is GPT, select gpt/.\n` +
  `2) Else if user requests sparse or structured behavior, select gpt/.\n` +
  `3) Else select rich/.\n` +
  `After selecting a subfolder, you MUST immediately load 00-init and 01-router from that same subfolder.\n` +
  `You MUST NOT load any expert file before loading both files above.\n` +
  `You MUST NOT mix gpt/ and rich/ in one request unless the user explicitly overrides.\n` +
  `If subfolder cannot be determined, STOP and ask exactly one clarifying question.\n`;

// ── Public Entry Point ──────────────────────────────────────────────

export function generateArtifacts(system) {
  const artifacts = new Map();

  // Rich + md frontmatter → dot-claude/rules/ (no startup needed, Claude auto-loads)
  addSet(artifacts, system, path.join("dot-claude", "rules"), ".md", mdFm, renderRichInit, renderRichRouter, renderRichExpert);

  // Rich + windsurf frontmatter → dot-windsurf/rules/rich/
  addSet(artifacts, system, path.join("dot-windsurf", "rules", "rich"), ".md", windsurfFm, renderRichInit, renderRichRouter, renderRichExpert);

  // Rich + cursor frontmatter → dot-cursor/rules/rich/
  addSet(artifacts, system, path.join("dot-cursor", "rules", "rich"), ".mdc", cursorFm, renderRichInit, renderRichRouter, renderRichExpert);

  // Startup loader → dot-cursor/rules/ and dot-windsurf/rules/
  artifacts.set(
    path.join("dot-cursor", "rules", "00-startup.mdc"),
    HEADER + cursorFm("startup", system) + STARTUP_BODY
  );
  artifacts.set(
    path.join("dot-windsurf", "rules", "00-startup.md"),
    HEADER + windsurfFm("startup", system) + STARTUP_BODY
  );

  // Sparse + cursor frontmatter → dot-cursor/rules/gpt/
  addSet(artifacts, system, path.join("dot-cursor", "rules", "gpt"), ".mdc", cursorFm, renderSparseInit, renderSparseRouter, renderSparseExpert);

  // Sparse + windsurf frontmatter → dot-windsurf/rules/gpt/
  addSet(artifacts, system, path.join("dot-windsurf", "rules", "gpt"), ".md", windsurfFm, renderSparseInit, renderSparseRouter, renderSparseExpert);

  // Codex (own format, sparse)
  artifacts.set(path.join("dot-codex", "AGENTS.md"), renderAgents(system));
  for (const expert of system.experts) {
    artifacts.set(
      path.join("dot-codex", "skills", expert.codexSkillDir, "SKILL.md"),
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

function windsurfFm(kind, _system, expert) {
  if (kind === "startup") {
    return renderMdFrontmatter({
      trigger: "always_on",
      description: "Model routing: directs GPT-family models to the gpt/ subfolder."
    });
  }
  if (kind === "init") {
    return renderMdFrontmatter({
      trigger: "model_decision",
      description: "Global OS for the MoE Swarm Architecture. Loaded into every agent context. Defines universal mandates that supersede individual expert personas."
    });
  }
  if (kind === "router") {
    return renderMdFrontmatter({
      trigger: "model_decision",
      description: "MoE Orchestrator / Router. Front-line triage agent. Analyzes intent and routes to the correct pipeline or expert. Use when the task type is ambiguous or spans multiple concerns."
    });
  }
  return renderMdFrontmatter({
    trigger: "model_decision",
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
    alwaysApply: true
  });
}
