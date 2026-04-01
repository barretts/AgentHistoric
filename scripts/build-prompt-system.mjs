#!/usr/bin/env node

import path from "node:path";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import { loadPromptSystemSpec, writeTextFile } from "./lib/prompt-system.mjs";

const workspaceRoot = process.cwd();
const debug = process.argv.includes("--debug");
const scaffolded = process.argv.includes("--scaffolded");
const ablationIdx = process.argv.indexOf("--ablation");
const ablation = ablationIdx !== -1 ? process.argv[ablationIdx + 1] : null;
const spec = await loadPromptSystemSpec(workspaceRoot);

await writeGeneratedArtifacts();

const flags = [
  debug && "debug mode",
  scaffolded && "scaffolded voice",
  ablation && `ablation: ${ablation}`
].filter(Boolean);
console.log(
  `Generated prompt bundles (rich + sparse) from ${path.join("prompt-system", "/")}${flags.length ? ` [${flags.join(", ")}]` : ""}`
);

async function writeGeneratedArtifacts() {
  for (const [relativePath, content] of generateArtifacts(spec, { debug, scaffolded, ablation })) {
    await writeTextFile(path.join(workspaceRoot, relativePath), content);
  }
}
