import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { generateArtifacts } from "./build-prompt-system.mjs";
import { loadPromptSystemSpec } from "./prompt-system.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const system = await loadPromptSystemSpec(workspaceRoot);
const artifacts = generateArtifacts(system);
const debugArtifacts = generateArtifacts(system, { debug: true });

const CURSOR_RICH = "compiled/cursor/rules";
const MAX_CHARS = 15000;

function artifactsInDir(dir, ext) {
  return [...artifacts].filter(
    ([p]) => p.startsWith(dir + "/") && p.endsWith(ext)
  );
}

function cursorArtifacts() {
  return [...artifacts].filter(
    ([p]) =>
      p.startsWith(CURSOR_RICH + "/") &&
      p.endsWith(".mdc")
  );
}

function expertArtifacts(dir, ext) {
  return [...artifacts].filter(
    ([p]) =>
      p.startsWith(dir + "/") &&
      p.endsWith(ext) &&
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
      (p.startsWith("compiled/windsurf/rules/") || p.startsWith("compiled/claude/rules/")) &&
      p.endsWith(".md")
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

// ── Frontmatter Correctness ─────────────────────────────────────────

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) fm[key.trim()] = rest.join(":").trim().replace(/^"|"$/g, "");
  }
  return fm;
}

test("cursor init and router are alwaysApply:true, experts are alwaysApply:false", () => {
  for (const [filePath, content] of cursorArtifacts()) {
    const fm = extractFrontmatter(content);
    const isInit = filePath.includes("00-init");
    const isRouter = filePath.includes("01-router");

    if (isInit || isRouter) {
      assert.strictEqual(
        fm.alwaysApply, "true",
        `${filePath}: init/router must be alwaysApply: true`
      );
    } else {
      assert.strictEqual(
        fm.alwaysApply, "false",
        `${filePath}: expert must be alwaysApply: false`
      );
    }
  }
});

test("windsurf init and router are trigger:always, experts are trigger:model_decision", () => {
  const windsurfMd = [...artifacts].filter(
    ([p]) =>
      p.startsWith("compiled/windsurf/rules/") &&
      p.endsWith(".md")
  );

  for (const [filePath, content] of windsurfMd) {
    const fm = extractFrontmatter(content);
    const isInit = filePath.includes("00-init");
    const isRouter = filePath.includes("01-router");

    if (isInit || isRouter) {
      assert.strictEqual(
        fm.trigger, "always",
        `${filePath}: init/router must be trigger: always`
      );
    } else {
      assert.strictEqual(
        fm.trigger, "model_decision",
        `${filePath}: expert must be trigger: model_decision`
      );
    }
  }
});

test("claude init and router are trigger:always, experts are trigger:model_decision", () => {
  const claudeMd = [...artifacts].filter(
    ([p]) =>
      p.startsWith("compiled/claude/rules/") &&
      p.endsWith(".md")
  );

  for (const [filePath, content] of claudeMd) {
    const fm = extractFrontmatter(content);
    const isInit = filePath.includes("00-init");
    const isRouter = filePath.includes("01-router");

    if (isInit || isRouter) {
      assert.strictEqual(
        fm.trigger, "always",
        `${filePath}: init/router must be trigger: always`
      );
    } else {
      assert.strictEqual(
        fm.trigger, "model_decision",
        `${filePath}: expert must be trigger: model_decision`
      );
    }
  }
});

// ── Required Sections: Init ─────────────────────────────────────────

