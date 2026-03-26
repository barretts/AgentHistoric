#!/usr/bin/env node

import path from "node:path";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import { loadPromptSystemSpec, writeTextFile } from "./lib/prompt-system.mjs";

const workspaceRoot = process.cwd();
const spec = await loadPromptSystemSpec(workspaceRoot);

await writeGeneratedArtifacts();

console.log(
  `Generated prompt bundles (rich + sparse) from ${path.join("prompt-system", "/")}`
);

async function writeGeneratedArtifacts() {
  for (const [relativePath, content] of generateArtifacts(spec)) {
    await writeTextFile(path.join(workspaceRoot, relativePath), content);
  }
}
