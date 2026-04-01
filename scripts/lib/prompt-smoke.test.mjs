import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { generateArtifacts } from "./build-prompt-system.mjs";
import { loadPromptSystemSpec } from "./prompt-system.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const system = await loadPromptSystemSpec(workspaceRoot);
const artifacts = generateArtifacts(system);

const CURSOR_RICH = "dot-cursor/rules";
const CURSOR_SPARSE = "dot-cursor/rules/gpt";
const MAX_CHARS = 15000;

function artifactsInDir(dir, ext) {
  return [...artifacts].filter(
    ([p]) => p.startsWith(dir + "/") && p.endsWith(ext) && !p.includes("/gpt/")
  );
}

function cursorArtifacts() {
  return [...artifacts].filter(
    ([p]) =>
      p.startsWith(CURSOR_RICH + "/") &&
      p.endsWith(".mdc") &&
      !p.includes("/gpt/")
  );
}

function sparseArtifacts() {
  return [...artifacts].filter(
    ([p]) => p.startsWith(CURSOR_SPARSE + "/") && p.endsWith(".mdc")
  );
}

function expertArtifacts(dir, ext) {
  return [...artifacts].filter(
    ([p]) =>
      p.startsWith(dir + "/") &&
      p.endsWith(ext) &&
      !p.includes("/gpt/") &&
      !p.includes("00-init") &&
      !p.includes("01-router")
  );
}

// ── Frontmatter ─────────────────────────────────────────────────────

test("every cursor .mdc artifact has valid frontmatter", () => {
  for (const [filePath, content] of cursorArtifacts()) {
    assert.match(content, /^---\n/, `${filePath}: missing frontmatter opener`);
    assert.match(content, /description:/, `${filePath}: missing description`);
    assert.match(
      content,
      /alwaysApply:/,
      `${filePath}: missing alwaysApply`
    );
    const closingIndex = content.indexOf("---", 4);
    assert.ok(
      closingIndex > 0,
      `${filePath}: frontmatter never closed`
    );
  }
});

test("every windsurf/claude .md artifact has valid frontmatter", () => {
  const mdArtifacts = [...artifacts].filter(
    ([p]) =>
      (p.startsWith("dot-windsurf/rules/") || p.startsWith("dot-claude/rules/")) &&
      p.endsWith(".md") &&
      !p.includes("/gpt/")
  );

  for (const [filePath, content] of mdArtifacts) {
    assert.match(content, /^---\n/, `${filePath}: missing frontmatter opener`);
    assert.match(content, /description:/, `${filePath}: missing description`);
    assert.match(content, /trigger:/, `${filePath}: missing trigger`);
  }
});

test("every codex SKILL.md has valid frontmatter", () => {
  const skills = [...artifacts].filter(([p]) => p.includes("SKILL.md"));

  for (const [filePath, content] of skills) {
    assert.match(content, /^---\n/, `${filePath}: missing frontmatter opener`);
    assert.match(content, /name:/, `${filePath}: missing name`);
    assert.match(content, /description:/, `${filePath}: missing description`);
  }
});

// ── Required Sections: Init ─────────────────────────────────────────

test("init prompts contain required sections", () => {
  const initFiles = [...artifacts].filter(
    ([p]) => p.includes("00-init") && !p.includes("/gpt/")
  );
  assert.ok(initFiles.length >= 3, "Expected init files for cursor, windsurf, claude");

  const requiredPatterns = [
    /logging/i,
    /definition of done/i,
    /foundational constraints/i,
    /swarm registry|expert registry|available expert/i
  ];

  for (const [filePath, content] of initFiles) {
    for (const pattern of requiredPatterns) {
      assert.match(
        content,
        pattern,
        `${filePath}: missing required init section matching ${pattern}`
      );
    }
  }
});

// ── Required Sections: Router ───────────────────────────────────────

test("router prompts contain required sections", () => {
  const routerFiles = [...artifacts].filter(
    ([p]) => p.includes("01-router") && !p.includes("/gpt/")
  );
  assert.ok(routerFiles.length >= 3, "Expected router files for cursor, windsurf, claude");

  const requiredPatterns = [/routing heuristics/i, /pipeline/i];

  for (const [filePath, content] of routerFiles) {
    for (const pattern of requiredPatterns) {
      assert.match(
        content,
        pattern,
        `${filePath}: missing required router section matching ${pattern}`
      );
    }
  }
});

// ── Required Sections: Expert ───────────────────────────────────────

test("expert prompts contain required structural sections", () => {
  const experts = expertArtifacts(CURSOR_RICH, ".mdc");
  assert.ok(experts.length === 11, `Expected 11 expert files, got ${experts.length}`);

  for (const [filePath, content] of experts) {
    assert.match(content, /method/i, `${filePath}: missing Method section`);
    assert.match(content, /voice/i, `${filePath}: missing Voice section`);
    assert.match(content, /deliverables/i, `${filePath}: missing Deliverables section`);
    assert.match(
      content,
      /output contract/i,
      `${filePath}: missing Output Contract section`
    );
    assert.match(
      content,
      /failure signals/i,
      `${filePath}: missing Failure Signals section`
    );
    assert.match(
      content,
      /behavioral guardrails/i,
      `${filePath}: missing Behavioral Guardrails section`
    );
    assert.match(
      content,
      /allowed handoffs/i,
      `${filePath}: missing Allowed Handoffs section`
    );
  }
});

