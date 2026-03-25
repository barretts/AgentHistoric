import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWrappedPrompt,
  expectedResponseSections
} from "./regression.mjs";

test("expectedResponseSections prepends routing headings", () => {
  const sections = expectedResponseSections({
    expectedSections: ["Assumptions", "Failure Modes"]
  });

  assert.deepEqual(sections, [
    "Selected Expert",
    "Reason",
    "Confidence",
    "Assumptions",
    "Failure Modes"
  ]);
});

test("buildWrappedPrompt includes exact required headings guidance", () => {
  const prompt = buildWrappedPrompt({
    prompt: "Design the data model and trust boundaries for this feature.",
    expectedSections: ["Assumptions", "Failure Modes", "Fallbacks"]
  });

  assert.match(
    prompt,
    /Use these exact response headings for this case when they apply: Selected Expert, Reason, Confidence, Assumptions, Failure Modes, Fallbacks\./
  );
});
