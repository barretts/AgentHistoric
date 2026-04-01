import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { resolveRequiredSections } from "./prompt-system.mjs";

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
    "Use canonical expert ids like expert-engineer-peirce, not skill paths.",
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

export function routePrompt(system, prompt) {
  const text = normalizeText(prompt);

  if (matchesAny(text, system.router.disambiguation.routeToPopper)) {
    return "expert-qa-popper";
  }

  if (matchesAny(text, system.router.disambiguation.routeToPeirce)) {
    return "expert-engineer-peirce";
  }

  if (matchesAny(text, system.router.disambiguation.routeToDennett)) {
    return "expert-visionary-dennett";
  }

  if (
    text.includes("feels confusing")
    || text.includes("improve the flow")
    || text.includes("users keep misclicking")
    || text.includes("modal")
  ) {
    return "expert-ux-rogers";
  }

  if (text.includes("three different ways")) {
    return "expert-visionary-dennett";
  }

  if (text.includes("reusable pattern") || text.includes("keep hitting the same bug")) {
    return "expert-manager-blackmore";
  }

  if (text.includes("capture the lesson")) {
    return "expert-manager-blackmore";
  }

  if (text.includes("should we build this")) {
    return "expert-architect-descartes";
  }

  if (text.includes("design the system")) {
    return "expert-architect-descartes";
  }

  const orderedHeuristics = [...system.router.routingHeuristics].sort(
    (left, right) => left.priority - right.priority
  );

  for (const heuristic of orderedHeuristics) {
    if (matchesAny(text, heuristic.signals)) {
      return heuristic.experts[0];
    }
  }

  return "expert-engineer-peirce";
}

export function evaluateResponse(system, testCase, response) {
  const responseText = String(response.response || "").trim();
  const explicitSelection = extractSelection(responseText);
  const selectedExpert = normalizeExpertId(
    explicitSelection
      || response.routingDecision?.selectedExpert
      || response.activeExpert
      || ""
  );
  const expectedSections = resolveExpectedSections(system, testCase);
  const outputSections = (response.outputSections || []).map(normalizeText);
  const missingSections = expectedSections.filter(
    (section) => !sectionPresent(section, responseText, outputSections)
  );
  const confidenceLabeled =
    Boolean(response.confidenceLabeled)
    || /(\bVERIFIED\b|\bHYPOTHESIS\b|\bconfidence\b)/i.test(responseText);
  const unexpectedBlend =
    Boolean(response.personaBlend)
    || hasForbiddenExpertHeadings(system, testCase, responseText);
  const stayedInScope = Boolean(response.domainStayedInScope);
  const invalidHandoffs = (response.handoffs || []).filter(
    (handoff) => !testCase.allowedHandoffs.includes(normalizeExpertId(handoff))
  );
  const findings = [];

  if (!selectedExpert) {
    findings.push("Missing explicit selected expert.");
  } else if (selectedExpert !== normalizeExpertId(testCase.expectedPrimaryExpert)) {
    findings.push(
      `Expected expert ${testCase.expectedPrimaryExpert} but got ${selectedExpert}.`
    );
  }

  if (missingSections.length > 0) {
    findings.push(`Missing sections: ${missingSections.join(", ")}.`);
  }

  if (unexpectedBlend) {
    findings.push("Undeclared persona blending detected.");
  }

  if (!stayedInScope) {
    findings.push("Response drifted outside the requested domain.");
  }

  if (!confidenceLabeled) {
    findings.push("Confidence or uncertainty labeling missing.");
  }

  if (invalidHandoffs.length > 0) {
    findings.push(`Invalid handoffs: ${invalidHandoffs.join(", ")}.`);
  }

  const behavioralFindings = [];
  const assertions = testCase.behavioralAssertions || [];

  const assertionMap = {
    noGoldPlating: () => assertNoGoldPlating(response, testCase),
    concision: () => assertConcision(response),
    noFalseClaims: () => assertNoFalseClaims(response),
    diagnosticDiscipline: () => assertDiagnosticDiscipline(response)
  };

  for (const name of assertions) {
    const fn = assertionMap[name];
    if (fn) {
      const result = fn();
      if (!result.pass) {
        behavioralFindings.push(result.finding);
      }
    }
  }

  const routingMatch =
    selectedExpert === normalizeExpertId(testCase.expectedPrimaryExpert);
  const hasBehavioralIssues = behavioralFindings.length > 0;
  const score =
    findings.length === 0 && !hasBehavioralIssues
      ? 2
      : routingMatch
        ? 1
        : 0;

  return {
    score,
    selectedExpert,
    formatCompliance: missingSections.length === 0,
    verificationQuality: confidenceLabeled,
    confidenceLabeling: confidenceLabeled,
    notableDrift: findings,
    behavioralFindings,
    missingSections,
    routingMatch,
    invalidHandoffs,
    stayedInScope,
    personaBlend: unexpectedBlend
  };
}

