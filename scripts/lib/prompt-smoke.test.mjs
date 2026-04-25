import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { generateArtifacts } from "./build-prompt-system.mjs";
import {
  loadPromptSystemSpec,
  resolveRequiredSections,
  VERBALIZED_SAMPLING_ROUTER_RULES
} from "./prompt-system.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const system = await loadPromptSystemSpec(workspaceRoot);
const artifacts = generateArtifacts(system);
const debugArtifacts = generateArtifacts(system, { debug: true });

const CURSOR_RICH = "compiled/cursor/rules";
// Router artifact includes full heuristic tables, pipelines, allowlist, and contracts.
const MAX_CHARS = 18000;

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

// ── PROTOCOL: Cross-Target Semantic Equivalence ─────────────────────

function extractExpertReferences(content) {
  return [...new Set([...content.matchAll(/expert-[\w-]+/g)].map(m => m[0]))].sort();
}

function extractRoutingDomains(content) {
  const domains = [];
  for (const h of system.router.routingHeuristics) {
    if (content.includes(h.domain)) domains.push(h.domain);
  }
  return domains.sort();
}

function extractContractRules(content) {
  return system.router.contracts.filter(rule => content.includes(rule));
}

function extractNegativeExampleKeys(content) {
  return Object.keys(system.router.negativeExamples).filter(key => {
    const rules = system.router.negativeExamples[key];
    return rules.some(rule => content.includes(rule));
  });
}

test("PROTOCOL: all targets reference the same set of expert IDs in init artifacts", () => {
  const claudeInit = artifacts.get("compiled/claude/rules/00-init.md");
  const cursorInit = artifacts.get("compiled/cursor/rules/00-init.mdc");
  const codexAgents = artifacts.get("compiled/codex/AGENTS.md");
  const crushInit = artifacts.get("compiled/crush/rules/00-init.md");
  const geminiInit = artifacts.get("compiled/gemini/rules/00-init.md");

  const claudeExperts = extractExpertReferences(claudeInit);
  const cursorExperts = extractExpertReferences(cursorInit);
  const codexExperts = extractExpertReferences(codexAgents);
  const crushExperts = extractExpertReferences(crushInit);
  const geminiExperts = extractExpertReferences(geminiInit);

  assert.deepEqual(claudeExperts, cursorExperts, "Claude and Cursor init must reference same experts");
  assert.deepEqual(claudeExperts, codexExperts, "Claude and Codex must reference same experts in init/AGENTS.md");
  assert.deepEqual(claudeExperts, crushExperts, "Claude and Crush init must reference same experts");
  assert.deepEqual(claudeExperts, geminiExperts, "Claude and Gemini init must reference same experts");
});

test("PROTOCOL: all targets render the same routing domains", () => {
  const claudeRouter = artifacts.get("compiled/claude/rules/01-router.md");
  const codexAgents = artifacts.get("compiled/codex/AGENTS.md");

  const claudeDomains = extractRoutingDomains(claudeRouter);
  const codexDomains = extractRoutingDomains(codexAgents);

  assert.deepEqual(claudeDomains, codexDomains, "Rich router and Codex AGENTS.md must render the same routing domains");
});

test("PROTOCOL: all targets render the same router contract rules", () => {
  const claudeRouter = artifacts.get("compiled/claude/rules/01-router.md");
  const codexAgents = artifacts.get("compiled/codex/AGENTS.md");

  const claudeContracts = extractContractRules(claudeRouter);
  const codexContracts = extractContractRules(codexAgents);

  assert.deepEqual(claudeContracts, codexContracts, "Rich router and Codex must render the same contract rules");
});

test("PROTOCOL: all targets render the same negative routing example keys", () => {
  const claudeRouter = artifacts.get("compiled/claude/rules/01-router.md");
  const codexAgents = artifacts.get("compiled/codex/AGENTS.md");

  const claudeNeg = extractNegativeExampleKeys(claudeRouter);
  const codexNeg = extractNegativeExampleKeys(codexAgents);

  assert.deepEqual(claudeNeg, codexNeg, "Rich and Codex must render the same negative routing example categories");
});

