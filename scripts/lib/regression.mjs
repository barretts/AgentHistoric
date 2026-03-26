import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

export async function loadRegressionFixtures(workspaceRoot) {
  const raw = await readFile(
    path.join(workspaceRoot, "regression", "fixtures", "cases.json"),
    "utf8"
  );
  return JSON.parse(raw);
}

export function selectCases(fixtures, { suite = "full", targets, caseIds = [] }) {
  const suiteIds = new Set(fixtures.suites[suite] || []);
  const requestedCases = new Set(caseIds);
  return fixtures.cases.filter((testCase) => {
    const inSuite = suiteIds.has(testCase.id);
    const inRequestedCases = requestedCases.size === 0 || requestedCases.has(testCase.id);
    const inTarget = !targets.length
      || targets.some((target) => testCase.targets.includes(target));
    return inSuite && inRequestedCases && inTarget;
  });
}

export function parseArgs(argv) {
  const options = {
    suite: "full",
    targets: ["cursor", "codex"],
    modelByTarget: {
      cursor: "gpt-5.4-medium",
      codex: null
    },
    caseIds: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--suite") {
      options.suite = argv[index + 1];
      index += 1;
    } else if (arg === "--targets") {
      options.targets = argv[index + 1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    } else if (arg === "--cursor-model") {
      options.modelByTarget.cursor = argv[index + 1];
      index += 1;
    } else if (arg === "--codex-model") {
      options.modelByTarget.codex = argv[index + 1];
      index += 1;
    } else if (arg === "--case") {
      options.caseIds = argv[index + 1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return options;
}

export function createTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function ensureLogsDirectory(workspaceRoot) {
  const logDir = path.join(workspaceRoot, ".logs");
  await mkdir(logDir, { recursive: true });
  return logDir;
}

export function buildWrappedPrompt(testCase) {
  const requiredHeadings = expectedResponseSections(testCase);

  return [
    "You are being evaluated by an automated regression harness.",
    "Follow the local project instructions exactly.",
    "Do not inspect files, do not use tools, and do not propose edits.",
    "Answer the user request directly, but return JSON only.",
    "The JSON object must contain exactly these keys:",
    "routingDecision, activeExpert, handoffs, outputSections, confidenceLabeled, personaBlend, domainStayedInScope, summary, response.",
    "Use canonical expert ids like expert-engineer-quinn, not skill paths.",
    "Include routingDecision.domain as a short domain label.",
    "Set routingDecision.selectedExpert to the primary expert you chose.",
    "Set activeExpert to the expert currently producing the answer.",
    "Set handoffs to an array of named expert ids if you explicitly handed off, otherwise [].",
    "Set outputSections to the ordered section headings you actually used in the response, or ['Answer'] when you lead directly with an answer.",
    "If the prompt lacks enough concrete implementation context, preserve the selected expert structure anyway and use the sections to explain what is missing.",
    "Do not invent alternate headings like Missing Context, Assessment, Pattern, or Possible Designs unless they are part of the required headings.",
    `Use these exact response headings for this case when they apply: ${requiredHeadings.join(", ")}.`,
    "Keep missing-context discussion inside those headings instead of adding new sections.",
    "If the request mixes domains, prefer the expert with the highest impact on correctness and foundations.",
    "If the request asks whether something should be built and only secondarily mentions UX or friendliness, treat that as an architecture-first decision rather than exploratory ideation.",
    "If the request explicitly asks for multiple options, drafts, or redesign alternatives, keep ideation primary unless it also asks for concrete architecture artifacts such as schemas, trust boundaries, or system contracts.",
    "Set confidenceLabeled to true only if the response clearly states confidence or VERIFIED/HYPOTHESIS style uncertainty.",
    "Set personaBlend to true only if you mixed expert styles without an explicit handoff.",
    "Set domainStayedInScope to true only if the answer stayed within the user's requested domain.",
    "Set summary to a one-sentence description of the routing choice.",
    "Set response to the exact user-facing answer body you would give.",
    `User prompt: ${testCase.prompt}`
  ].join("\n");
}

export function expectedResponseSections(testCase) {
  return [
    "Selected Expert",
    "Reason",
    "Confidence",
    ...testCase.expectedSections
  ];
}

export async function runCommandLogged({
  command,
  args,
  stdinText,
  outputPath,
  workingDirectory
}) {
  await mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workingDirectory,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let combinedOutput = "";

    child.stdout.on("data", (chunk) => {
      combinedOutput += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      combinedOutput += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", async (code) => {
      try {
        await writeFile(outputPath, combinedOutput, "utf8");
        resolve({ code, combinedOutput });
      } catch (error) {
        reject(error);
      }
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }

    child.stdin.end();
  });
}

export function parseAgentCliResult(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);
  const envelope = JSON.parse(lastLine);
  return JSON.parse(envelope.result);
}

export function parseCodexJsonlResult(rawText) {
  const events = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));

  const agentMessage = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === "item.completed" && event.item?.type === "agent_message"
    );

  if (!agentMessage) {
    throw new Error("Could not find agent_message event in Codex output.");
  }

  return JSON.parse(agentMessage.item.text);
}