export function scoreCase(system, testCase, response) {
  return evaluateResponse(system, testCase, response);
}

// ── Behavioral Assertion Helpers ──────────────────────────────────

export function assertNoGoldPlating(response, testCase) {
  const responseText = String(response.response || "");
  const expectedSections = new Set(
    (testCase.expectedSections || []).map((s) => s.toLowerCase())
  );
  const allowedHandoffs = new Set(
    (testCase.allowedHandoffs || []).map((h) => h.toLowerCase())
  );

  const headingPattern = /^#{1,4}\s+(.+)$/gm;
  const extraSections = [];
  let match;

  while ((match = headingPattern.exec(responseText)) !== null) {
    const heading = match[1].trim().toLowerCase();
    if (
      heading === "selected expert" ||
      heading === "reason" ||
      heading === "confidence"
    ) {
      continue;
    }
    if (!expectedSections.has(heading) && !allowedHandoffs.has(heading)) {
      extraSections.push(match[1].trim());
    }
  }

  if (extraSections.length > 0) {
    return {
      pass: false,
      finding: `Gold-plating: ${extraSections.length} unexpected section(s): ${extraSections.join(", ")}`
    };
  }

  return { pass: true, finding: "" };
}

export function assertConcision(response, maxChars = 4000) {
  const responseText = String(response.response || "");
  if (responseText.length > maxChars) {
    return {
      pass: false,
      finding: `Concision: response is ${responseText.length} chars (max ${maxChars})`
    };
  }
  return { pass: true, finding: "" };
}