test("PROTOCOL: every expert has matching required sections across rich and codex artifacts", () => {
  for (const expert of system.experts) {
    const { defaultSections, complexSections } = resolveRequiredSections(expert.requiredSections);
    const allSections = [...new Set([...defaultSections, ...complexSections])];

    const richContent = artifacts.get(`compiled/cursor/rules/${expert.id}.mdc`);
    const codexContent = [...artifacts].find(
      ([p]) => p.includes(expert.codexSkillDir) && p.includes("SKILL.md")
    )?.[1];

    assert.ok(richContent, `Missing cursor artifact for ${expert.id}`);
    assert.ok(codexContent, `Missing codex SKILL.md for ${expert.id}`);

    for (const section of allSections) {
      assert.ok(
        richContent.includes(section),
        `${expert.id} cursor artifact missing required section: ${section}`
      );
      assert.ok(
        codexContent.includes(section),
        `${expert.id} codex SKILL.md missing required section: ${section}`
      );
    }
  }
});

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

test("every gemini .md artifact has HTML comment marker and no YAML frontmatter", () => {
  const geminiArtifacts = [...artifacts].filter(
    ([p]) => p.startsWith("compiled/gemini/rules/") && p.endsWith(".md")
  );

  assert.ok(geminiArtifacts.length >= 13, `Expected >= 13 gemini artifacts, got ${geminiArtifacts.length}`);

  for (const [filePath, content] of geminiArtifacts) {
    assert.match(
      content,
      /<!-- managed_by: agent-historic -->/,
      `${filePath}: missing HTML comment managed_by marker`
    );
    assert.ok(
      !content.startsWith("---\n"),
      `${filePath}: gemini artifact must not have YAML frontmatter`
    );
  }
});

test("every windsurf/claude/crush .md artifact has valid frontmatter", () => {
  const mdArtifacts = [...artifacts].filter(
    ([p]) =>
      (p.startsWith("compiled/windsurf/rules/") || p.startsWith("compiled/claude/rules/") || p.startsWith("compiled/crush/rules/")) &&
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

test("crush init and router are trigger:always, experts are trigger:model_decision", () => {
  const crushMd = [...artifacts].filter(
    ([p]) =>
      p.startsWith("compiled/crush/rules/") &&
      p.endsWith(".md")
  );

  for (const [filePath, content] of crushMd) {
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
  assert.ok(initFiles.length >= 5, "Expected init files for cursor, windsurf, claude, crush, gemini");

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
    ["compiled/claude/rules/00-init.md", "compiled/windsurf/rules/00-init.md", "compiled/cursor/rules/00-init.mdc", "compiled/crush/rules/00-init.md", "compiled/gemini/rules/00-init.md"].includes(p)
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
  assert.ok(routerFiles.length >= 5, "Expected router files for cursor, windsurf, claude, crush, gemini");

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
    ["compiled/claude/rules/01-router.md", "compiled/windsurf/rules/01-router.md", "compiled/cursor/rules/01-router.mdc", "compiled/crush/rules/01-router.md", "compiled/gemini/rules/01-router.md"].includes(p)
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
  assert.ok(experts.length === 12, `Expected 12 expert files, got ${experts.length}`);

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

    const crushFile = [...artifacts].find(
      ([p]) =>
        p === path.join("compiled", "crush", "rules", `${expertId}.md`)
    );
    assert.ok(crushFile, `Missing crush artifact for ${expertId}`);

    const geminiFile = [...artifacts].find(
      ([p]) =>
        p === path.join("compiled", "gemini", "rules", `${expertId}.md`)
    );
    assert.ok(geminiFile, `Missing gemini artifact for ${expertId}`);
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
import { loadRegressionFixtures, routePrompt, evaluateResponse } from "./regression.mjs";

// ── Experiment Framework: Suites ──────────────────────────────────

test("cases.json has specialist-pressure suite with at least 12 cases", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const suite = fixtures.suites["specialist-pressure"];
  assert.ok(suite, "Missing specialist-pressure suite");
  assert.ok(suite.length >= 12, `Expected >= 12 specialist-pressure cases, got ${suite.length}`);
});

test("cases.json has mixed-intent suite with at least 3 cases", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const suite = fixtures.suites["mixed-intent"];
  assert.ok(suite, "Missing mixed-intent suite");
  assert.ok(suite.length >= 3, `Expected >= 3 mixed-intent cases, got ${suite.length}`);
});

test("cases.json has persona-vs-neutral suite with at least 4 cases", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const suite = fixtures.suites["persona-vs-neutral"];
  assert.ok(suite, "Missing persona-vs-neutral suite");
  assert.ok(suite.length >= 4, `Expected >= 4 persona-vs-neutral cases, got ${suite.length}`);
});

test("all suite case IDs reference existing cases", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const caseIds = new Set(fixtures.cases.map((c) => c.id));
  for (const [suiteName, ids] of Object.entries(fixtures.suites)) {
    for (const id of ids) {
      assert.ok(caseIds.has(id), `Suite "${suiteName}" references non-existent case "${id}"`);
    }
  }
});

test("twopass suite has at least 6 cases after expansion", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const suite = fixtures.suites["twopass"];
  assert.ok(suite.length >= 6, `Expected >= 6 twopass cases, got ${suite.length}`);
});

// ── Experiment Framework: Model Parity Suite ──────────────────────

test("cases.json has model-parity suite with at least 10 cases", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const suite = fixtures.suites["model-parity"];
  assert.ok(suite, "Missing model-parity suite");
  assert.ok(suite.length >= 10, `Expected >= 10 model-parity cases, got ${suite.length}`);
});

