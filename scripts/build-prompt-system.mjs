#!/usr/bin/env node

import path from "node:path";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import { loadPromptSystemSpec, writeTextFile } from "./lib/prompt-system.mjs";

const workspaceRoot = process.cwd();
const debug = process.argv.includes("--debug");
const scaffolded = process.argv.includes("--scaffolded");
const spec = await loadPromptSystemSpec(workspaceRoot);

await writeGeneratedArtifacts();

console.log(
  `Generated prompt bundles (rich + sparse) from ${path.join("prompt-system", "/")}${debug ? " [debug mode]" : ""}${scaffolded ? " [scaffolded voice]" : ""}`
);

async function writeGeneratedArtifacts() {
  for (const [relativePath, content] of generateArtifacts(spec, { debug, scaffolded })) {
    await writeTextFile(path.join(workspaceRoot, relativePath), content);
  }
}