export function scoreCase(testCase, response) {
  const selectedExpert = normalizeExpertId(
    response.routingDecision?.selectedExpert || response.activeExpert || ""
  );
  const sectionSet = new Set((response.outputSections || []).map(normalizeText));
  const expectedSections = (testCase.expectedSections || []).map(normalizeText);
  const missingSections = expectedSections.filter(
    (section) => !sectionSet.has(section)
  );
  const unexpectedBlend = Boolean(response.personaBlend);
  const wrongExpert = selectedExpert !== testCase.expectedPrimaryExpert;
  const stayedInScope = Boolean(response.domainStayedInScope);
  const confidenceLabeled = Boolean(response.confidenceLabeled);

  let score = 2;
  const failures = [];

  if (wrongExpert || missingSections.length > 0) {
    score = 0;
  }

  if (!stayedInScope || unexpectedBlend || !confidenceLabeled) {
    score = Math.min(score, 1);
  }

  if (wrongExpert) {
    failures.push(
      `Expected expert ${testCase.expectedPrimaryExpert} but got ${selectedExpert || "none"}.`
    );
  }

  if (missingSections.length > 0) {
    failures.push(`Missing sections: ${missingSections.join(", ")}.`);
  }

  if (unexpectedBlend) {
    failures.push("Undeclared persona blending detected.");
  }

  if (!stayedInScope) {
    failures.push("Response drifted outside the requested domain.");
  }

  if (!confidenceLabeled) {
    failures.push("Confidence or uncertainty labeling missing.");
  }

  return {
    score,
    selectedExpert,
    formatCompliance: missingSections.length === 0,
    verificationQuality: confidenceLabeled,
    confidenceLabeling: confidenceLabeled,
    notableDrift: failures,
    missingSections
  };
}

export function compareTargets(resultsByTarget) {
  const cursor = resultsByTarget.cursor;
  const codex = resultsByTarget.codex;

  if (!cursor || !codex) {
    return null;
  }

  const deltas = [];

  if (cursor.score.selectedExpert !== codex.score.selectedExpert) {
    deltas.push("expert mismatch");
  }

  if (!sameNormalizedSectionSet(
    cursor.response.outputSections,
    codex.response.outputSections
  )) {
    deltas.push("section mismatch");
  }

  if (cursor.response.confidenceLabeled !== codex.response.confidenceLabeled) {
    deltas.push("confidence labeling mismatch");
  }

  if (cursor.response.personaBlend !== codex.response.personaBlend) {
    deltas.push("persona blending mismatch");
  }

  return {
    equivalent: deltas.length === 0,
    deltas
  };
}

export function formatSummary(run) {
  const lines = [];

  lines.push(`# Regression Run`);
  lines.push("");
  lines.push(`- Suite: ${run.suite}`);
  lines.push(`- Targets: ${run.targets.join(", ")}`);
  lines.push(`- Timestamp: ${run.timestamp}`);
  lines.push(`- Cases: ${run.caseCount}`);
  lines.push("");

  for (const result of run.results) {
    lines.push(
      `- ${result.caseId} [${result.target}] score=${result.score.score} expert=${result.score.selectedExpert || "unknown"}`
    );
    if (result.score.notableDrift.length > 0) {
      lines.push(`  drift: ${result.score.notableDrift.join(" | ")}`);
    }
  }

  if (run.parity.length > 0) {
    lines.push("");
    lines.push("## Parity");
    for (const entry of run.parity) {
      lines.push(
        `- ${entry.caseId}: ${entry.equivalent ? "equivalent" : entry.deltas.join(", ")}`
      );
    }
  }

  return lines.join("\n") + "\n";
}

function normalizeText(value) {
  return String(value).trim().toLowerCase();
}

function sameNormalizedSectionSet(left, right) {
  const leftSet = [...new Set((left || []).map(normalizeText))].sort();
  const rightSet = [...new Set((right || []).map(normalizeText))].sort();
  return JSON.stringify(leftSet) === JSON.stringify(rightSet);
}

function normalizeExpertId(value) {
  return String(value)
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^skills\//, "");
}