test("model-parity cases have expectedParity field", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const parityIds = new Set(fixtures.suites["model-parity"]);
  const parityCases = fixtures.cases.filter((c) => parityIds.has(c.id));
  for (const c of parityCases) {
    assert.strictEqual(
      typeof c.expectedParity,
      "boolean",
      `${c.id}: model-parity case must have expectedParity (boolean)`
    );
  }
});

test("model-parity cases with expectedParity:false have a parityNote", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const parityIds = new Set(fixtures.suites["model-parity"]);
  const divergent = fixtures.cases.filter((c) => parityIds.has(c.id) && c.expectedParity === false);
  assert.ok(divergent.length >= 1, "Expected at least 1 known-divergent case in model-parity suite");
  for (const c of divergent) {
    assert.ok(c.parityNote, `${c.id}: divergent case must have a parityNote explaining the divergence`);
  }
});

// ── Experiment Framework: Anti-Triggers & Boost Signals ───────────

test("router has antiTriggers on at least 3 heuristics", () => {
  const withAnti = system.router.routingHeuristics.filter((h) => h.antiTriggers?.length > 0);
  assert.ok(withAnti.length >= 3, `Expected >= 3 heuristics with antiTriggers, got ${withAnti.length}`);
});

test("router has boostSignals on at least 3 heuristics", () => {
  const withBoost = system.router.routingHeuristics.filter((h) => h.boostSignals?.length > 0);
  assert.ok(withBoost.length >= 3, `Expected >= 3 heuristics with boostSignals, got ${withBoost.length}`);
});

test("router has experimentFlags section", () => {
  const flags = system.router.experimentFlags;
  assert.ok(flags, "Missing experimentFlags in router.json");
  assert.strictEqual(typeof flags.antiTriggers, "boolean", "antiTriggers flag must be boolean");
  assert.strictEqual(typeof flags.boostSignals, "boolean", "boostSignals flag must be boolean");
  assert.strictEqual(typeof flags.twoPassRouting, "boolean", "twoPassRouting flag must be boolean");
  assert.strictEqual(typeof flags.verbalizedSampling, "boolean", "verbalizedSampling flag must be boolean");
});

test("PROTOCOL: verbalized sampling block matches rich router vs Codex AGENTS when flag on", () => {
  const vsOn = generateArtifacts(system, { experimentFlags: { verbalizedSampling: true } });
  const claudeRouter = vsOn.get("compiled/claude/rules/01-router.md");
  const codexAgents = vsOn.get("compiled/codex/AGENTS.md");
  const rules = system.router.verbalizedSamplingContracts?.length
    ? system.router.verbalizedSamplingContracts
    : VERBALIZED_SAMPLING_ROUTER_RULES;
  assert.match(claudeRouter, /Verbalized Sampling \(Experiment\)/);
  assert.match(codexAgents, /Verbalized Sampling \(Experiment\)/);
  for (const rule of rules) {
    assert.ok(
      claudeRouter.includes(rule),
      `Claude router missing VS rule snippet: ${rule.slice(0, 60)}…`
    );
    assert.ok(
      codexAgents.includes(rule),
      `Codex AGENTS missing VS rule snippet: ${rule.slice(0, 60)}…`
    );
  }
});