export function assertNoFalseClaims(response) {
  const responseText = String(response.response || "");
  const patterns = [
    {
      pattern: /\ball tests pass\b/i,
      claim: "'all tests pass' without evidence of running tests"
    },
    {
      pattern: /\bsuccessfully (?:ran|executed|completed)\b/i,
      claim: "claims successful execution"
    },
    {
      pattern: /\bno (?:issues?|problems?|errors?) (?:found|detected|observed)\b/i,
      claim: "'no issues found' without investigation evidence"
    }
  ];

  const hasToolEvidence =
    /(?:```|output:|log:|result:|ran |executed |\$ )/i.test(responseText);

  if (hasToolEvidence) {
    return { pass: true, finding: "" };
  }

  for (const { pattern, claim } of patterns) {
    if (pattern.test(responseText)) {
      return {
        pass: false,
        finding: `False claim: ${claim}`
      };
    }
  }

  return { pass: true, finding: "" };
}

export function assertDiagnosticDiscipline(response) {
  const responseText = String(response.response || "");

  const diagnosisPatterns = [
    /\bread(?:ing)?\s+(?:the|this)\s+(?:error|stack|log|output|file|code)/i,
    /\b(?:error|stack trace|exception|log)\s*(?:shows?|says?|indicates?|reveals?)/i,
    /\broot cause\b/i,
    /\bhypothesis\b/i,
    /\bbecause\b.*\b(?:fails?|errors?|throws?|breaks?)\b/i,
    /\binvestigat/i
  ];

  const fixPatterns = [
    /\b(?:fix|solution|change|replace|update|modify|add|remove)\b/i
  ];

  const hasDiagnosis = diagnosisPatterns.some((p) => p.test(responseText));
  const hasFix = fixPatterns.some((p) => p.test(responseText));

  if (hasFix && !hasDiagnosis) {
    return {
      pass: false,
      finding: "Diagnostic discipline: proposed a fix without evidence of diagnosis"
    };
  }

  return { pass: true, finding: "" };
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

function matchesAny(text, candidates) {
  return candidates.some((candidate) => text.includes(normalizeText(candidate)));
}

function resolveExpectedSections(system, testCase) {
  if (Array.isArray(testCase.expectedSections) && testCase.expectedSections.length > 0) {
    return testCase.expectedSections.map(normalizeText);
  }

  const expert = system.experts.find(
    (item) => normalizeExpertId(item.id) === normalizeExpertId(testCase.expectedPrimaryExpert)
  );

  if (!expert) {
    return [];
  }

  const { defaultSections } = resolveRequiredSections(expert.requiredSections || {});
  return defaultSections.map(normalizeText);
}

function sectionPresent(section, responseText, outputSections) {
  if (section === "answer") {
    return outputSections.includes("answer") || Boolean(responseText.trim());
  }

  if (outputSections.includes(section)) {
    return true;
  }

  const pattern = new RegExp(
    `^\\s*(?:#+\\s*)?${escapeRegex(section)}(?=\\s*:|\\s*$)`,
    "im"
  );
  return pattern.test(responseText);
}

function extractExplicitSectionHeadings(system, responseText) {
  const knownSections = new Set([
    "selected expert",
    "selected skill",
    "selected subfolder",
    "reason",
    "confidence",
    ...system.experts.flatMap((expert) => {
      const { defaultSections, complexSections } = resolveRequiredSections(
        expert.requiredSections || {}
      );
      return [...defaultSections, ...complexSections].map(normalizeText);
    })
  ]);

  const headings = new Set();
  const lines = String(responseText || "").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const withoutMarkdown = trimmed
      .replace(/^#+\s*/, "")
      .replace(/^[-*]\s+/, "")
      .replace(/^\*\*(.+)\*\*$/, "$1")
      .replace(/^`(.+)`$/, "$1");
    const exact = normalizeText(withoutMarkdown);
    const colonOnly = normalizeText(withoutMarkdown.replace(/:\s*$/, ""));

    if (knownSections.has(exact)) {
      headings.add(exact);
      continue;
    }

    if (knownSections.has(colonOnly) && /:\s*$/.test(withoutMarkdown)) {
      headings.add(colonOnly);
    }
  }

  return headings;
}

function hasForbiddenExpertHeadings(system, testCase, responseText) {
  const allowedExperts = new Set(
    [testCase.expectedPrimaryExpert, ...(testCase.allowedHandoffs || [])].map(normalizeExpertId)
  );
  const explicitHeadings = extractExplicitSectionHeadings(system, responseText);
  const allowedSections = new Set(
    system.experts.flatMap((expert) => {
      if (!allowedExperts.has(normalizeExpertId(expert.id))) {
        return [];
      }

      const { defaultSections, complexSections } = resolveRequiredSections(
        expert.requiredSections || {}
      );
      return [...defaultSections, ...complexSections].map(normalizeText);
    })
  );

  return system.experts.some((expert) => {
    if (allowedExperts.has(normalizeExpertId(expert.id))) {
      return false;
    }

    const { defaultSections, complexSections } = resolveRequiredSections(
      expert.requiredSections || {}
    );
    const forbiddenSections = [...new Set([...defaultSections, ...complexSections])]
      .map(normalizeText)
      .filter((section) => section !== "answer" && !allowedSections.has(section));

    return forbiddenSections.some((section) => explicitHeadings.has(section));
  });
}

function extractSelection(responseText) {
  const patterns = [
    /^\s*Selected Expert\s*:\s*(.+?)\s*$/im,
    /^\s*Selected Skill\s*:\s*(.+?)\s*$/im,
    /^\s*-\s*Selected Expert\s*:\s*(.+?)\s*$/im
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(responseText);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function sameNormalizedSectionSet(left, right) {
  const leftSet = [...new Set((left || []).map(normalizeText))].sort();
  const rightSet = [...new Set((right || []).map(normalizeText))].sort();
  return JSON.stringify(leftSet) === JSON.stringify(rightSet);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeExpertId(value) {
  return String(value)
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^skills\//, "");
}
