#!/usr/bin/env node

import path from "node:path";
import { generateArtifacts } from "./lib/build-prompt-system.mjs";
import { loadPromptSystemSpec, writeTextFile } from "./lib/prompt-system.mjs";

const workspaceRoot = process.cwd();
// Default to release mode so committed artifacts match the sync-test baseline.
// Opt into debug mode explicitly with --debug. --no-debug remains a harmless no-op.
const debug = process.argv.includes("--debug") && !process.argv.includes("--no-debug");
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
  `Generated prompt bundles from ${path.join("prompt-system", "/")}${flags.length ? ` [${flags.join(", ")}]` : ""}`
);

async function writeGeneratedArtifacts() {
  for (const [relativePath, content] of generateArtifacts(spec, { debug, scaffolded, ablation })) {
    await writeTextFile(path.join(workspaceRoot, relativePath), content);
  }
}