test("rich router renders anti-triggers in heuristics table", () => {
  const routerFiles = [...artifacts].filter(([p]) => p.includes("01-router"));
  for (const [filePath, content] of routerFiles) {
    assert.match(
      content,
      /Anti-Triggers/,
      `${filePath}: missing Anti-Triggers column in heuristics table`
    );
  }
});

// ── Experiment Framework: persona-vs-neutral cases have experiment tags ─

test("persona-vs-neutral cases have experimentTag and experimentHypothesis", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const pnCases = fixtures.cases.filter((c) => c.category === "persona-vs-neutral");
  assert.ok(pnCases.length >= 4, `Expected >= 4 persona-vs-neutral cases`);
  for (const c of pnCases) {
    assert.ok(c.experimentTag, `${c.id}: missing experimentTag`);
    assert.ok(c.experimentHypothesis, `${c.id}: missing experimentHypothesis`);
  }
});

// ── Experiment Framework: Local Routing Smoke Tests ───────────────

test("routePrompt routes specialist-pressure cases to correct experts", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const spCases = fixtures.cases.filter((c) => c.category === "specialist-pressure");
  let correct = 0;
  const misses = [];
  for (const c of spCases) {
    const routed = routePrompt(system, c.prompt);
    if (routed === c.expectedPrimaryExpert) {
      correct++;
    } else {
      misses.push(`${c.id}: expected ${c.expectedPrimaryExpert}, got ${routed}`);
    }
  }
  const accuracy = correct / spCases.length;
  assert.ok(
    accuracy >= 0.5,
    `Specialist-pressure local routing accuracy is ${(accuracy * 100).toFixed(0)}% (need >= 50%). Misses:\n${misses.join("\n")}`
  );
});

test("routePrompt routes mixed-intent cases with at least 50% accuracy", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const miCases = fixtures.cases.filter((c) => c.category === "mixed-intent");
  let correct = 0;
  for (const c of miCases) {
    const routed = routePrompt(system, c.prompt);
    if (routed === c.expectedPrimaryExpert) correct++;
  }
  const accuracy = correct / miCases.length;
  assert.ok(
    accuracy >= 0.5,
    `Mixed-intent local routing accuracy is ${(accuracy * 100).toFixed(0)}% (need >= 50%)`
  );
});

test("ambiguousBetween cases exist and have valid expert references", async () => {
  const fixtures = await loadRegressionFixtures(workspaceRoot);
  const ambiguousCases = fixtures.cases.filter((c) => c.ambiguousBetween?.length > 0);
  assert.ok(ambiguousCases.length >= 3, `Expected >= 3 cases with ambiguousBetween, got ${ambiguousCases.length}`);
  const expertIds = new Set(system.experts.map((e) => e.id));
  for (const c of ambiguousCases) {
    for (const expertId of c.ambiguousBetween) {
      assert.ok(expertIds.has(expertId), `${c.id}: ambiguousBetween references unknown expert ${expertId}`);
    }
    assert.ok(
      c.ambiguousBetween.includes(c.expectedPrimaryExpert),
      `${c.id}: expectedPrimaryExpert must be included in ambiguousBetween`
    );
  }
});

test("evaluateResponse gives partial credit for ambiguousBetween match", () => {
  const mockCase = {
    expectedPrimaryExpert: "expert-abstractions-liskov",
    ambiguousBetween: ["expert-abstractions-liskov", "expert-architect-descartes"],
    expectedSections: ["Answer"],
    allowedHandoffs: [],
    forbiddenBehaviors: [],
    behavioralAssertions: []
  };
  const mockResponse = {
    routingDecision: { selectedExpert: "expert-architect-descartes" },
    activeExpert: "expert-architect-descartes",
    outputSections: ["Answer"],
    confidenceLabeled: true,
    domainStayedInScope: true,
    personaBlend: false,
    handoffs: [],
    response: "**Selected Expert:** expert-architect-descartes\n\n**Answer:** ..."
  };
  const result = evaluateResponse(system, mockCase, mockResponse);
  assert.strictEqual(result.score, 1, "ambiguousBetween match should get score=1 (partial credit)");
  assert.ok(
    result.notableDrift.some((d) => d.includes("Acceptable alternate")),
    "Should note it as an acceptable alternate"
  );
});

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