test("init prompts contain required sections", () => {
  const initFiles = [...artifacts].filter(
    ([p]) => p.includes("00-init")
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

test("rich init prompts render routing-first and protocol-over-velocity rules", () => {
  const richInitFiles = [...artifacts].filter(([p]) =>
    ["compiled/claude/rules/00-init.md", "compiled/windsurf/rules/00-init.md", "compiled/cursor/rules/00-init.mdc"].includes(p)
  );

  for (const [filePath, content] of richInitFiles) {
    assert.match(
      content,
      /Before the first tool call, skill invocation, or code edit, complete the routing step internally\./,
      `${filePath}: missing routing-first execution binding`
    );
    assert.match(
      content,
      /Never prioritize task velocity over protocol compliance\./,
      `${filePath}: missing protocol-over-velocity rule`
    );
    assert.match(
      content,
      /The user's assignment outranks opportunistic quick wins unless the user explicitly requests a quick-win approach\./,
      `${filePath}: missing assignment-over-quick-wins constraint`
    );
  }
});

// ── Required Sections: Router ───────────────────────────────────────

test("router prompts contain required sections", () => {
  const routerFiles = [...artifacts].filter(
    ([p]) => p.includes("01-router")
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

test("rich router prompts render the router contract rules", () => {
  const richRouterFiles = [...artifacts].filter(([p]) =>
    ["compiled/claude/rules/01-router.md", "compiled/windsurf/rules/01-router.md", "compiled/cursor/rules/01-router.mdc"].includes(p)
  );

  for (const [filePath, content] of richRouterFiles) {
    assert.match(
      content,
      /Routing is mandatory before the first tool call, skill invocation, or code edit\./,
      `${filePath}: missing routing-first router contract`
    );
    assert.match(
      content,
      /Prefer protocol compliance over task velocity when they compete\./,
      `${filePath}: missing protocol-over-velocity router contract`
    );
  }
});

test("codex runtime renders execution binding and router contract rules", () => {
  const content = artifacts.get("compiled/codex/AGENTS.md");
  assert.ok(content, "Missing compiled/codex/AGENTS.md artifact");
  assert.match(
    content,
    /Before the first tool call, skill invocation, or code edit, complete the routing step internally\./,
    "compiled/codex/AGENTS.md: missing routing-first execution binding"
  );
  assert.match(
    content,
    /Never prioritize task velocity over protocol compliance\./,
    "compiled/codex/AGENTS.md: missing protocol-over-velocity rule"
  );
  assert.match(
    content,
    /Routing is mandatory before the first tool call, skill invocation, or code edit\./,
    "compiled/codex/AGENTS.md: missing router contract rule"
  );
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

test("system.json defines a constraintHierarchy with 4 layers", () => {
  assert.ok(system.constraintHierarchy, "Missing constraintHierarchy");
  assert.ok(system.constraintHierarchy.invariant, "Missing invariant");
  assert.strictEqual(
    system.constraintHierarchy.layers.length,
    4,
    "Expected 4 constraint layers (Global Runtime, Router, Modifier, Expert Persona)"
  );
});

test("init prompts render the constraint hierarchy", () => {
  const initFiles = [...artifacts].filter(
    ([p]) => p.includes("00-init")
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

// ── Debug vs Production Execution Binding ───────────────────────────

test("production init includes production binding and excludes debug binding", () => {
  const initFiles = [...artifacts].filter(([p]) => p.includes("00-init"));

  for (const [filePath, content] of initFiles) {
    assert.match(
      content,
      /Route internally before acting/,
      `${filePath}: missing production execution binding`
    );
    assert.ok(
      !content.includes("State the routing decision with Selected Expert, Reason, and Confidence"),
      `${filePath}: production build must not contain debug routing output instruction`
    );
  }
});

test("debug init includes debug binding and excludes production binding", () => {
  const initFiles = [...debugArtifacts].filter(([p]) => p.includes("00-init"));

  for (const [filePath, content] of initFiles) {
    assert.match(
      content,
      /State the routing decision with Selected Expert, Reason, and Confidence/,
      `${filePath} (debug): missing debug execution binding`
    );
    assert.ok(
      !content.includes("Route internally before acting"),
      `${filePath} (debug): debug build must not contain production routing suppression`
    );
  }
});

test("production codex AGENTS.md includes production binding", () => {
  const content = artifacts.get("compiled/codex/AGENTS.md");
  assert.ok(content, "Missing compiled/codex/AGENTS.md");
  assert.match(
    content,
    /Route internally before acting/,
    "Production codex AGENTS.md: missing production execution binding"
  );
  assert.ok(
    !content.includes("State the routing decision with Selected Expert, Reason, and Confidence"),
    "Production codex AGENTS.md must not contain debug routing output instruction"
  );
});

test("debug codex AGENTS.md includes debug binding", () => {
  const content = debugArtifacts.get("compiled/codex/AGENTS.md");
  assert.ok(content, "Missing debug compiled/codex/AGENTS.md");
  assert.match(
    content,
    /State the routing decision with Selected Expert, Reason, and Confidence/,
    "Debug codex AGENTS.md: missing debug execution binding"
  );
});

// ── Routing Evolution: Negative Examples ─────────────────────────────

test("router.json has negativeExamples with at least 3 keys", () => {
  const ne = system.router.negativeExamples;
  assert.ok(ne, "Missing negativeExamples in router.json");
  assert.ok(Object.keys(ne).length >= 3, `Expected >= 3 negative example keys, got ${Object.keys(ne).length}`);
});

test("rich router renders Routing Anti-Patterns section", () => {
  const routerFiles = [...artifacts].filter(([p]) => p.includes("01-router"));
  for (const [filePath, content] of routerFiles) {
    assert.match(
      content,
      /Routing Anti-Patterns/,
      `${filePath}: missing Routing Anti-Patterns section`
    );
  }
});

test("codex AGENTS.md renders Routing Anti-Patterns section", () => {
  const content = artifacts.get("compiled/codex/AGENTS.md");
  assert.ok(content, "Missing compiled/codex/AGENTS.md");
  assert.match(
    content,
    /Routing Anti-Patterns/,
    "compiled/codex/AGENTS.md: missing Routing Anti-Patterns section"
  );
});

// ── Routing Evolution: Sub-Domain Heuristics ─────────────────────────

test("router has at least 18 routing heuristics (expanded sub-domains)", () => {
  const count = system.router.routingHeuristics.length;
  assert.ok(count >= 18, `Expected >= 18 routing heuristics, got ${count}`);
});

test("router has sub-domains for debug and implementation", () => {
  const domains = system.router.routingHeuristics.map(h => h.domain);
  assert.ok(domains.includes("Test Failure Diagnosis"), "Missing Test Failure Diagnosis sub-domain");
  assert.ok(domains.includes("Build & Config Errors"), "Missing Build & Config Errors sub-domain");
  assert.ok(domains.includes("Quick Fix & Patch"), "Missing Quick Fix & Patch sub-domain");
  assert.ok(domains.includes("General Implementation"), "Missing General Implementation sub-domain");
  assert.ok(domains.includes("Refactoring & Restructuring"), "Missing Refactoring & Restructuring sub-domain");
  assert.ok(domains.includes("Test Authoring"), "Missing Test Authoring sub-domain");
  assert.ok(domains.includes("Runtime Error Investigation"), "Missing Runtime Error Investigation sub-domain");
});

// ── Routing Evolution: Pipelines ─────────────────────────────────────

test("router has at least 6 pipelines (including council and verify)", () => {
  const count = system.router.pipelines.length;
  assert.ok(count >= 6, `Expected >= 6 pipelines, got ${count}`);
});

test("Deliberation Council pipeline exists with trigger signals", () => {
  const council = system.router.pipelines.find(p => p.name === "Deliberation Council");
  assert.ok(council, "Missing Deliberation Council pipeline");
  assert.ok(council.triggerSignals?.length >= 3, "Council needs at least 3 trigger signals");
  assert.ok(council.autoTrigger, "Council needs an auto-trigger condition");
  assert.ok(council.steps.length >= 4, "Council needs at least 4 steps");
});

test("Implement & Verify pipeline exists with adversarial step", () => {
  const verify = system.router.pipelines.find(p => p.name === "Implement & Verify");
  assert.ok(verify, "Missing Implement & Verify pipeline");
  assert.ok(verify.steps.length >= 3, "Verify pipeline needs at least 3 steps");
  const adversarialStep = verify.steps.find(s => s.task.includes("VERDICT"));
  assert.ok(adversarialStep, "Verify pipeline needs a step with VERDICT keyword");
});

// ── Routing Evolution: Two-Pass Refinement ───────────────────────────

test("router has refinementHeuristics with at least 3 refinements", () => {
  const rh = system.router.refinementHeuristics;
  assert.ok(rh, "Missing refinementHeuristics in router.json");
  assert.ok(rh.refinements.length >= 3, `Expected >= 3 refinements, got ${rh.refinements.length}`);
});

test("rich router renders Two-Pass Routing Refinement section", () => {
  const routerFiles = [...artifacts].filter(([p]) => p.includes("01-router"));
  for (const [filePath, content] of routerFiles) {
    assert.match(
      content,
      /Two-Pass Routing Refinement/,
      `${filePath}: missing Two-Pass Routing Refinement section`
    );
  }
});

test("codex AGENTS.md renders Two-Pass Routing Refinement section", () => {
  const content = artifacts.get("compiled/codex/AGENTS.md");
  assert.ok(content, "Missing compiled/codex/AGENTS.md");
  assert.match(
    content,
    /Two-Pass Routing Refinement/,
    "compiled/codex/AGENTS.md: missing Two-Pass Routing Refinement section"
  );
});

// ── Routing Evolution: Contracts ─────────────────────────────────────

test("router contracts include negative example and two-pass rules", () => {
  const contracts = system.router.contracts;
  const hasNegative = contracts.some(c => c.includes("negative routing examples"));
  const hasTwoPass = contracts.some(c => c.includes("two-pass routing"));
  assert.ok(hasNegative, "Missing negative routing examples contract");
  assert.ok(hasTwoPass, "Missing two-pass routing contract");
});

// ── Routing Evolution: Verification Contract ─────────────────────────

test("Popper has a verificationContract with rules", () => {
  const popper = system.experts.find(e => e.id === "expert-qa-popper");
  assert.ok(popper, "Missing Popper expert");
  assert.ok(popper.verificationContract, "Missing verificationContract on Popper");
  assert.ok(popper.verificationContract.rules.length >= 5, "Verification contract needs at least 5 rules");
  const hasVerdict = popper.verificationContract.rules.some(r => r.includes("VERDICT"));
  assert.ok(hasVerdict, "Verification contract must mention VERDICT");
});

// ── Routing Evolution: Disambiguation Expansion ──────────────────────

test("disambiguation has entries for all 9 experts", () => {
  const keys = Object.keys(system.router.disambiguation);
  assert.ok(keys.length >= 9, `Expected >= 9 disambiguation keys, got ${keys.length}`);
  assert.ok(keys.includes("routeToDescartes"), "Missing routeToDescartes disambiguation");
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

// ── Modifier System ─────────────────────────────────────────────────

test("system.modifiers is a non-empty array", () => {
  assert.ok(
    Array.isArray(system.modifiers) && system.modifiers.length > 0,
    "Expected at least one modifier in prompt-system/modifiers/"
  );
});

test("every modifier has required fields", () => {
  for (const mod of system.modifiers) {
    assert.ok(mod.id, `Modifier missing id`);
    assert.ok(mod.name, `${mod.id}: missing name`);
    assert.ok(mod.trigger, `${mod.id}: missing trigger`);
    assert.ok(mod.description, `${mod.id}: missing description`);
    assert.ok(
      Array.isArray(mod.activationSignals) && mod.activationSignals.length > 0,
      `${mod.id}: missing or empty activationSignals`
    );
    assert.ok(
      Array.isArray(mod.deactivationSignals) && mod.deactivationSignals.length > 0,
      `${mod.id}: missing or empty deactivationSignals`
    );
    assert.ok(
      Array.isArray(mod.intensityLevels) && mod.intensityLevels.length > 0,
      `${mod.id}: missing or empty intensityLevels`
    );
    assert.ok(mod.defaultIntensity, `${mod.id}: missing defaultIntensity`);
    assert.ok(
      Array.isArray(mod.boundaries) && mod.boundaries.length > 0,
      `${mod.id}: missing or empty boundaries`
    );
    assert.ok(
      Array.isArray(mod.safetyValves) && mod.safetyValves.length > 0,
      `${mod.id}: missing or empty safetyValves`
    );
  }
});

test("every modifier intensity level has level, description, and rules", () => {
  for (const mod of system.modifiers) {
    for (const level of mod.intensityLevels) {
      assert.ok(level.level, `${mod.id}: intensity missing level name`);
      assert.ok(level.description, `${mod.id}/${level.level}: missing description`);
      assert.ok(
        Array.isArray(level.rules) && level.rules.length > 0,
        `${mod.id}/${level.level}: missing or empty rules`
      );
    }
  }
});

test("every modifier safety valve has condition and action", () => {
  for (const mod of system.modifiers) {
    for (const sv of mod.safetyValves) {
      assert.ok(sv.condition, `${mod.id}: safety valve missing condition`);
      assert.ok(sv.action, `${mod.id}: safety valve missing action`);
    }
  }
});

test("rich init renders Modifiers section when modifiers exist", () => {
  const initFiles = [...artifacts].filter(([p]) => p.includes("00-init"));
  for (const [filePath, content] of initFiles) {
    assert.match(
      content,
      /## Modifiers/,
      `${filePath}: missing Modifiers section`
    );
    assert.match(
      content,
      /Caveman Edict/,
      `${filePath}: missing Caveman Edict modifier`
    );
    assert.match(
      content,
      /Safety Valves/,
      `${filePath}: missing Safety Valves in modifier section`
    );
  }
});

test("codex AGENTS.md renders Modifiers section", () => {
  const content = artifacts.get("compiled/codex/AGENTS.md");
  assert.ok(content, "Missing compiled/codex/AGENTS.md");
  assert.match(
    content,
    /## Modifiers/,
    "compiled/codex/AGENTS.md: missing Modifiers section"
  );
  assert.match(
    content,
    /Caveman Edict/,
    "compiled/codex/AGENTS.md: missing Caveman Edict modifier"
  );
});

test("modifier section does not appear in expert artifacts", () => {
  const experts = expertArtifacts(CURSOR_RICH, ".mdc");
  for (const [filePath, content] of experts) {
    assert.ok(
      !content.includes("## Modifiers"),
      `${filePath}: expert artifact should not contain a Modifiers section`
    );
  }
});

test("router renders Modifier Activation section", () => {
  const routerFiles = [...artifacts].filter(([p]) => p.includes("01-router"));
  for (const [filePath, content] of routerFiles) {
    assert.match(
      content,
      /Modifier Activation/,
      `${filePath}: missing Modifier Activation section`
    );
  }
});

test("constraint hierarchy includes Modifier layer", () => {
  const layerNames = system.constraintHierarchy.layers.map((l) => l.name);
  assert.ok(
    layerNames.includes("Modifier"),
    "constraintHierarchy missing Modifier layer"
  );
  const modIdx = layerNames.indexOf("Modifier");
  const expertIdx = layerNames.indexOf("Expert Persona");
  assert.ok(
    modIdx < expertIdx,
    "Modifier layer must come before Expert Persona layer"
  );
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
