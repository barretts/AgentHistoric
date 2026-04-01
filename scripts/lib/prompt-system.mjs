import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function loadPromptSystemSpec(workspaceRoot) {
  const baseDir = path.join(workspaceRoot, "prompt-system");

  const system = await loadJson(path.join(baseDir, "system.json"));
  system.router = await loadJson(path.join(baseDir, "router.json"));

  const expertsDir = path.join(baseDir, "experts");
  const entries = await readdir(expertsDir);
  const expertFiles = entries.filter((f) => f.endsWith(".json")).sort();
  system.experts = await Promise.all(
    expertFiles.map((f) => loadJson(path.join(expertsDir, f)))
  );

  return system;
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function ensureDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeTextFile(filePath, contents) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, contents, "utf8");
}

export function fileHeader(comment) {
  return "";
}

export function toHeadingList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderCursorFrontmatter({ description, alwaysApply = true }) {
  return [
    "---",
    `description: "${escapeDoubleQuotes(description)}"`,
    `alwaysApply: ${alwaysApply ? "true" : "false"}`,
    "---",
    ""
  ].join("\n");
}

export function renderMdFrontmatter({ trigger, description }) {
  return [
    "---",
    `trigger: ${trigger}`,
    `description: "${escapeDoubleQuotes(description)}"`,
    "---",
    ""
  ].join("\n");
}

export function renderSkillFrontmatter({ name, description }) {
  return [
    "---",
    `name: "${escapeDoubleQuotes(name)}"`,
    `description: "${escapeDoubleQuotes(description)}"`,
    "---",
    ""
  ].join("\n");
}

export function humanizeExpertId(expertId) {
  return expertId
    .replace(/^expert-/, "")
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function escapeDoubleQuotes(value) {
  return String(value).replace(/"/g, '\\"');
}

export function codeFence(block, language = "") {
  return `\`\`\`${language}\n${block}\n\`\`\``;
}

// ── Voice Calibration Constants ──────────────────────────────────────

export const VOICE_CALIBRATION = [
  "The output contract defines WHAT sections to produce. This section defines HOW to write within them.",
  'Integrate reasoning naturally into prose. Do not prefix claims with labels like "HYPOTHESIS:" or "VERIFIED:" unless the output contract explicitly demands them.',
  "Use the required section headings, but write within each section as a thoughtful peer explaining their thinking — not as a system presenting a framework.",
  "Avoid sounding like a checklist, report template, or method exposition. The structure is for the reader's navigation, not the model's reasoning display."
];

export const SCAFFOLDED_VOICE = [
  "The output contract defines WHAT sections to produce. This section defines HOW to write within them.",
  "Externalize your reasoning process. Prefix every assumption with its epistemic status: `HYPOTHESIS (~N%)` for unverified claims, `VERIFIED` for claims backed by tests or documentation.",
  "Show confidence intervals on all non-trivial claims. Example: \"~80% confidence; verify by running X.\"",
  "Structure output as a formal report with labeled reasoning steps, not conversational prose. Each section should read as a structured analysis, not a peer conversation.",
  "Use explicit scaffolding: numbered assumptions, categorized failure modes, tabular summaries. The structure is the model's reasoning display for the reader's audit."
];

export function resolveRequiredSections(requiredSections) {
  const defaultSections =
    requiredSections.default || requiredSections.simple || [];
  const complexSections = requiredSections.complex || defaultSections;

  return {
    defaultSections,
    complexSections
  };
}
