#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const targetPath = path.join(workspaceRoot, "regression", "fixtures", "cases.json");
const raw = await readFile(targetPath, "utf8");
const fixtures = JSON.parse(raw);

const philosophicalRubricByExpert = {
  "expert-qa-popper": "philosophical-popper-falsification",
  "expert-architect-descartes": "philosophical-descartes-doubt",
  "expert-ux-rogers": "philosophical-rogers-nonblame",
  "expert-information-shannon": "philosophical-shannon-signal-retention"
};

let changed = 0;
for (const testCase of fixtures.cases) {
  if (testCase.category !== "philosophical-steering") continue;

  const philosophicalRubric = philosophicalRubricByExpert[testCase.expectedPrimaryExpert];
  if (!philosophicalRubric) {
    throw new Error(`${testCase.id}: no philosophical rubric mapped for ${testCase.expectedPrimaryExpert}`);
  }

  const rubrics = new Set(testCase.judgeRubrics || []);
  rubrics.add("persona-stance-fidelity");
  rubrics.add(philosophicalRubric);
  const nextRubrics = ["persona-stance-fidelity", philosophicalRubric];

  if (JSON.stringify(testCase.judgeRubrics || []) !== JSON.stringify(nextRubrics)) {
    testCase.judgeRubrics = nextRubrics;
    changed += 1;
  }
}

const steeringCases = fixtures.cases.filter((testCase) => testCase.category === "philosophical-steering");
if (steeringCases.length !== 8) {
  throw new Error(`Expected 8 philosophical-steering cases, found ${steeringCases.length}`);
}

for (const testCase of steeringCases) {
  if (!testCase.judgeRubrics?.includes("persona-stance-fidelity")) {
    throw new Error(`${testCase.id}: missing persona-stance-fidelity`);
  }
  if (!testCase.judgeRubrics.some((id) => id.startsWith("philosophical-"))) {
    throw new Error(`${testCase.id}: missing philosophical rubric`);
  }
}

await writeFile(targetPath, JSON.stringify(fixtures, null, 2) + "\n", "utf8");
console.log(`Updated ${changed} philosophical-steering case(s).`);
