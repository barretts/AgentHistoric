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

export function resolveRequiredSections(requiredSections) {
  const defaultSections =
    requiredSections.default || requiredSections.simple || [];
  const complexSections = requiredSections.complex || defaultSections;

  return {
    defaultSections,
    complexSections
  };
}
