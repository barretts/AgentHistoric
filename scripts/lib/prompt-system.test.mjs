import test from "node:test";
import assert from "node:assert/strict";

import { resolveRequiredSections } from "./prompt-system.mjs";

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