// ── Compliance Signal Tests (RED: will fail until implemented) ─────────

test("COMPLIANCE: init artifact contains the [rules:loaded...] handshake directive", () => {
  const claudeInit = artifacts.get("compiled/claude/rules/00-init.md");
  assert.ok(
    claudeInit,
    "Missing compiled/claude/rules/00-init.md"
  );
  assert.match(
    claudeInit,
    /\[rules:loaded\s+init\s+router\s+experts@\d+\]/,
    "Init artifact must contain [rules:loaded init router experts@<count>] handshake token"
  );
});

test("COMPLIANCE: every expert artifact contains an Assimilated: <id> trailer", () => {
  for (const expert of system.experts) {
    const artifact = artifacts.get(`compiled/claude/rules/${expert.id}.md`);
    assert.ok(artifact, `Missing artifact for ${expert.id}`);
    const re = new RegExp(`Announce:\\s*"Assimilated:\\s*${expert.id}"`);
    assert.match(
      artifact,
      re,
      `${expert.id} artifact must contain Assimilated: <id> trailer`
    );
  }
});

test("COMPLIANCE: system.json globalRuntime.logging.mandate includes fail-closed redirect pattern", () => {
  const mandate = system.globalRuntime.logging?.mandate;
  assert.ok(mandate, "globalRuntime.logging.mandate is missing");
  assert.match(
    mandate,
    /\.logs\//,
    "logging.mandate must mention .logs/ for fail-closed redirect"
  );
  assert.match(
    mandate,
    /2>&1/,
    "logging.mandate must require 2>&1 for stderr capture"
  );
});

test("COMPLIANCE: system.json has globalRuntime.handshake that is non-empty", () => {
  const handshake = system.globalRuntime.handshake;
  assert.ok(handshake, "globalRuntime.handshake is missing");
  assert.ok(handshake.length > 0, "globalRuntime.handshake must be non-empty");
});

