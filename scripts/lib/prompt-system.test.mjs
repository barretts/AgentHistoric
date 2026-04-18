import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { generateArtifacts, applyVariableSubstitution } from "./build-prompt-system.mjs";
import { loadPromptSystemSpec, resolveRequiredSections } from "./prompt-system.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

test("resolveRequiredSections prefers default sections", () => {
  const result = resolveRequiredSections({
    default: ["A", "B"],
    simple: ["S"],
    complex: ["C"]
  });

  assert.deepEqual(result, {
    defaultSections: ["A", "B"],
    complexSections: ["C"]
  });
});

test("resolveRequiredSections falls back to simple sections", () => {
  const result = resolveRequiredSections({
    simple: ["S1", "S2"]
  });

  assert.deepEqual(result, {
    defaultSections: ["S1", "S2"],
    complexSections: ["S1", "S2"]
  });
});

test("resolveRequiredSections uses an empty fallback when nothing is defined", () => {
  const result = resolveRequiredSections({});

  assert.deepEqual(result, {
    defaultSections: [],
    complexSections: []
  });
});

test("generated artifacts stay in sync with the repository outputs", async () => {
  const system = await loadPromptSystemSpec(workspaceRoot);
  const artifacts = generateArtifacts(system);

  for (const [relativePath, expectedContent] of artifacts) {
    const actualContent = await readFile(
      path.join(workspaceRoot, relativePath),
      "utf8"
    );
    assert.strictEqual(
      actualContent,
      expectedContent,
      `${relativePath} is out of sync with the generator`
    );
  }
});

// ── Variable Substitution Tests ─────────────────────────────────────

test("applyVariableSubstitution returns content unchanged when VS is disabled", () => {
  const content = "Hello {{EXPERT_ROSTER}} world";
  const system = { experts: [{ id: "expert-engineer-peirce" }] };
  const result = applyVariableSubstitution(content, system, { vsEnabled: false });
  assert.strictEqual(result, content);
});

test("applyVariableSubstitution replaces valid variables", () => {
  const content = "Experts: {{EXPERT_ROSTER}}";
  const system = {
    experts: [
      { id: "expert-engineer-peirce", summary: "Implementation lead" },
      { id: "expert-qa-popper", summary: "QA specialist" }
    ]
  };
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.ok(result.includes("## 7. Swarm Registry"));
  assert.ok(result.includes("expert-engineer-peirce"));
  assert.ok(result.includes("expert-qa-popper"));
});

test("applyVariableSubstitution replaces EXPERT_ID_ALLOWLIST", () => {
  const content = "Allowed: {{EXPERT_ID_ALLOWLIST}}";
  const system = {
    experts: [{ id: "expert-abstractions-liskov" }, { id: "expert-architect-descartes" }]
  };
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.strictEqual(result, "Allowed: expert-abstractions-liskov, expert-architect-descartes");
});

test("applyVariableSubstitution replaces CONSTRAINT_HIERARCHY_LAYERS", () => {
  const content = "Layers: {{CONSTRAINT_HIERARCHY_LAYERS}}";
  const system = {
    constraintHierarchy: {
      layers: [
        { name: "Global Runtime", source: "system.json", scope: "All experts" },
        { name: "Router", source: "router.json", scope: "Routing decisions" }
      ]
    }
  };
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.ok(result.includes("Global Runtime"));
  assert.ok(result.includes("Router"));
});

test("applyVariableSubstitution replaces VERIFICATION_WORKFLOW_STEPS", () => {
  const content = "Steps: {{VERIFICATION_WORKFLOW_STEPS}}";
  const system = {};
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.strictEqual(result, "Steps: 1. build:prompts 2. test:unit 3. test:regressions:smoke");
});

test("applyVariableSubstitution throws in strict mode for unresolved variables", () => {
  const content = "Missing: {{UNKNOWN_VAR}}";
  const system = { experts: [] };
  assert.throws(
    () => applyVariableSubstitution(content, system, { vsEnabled: true, vsStrict: true }),
    /Unresolved VS variables/
  );
});

test("applyVariableSubstitution warns but does not throw in non-strict mode for unresolved variables", () => {
  const content = "Missing: {{UNKNOWN_VAR}}";
  const system = { experts: [] };
  // Should not throw, variable remains in place
  const result = applyVariableSubstitution(content, system, { vsEnabled: true, vsStrict: false });
  assert.strictEqual(result, "Missing: {{UNKNOWN_VAR}}");
});

test("applyVariableSubstitution handles multiple variables in one content", () => {
  const content = "{{EXPERT_ROSTER}} and {{VERIFICATION_WORKFLOW_STEPS}}";
  const system = {
    experts: [{ id: "expert-engineer-peirce" }]
  };
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.ok(result.includes("expert-engineer-peirce"));
  assert.ok(result.includes("build:prompts"));
});

test("EXPERT_ROSTER variable produces formatted markdown with Swarm Registry heading", () => {
  const content = "{{EXPERT_ROSTER}}";
  const system = {
    experts: [{ id: "expert-engineer-peirce", summary: "Implementation lead" }]
  };
  const result = applyVariableSubstitution(content, system, { vsEnabled: true });
  assert.ok(result.includes("## 7. Swarm Registry"));
  assert.ok(result.includes("* **expert-engineer-peirce:** Implementation lead"));
});