// ── Expert ID Consistency ───────────────────────────────────────────

test("every expert in router heuristics has a generated file", () => {
  const referencedExperts = new Set(
    system.router.routingHeuristics.flatMap((h) => h.experts)
  );
  const generatedExperts = new Set(system.experts.map((e) => e.id));

  for (const expertId of referencedExperts) {
    assert.ok(
      generatedExperts.has(expertId),
      `Router references ${expertId} but no expert JSON exists`
    );
  }
});

test("every expert in swarm registry has generated artifacts across all targets", () => {
  const expertIds = system.experts.map((e) => e.id);

  for (const expertId of expertIds) {
    const cursorFile = [...artifacts].find(
      ([p]) =>
        p === path.join(CURSOR_RICH, `${expertId}.mdc`)
    );
    assert.ok(cursorFile, `Missing cursor artifact for ${expertId}`);

    const codexFile = [...artifacts].find(
      ([p]) => p.includes(expertId) && p.includes("SKILL.md")
    );
    assert.ok(codexFile, `Missing codex SKILL.md for ${expertId}`);
  }
});

// ── Handoff Cross-References ────────────────────────────────────────

test("every handoff target references a valid expert", () => {
  const validIds = new Set(system.experts.map((e) => e.id));

  for (const expert of system.experts) {
    for (const rule of expert.handoffRules || []) {
      const match = rule.match(/expert-[\w-]+/);
      if (match) {
        assert.ok(
          validIds.has(match[0]),
          `${expert.id} handoff references unknown expert: ${match[0]}`
        );
      }
    }
  }
});

// ── Behavioral Guardrails Structure ─────────────────────────────────

test("every expert has a non-empty behavioralGuardrails array", () => {
  for (const expert of system.experts) {
    assert.ok(
      Array.isArray(expert.behavioralGuardrails) &&
        expert.behavioralGuardrails.length > 0,
      `${expert.id}: missing or empty behavioralGuardrails`
    );
  }
});

test("every guardrail triple has all three required fields", () => {
  for (const expert of system.experts) {
    for (const g of expert.behavioralGuardrails || []) {
      assert.ok(g.failureMode, `${expert.id}: guardrail missing failureMode`);
      assert.ok(g.rule, `${expert.id}: guardrail missing rule`);
      assert.ok(
        g.antiOverCorrection,
        `${expert.id}: guardrail missing antiOverCorrection`
      );
    }
  }
});

// ── Constraint Hierarchy ────────────────────────────────────────────

test("system.json defines a constraintHierarchy with 3 layers", () => {
  assert.ok(system.constraintHierarchy, "Missing constraintHierarchy");
  assert.ok(system.constraintHierarchy.invariant, "Missing invariant");
  assert.strictEqual(
    system.constraintHierarchy.layers.length,
    3,
    "Expected 3 constraint layers"
  );
});

test("init prompts render the constraint hierarchy", () => {
  const initFiles = [...artifacts].filter(
    ([p]) => p.includes("00-init") && !p.includes("/gpt/")
  );

  for (const [filePath, content] of initFiles) {
    assert.match(
      content,
      /constraint hierarchy/i,
      `${filePath}: missing Constraint Hierarchy section`
    );
    assert.match(
      content,
      /invariant/i,
      `${filePath}: missing invariant statement`
    );
  }
});

test("no expert contradicts globalRuntime encoding rules", () => {
  for (const expert of system.experts) {
    const allText = JSON.stringify(expert).toLowerCase();
    if (expert.id !== "expert-ux-rogers") {
      assert.ok(
        !allText.includes("use emoji"),
        `${expert.id} contradicts the global emoji ban`
      );
    }
  }
});

test("_modelTuning fields are not rendered into generated output", () => {
  for (const [filePath, content] of artifacts) {
    assert.ok(
      !content.includes("_modelTuning"),
      `${filePath} contains _modelTuning marker in rendered output`
    );
  }
});

// ── Token Budget ────────────────────────────────────────────────────

test("no generated artifact exceeds the character budget", () => {
  for (const [filePath, content] of artifacts) {
    assert.ok(
      content.length <= MAX_CHARS,
      `${filePath} is ${content.length} chars (max ${MAX_CHARS})`
    );
  }
});

// ── Ablation Manifest ───────────────────────────────────────────────

import { readFile } from "node:fs/promises";

test("ablation manifest has at least 5 sections with required fields", async () => {
  const raw = await readFile(
    path.join(workspaceRoot, "regression", "ablation-manifest.json"),
    "utf8"
  );
  const manifest = JSON.parse(raw);
  assert.ok(manifest.sections.length >= 5, `Expected >=5 sections, got ${manifest.sections.length}`);
  for (const s of manifest.sections) {
    assert.ok(s.id, "Missing id");
    assert.ok(s.description, "Missing description");
    assert.ok(s.source, "Missing source");
    assert.ok(s.expectedImpact, "Missing expectedImpact");
  }
});
