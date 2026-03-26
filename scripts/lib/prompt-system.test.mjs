import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { generateArtifacts } from "./build-prompt-system.mjs";
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