test("COMPLIANCE: handshake render option controls presence (ablation-style)", () => {
  const withHandshake = generateArtifacts(system, { handshake: true });
  const withoutHandshake = generateArtifacts(system, { handshake: false });

  const initWith = withHandshake.get("compiled/claude/rules/00-init.md");
  const initWithout = withoutHandshake.get("compiled/claude/rules/00-init.md");

  assert.match(
    initWith,
    /\[rules:loaded/,
    "handshake:true must produce handshake token"
  );
  assert.ok(
    !initWithout?.includes("[rules:loaded"),
    "handshake:false must omit handshake token"
  );
});

test("COMPLIANCE: trailer render option controls presence (ablation-style)", () => {
  const withTrailer = generateArtifacts(system, { trailer: true });
  const withoutTrailer = generateArtifacts(system, { trailer: false });

  const peirceWith = withTrailer.get("compiled/claude/rules/expert-engineer-peirce.md");
  const peirceWithout = withoutTrailer.get("compiled/claude/rules/expert-engineer-peirce.md");

  assert.match(
    peirceWith,
    /Announce:\s*"Assimilated:/,
    "trailer:true must produce Assimilated trailer"
  );
  assert.ok(
    !peirceWithout?.includes("Announce:"),
    "trailer:false must omit Assimilated trailer"
  );
});

test("COMPLIANCE: failClosedLogging render option controls mandate phrasing", () => {
  const withFailClosed = generateArtifacts(system, { failClosedLogging: true });
  const withoutFailClosed = generateArtifacts(system, { failClosedLogging: false });

  const initWith = withFailClosed.get("compiled/claude/rules/00-init.md");
  const initWithout = withoutFailClosed.get("compiled/claude/rules/00-init.md");

  assert.match(
    initWith,
    /MUST.*\.logs\//,
    "failClosedLogging:true must have MUST + .logs/ in logging section"
  );
  assert.ok(
    !initWithout?.match(/MUST.*\.logs\//)?.[0]?.includes("MUST"),
    "failClosedLogging:false must not have MUST + .logs/ mandatory phrasing"
  );
});

// ── Intensity Profile Tests ─────────────────────────────────────────

test("INTENSITY: declarative targets omit CRITICAL OVERRIDE", () => {
  const cursorRouter = artifacts.get("compiled/cursor/rules/01-router.mdc");
  const windsurfRouter = artifacts.get("compiled/windsurf/rules/01-router.md");
  const crushRouter = artifacts.get("compiled/crush/rules/01-router.md");
  const geminiRouter = artifacts.get("compiled/gemini/rules/01-router.md");

  for (const [name, content] of [["Cursor", cursorRouter], ["Windsurf", windsurfRouter], ["Crush", crushRouter], ["Gemini", geminiRouter]]) {
    assert.ok(
      !content.includes("CRITICAL OVERRIDE"),
      `${name} router must not contain CRITICAL OVERRIDE (declarative intensity)`
    );
    assert.ok(
      content.includes("Automation Preference"),
      `${name} router must contain Automation Preference (declarative intensity)`
    );
  }
});

test("INTENSITY: imperative targets preserve CRITICAL OVERRIDE", () => {
  const claudeRouter = artifacts.get("compiled/claude/rules/01-router.md");
  assert.ok(
    claudeRouter.includes("CRITICAL OVERRIDE"),
    "Claude router must contain CRITICAL OVERRIDE (imperative intensity)"
  );
});

test("INTENSITY: declarative targets omit MUST be exactly in handshake", () => {
  const cursorInit = artifacts.get("compiled/cursor/rules/00-init.mdc");
  const windsurfInit = artifacts.get("compiled/windsurf/rules/00-init.md");

  assert.ok(
    !cursorInit.includes("MUST be exactly"),
    "Cursor init must not contain MUST be exactly (declarative intensity)"
  );
  assert.ok(
    !windsurfInit.includes("MUST be exactly"),
    "Windsurf init must not contain MUST be exactly (declarative intensity)"
  );
  // Both must still contain the handshake token itself
  assert.match(cursorInit, /\[rules:loaded/, "Cursor init must still contain the handshake token");
  assert.match(windsurfInit, /\[rules:loaded/, "Windsurf init must still contain the handshake token");
});

test("INTENSITY: imperative targets preserve MUST be exactly in handshake", () => {
  const claudeInit = artifacts.get("compiled/claude/rules/00-init.md");
  assert.ok(
    claudeInit.includes("MUST be exactly"),
    "Claude init must contain MUST be exactly (imperative intensity)"
  );
});

test("INTENSITY: declarative targets use softened constraint hierarchy language", () => {
  const cursorInit = artifacts.get("compiled/cursor/rules/00-init.mdc");
  assert.ok(
    !cursorInit.includes("supersede any individual expert stance"),
    "Cursor init must not use supersede language (declarative intensity)"
  );
  assert.ok(
    cursorInit.includes("Individual expert stances operate within"),
    "Cursor init must use declarative context phrasing"
  );
  assert.ok(
    !cursorInit.includes("An expert cannot override a globalRuntime rule"),
    "Cursor init must not use imperative constraint description"
  );
  assert.ok(
    cursorInit.includes("Higher-layer rules take precedence"),
    "Cursor init must use declarative constraint description"
  );
});

test("INTENSITY: declarative targets use softened echo contract", () => {
  const cursorRouter = artifacts.get("compiled/cursor/rules/01-router.mdc");
  assert.ok(
    !cursorRouter.includes("Echo the selected expert id verbatim"),
    "Cursor router must not use imperative echo contract"
  );
  assert.ok(
    cursorRouter.includes("Use the selected expert id exactly as listed"),
    "Cursor router must use declarative echo contract"
  );
});

test("INTENSITY: all targets still reference the same handshake token format", () => {
  const tokenPattern = /\[rules:loaded\s+init\s+router\s+experts@\d+\]/;
  const claudeInit = artifacts.get("compiled/claude/rules/00-init.md");
  const cursorInit = artifacts.get("compiled/cursor/rules/00-init.mdc");
  const windsurfInit = artifacts.get("compiled/windsurf/rules/00-init.md");

  assert.match(claudeInit, tokenPattern, "Claude must contain handshake token");
  assert.match(cursorInit, tokenPattern, "Cursor must contain handshake token");
  assert.match(windsurfInit, tokenPattern, "Windsurf must contain handshake token");
});

// ── Intensity Injection Safety Tests ──────────────────────────────────

// Phrases that look like prompt injection or override attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all\s+|the\s+)instr/i,
  /disregar\w*\s+(previous|earlier|the\s+above)/i,
  /this\s+overrides?\s+(the\s+|all\s+|earlier|previous)/i,
  /you\s+must\s+actually/i,
  /actually\s+follow\s+this\s+instead/i,
  /override\s+the\s+above/i,
  /override\s+any\s+previous/i,
  /disregard\s+earlier\s+instructions/i
];

test("INTENSITY: declarative targets contain no injection-like phrases", () => {
  const declarativePaths = [
    ["Cursor init", "compiled/cursor/rules/00-init.mdc"],
    ["Cursor router", "compiled/cursor/rules/01-router.mdc"],
    ["Windsurf init", "compiled/windsurf/rules/00-init.md"],
    ["Windsurf router", "compiled/windsurf/rules/01-router.md"],
    ["Crush init", "compiled/crush/rules/00-init.md"],
    ["Crush router", "compiled/crush/rules/01-router.md"],
    ["Gemini init", "compiled/gemini/rules/00-init.md"],
    ["Gemini router", "compiled/gemini/rules/01-router.md"]
  ];

  for (const [name, artifactPath] of declarativePaths) {
    const content = artifacts.get(artifactPath);
    assert.ok(content, `${name} artifact must exist`);
    for (const pattern of INJECTION_PATTERNS) {
      const match = pattern.exec(content);
      assert.ok(
        !match,
        `${name} must not contain injection-like phrase matching ${pattern.source}: "${match?.[0]}"`
      );
    }
  }
});

test("INTENSITY: declarative targets use 'should' for logging mandate, not 'MUST'", () => {
  const declarativePaths = [
    "compiled/cursor/rules/00-init.mdc",
    "compiled/windsurf/rules/00-init.md",
    "compiled/crush/rules/00-init.md",
    "compiled/gemini/rules/00-init.md"
  ];

  for (const artifactPath of declarativePaths) {
    const content = artifacts.get(artifactPath);
    const name = artifactPath.split("/").pop();
    assert.ok(
      !content.includes("MUST Be Logged"),
      `${name} must not contain imperative logging heading`
    );
  }
});

test("INTENSITY: imperative targets do not leak injection-like override language", () => {
  const claudeInit = artifacts.get("compiled/claude/rules/00-init.md");
  const claudeRouter = artifacts.get("compiled/claude/rules/01-router.md");
  const codexAgents = artifacts.get("compiled/codex/AGENTS.md");

  for (const [name, content] of [["Claude init", claudeInit], ["Claude router", claudeRouter], ["Codex AGENTS", codexAgents]]) {
    assert.ok(content, `${name} artifact must exist`);
    for (const pattern of INJECTION_PATTERNS) {
      const match = pattern.exec(content);
      assert.ok(
        !match,
        `${name} must not contain injection-like phrase matching ${pattern.source}: "${match?.[0]}"`
      );
    }
  }
});

test("INTENSITY: declarative targets use 'take precedence' for constraints, not 'cannot override'", () => {
  // "take precedence" is the approved declarative phrasing for constraint hierarchy
  // "cannot override" is the imperative version that must not appear in constraint context
  const declarativePaths = [
    "compiled/cursor/rules/00-init.mdc",
    "compiled/windsurf/rules/00-init.md",
    "compiled/crush/rules/00-init.md",
    "compiled/gemini/rules/00-init.md"
  ];

  for (const artifactPath of declarativePaths) {
    const content = artifacts.get(artifactPath);
    const name = artifactPath.split("/").pop();
    assert.ok(
      !content.includes("An expert cannot override"),
      `${name} must not contain imperative 'cannot override' in constraint context`
    );
    assert.ok(
      !content.includes("supersede any individual expert stance"),
      `${name} must not contain imperative 'supersede' in constraint context`
    );
    assert.ok(
      content.includes("Higher-layer rules take precedence"),
      `${name} must use declarative 'take precedence' phrasing`
    );
  }
});
