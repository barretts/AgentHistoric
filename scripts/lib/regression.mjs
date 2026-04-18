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
    caseIds: [],
    trials: 1,
    parallel: 1,
    // --local routes each case through the synthetic routePrompt() heuristic
    // instead of a real LLM, producing a deterministic response envelope. Use
    // during development to exercise the ablation scaffolding (trial loop,
    // aggregation, report formatting) without spending real-LLM budget.
    local: false,
    // --seed N adds deterministic pseudo-noise to synthetic responses when
    // running in --local mode, so multi-trial stats are exercised instead of
    // collapsing to zero variance.
    seed: 0
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
    } else if (arg === "--trials") {
      options.trials = Math.max(1, parseInt(argv[index + 1], 10) || 1);
      index += 1;
    } else if (arg === "--parallel") {
      options.parallel = Math.max(1, parseInt(argv[index + 1], 10) || 1);
      index += 1;
    } else if (arg === "--local") {
      options.local = true;
    } else if (arg === "--seed") {
      options.seed = parseInt(argv[index + 1], 10) || 0;
      index += 1;
    } else if (arg === "--via-clr") {
      // Route real-LLM trials through the cli-runner-learner orchestrator
      // instead of spawning the agent CLI directly. Required for real-LLM
      // ablation runs because cli-runner-learner handles idle timeouts and
      // transcript extraction robustly, and because real ablation needs the
      // rendered artifacts installed to disk between conditions (handled by
      // the caller).
      options.viaClr = true;
    } else if (arg === "--sections") {
      // Comma-separated ablation-section ids. When set, run-ablation.mjs runs
      // only these sections instead of every entry in the ablation manifest.
      options.sectionFilter = argv[index + 1]
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
    "The response body itself must begin with Selected Expert, then Reason, then Confidence, before any other content.",
    "Do not add a preamble like 'I'll inspect the files' or 'First I will use a tool' before the routing headings.",
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

/**
 * Build a synthetic response envelope that mirrors the shape a real LLM would
 * produce, using the local routePrompt() heuristic instead of an LLM call.
 *
 * Used by --local mode in run-ablation.mjs and run-via-clr.mjs to exercise the
 * evaluation pipeline (scoreCase, trial aggregation, ablation report) without
 * spending real-LLM budget. The output is deterministic for a given (system,
 * testCase, trialIndex, seed) tuple.
 *
 * Because the local heuristic does not depend on rendered artifacts, ablation
 * deltas in --local mode will be near-zero. That is intentional: --local is a
 * development tool for verifying scaffolding, not for producing meaningful
 * ablation findings.
 *
 * @param {object} system - Loaded prompt system spec.
 * @param {object} testCase - Regression case.
 * @param {object} [opts]
 * @param {number} [opts.trialIndex] - Used for deterministic jitter across trials.
 * @param {number} [opts.seed] - Optional seed for reproducible variance.
 * @param {string} [opts.forcedExpert] - Override the routed expert (useful to
 *   simulate ablation effects by injecting mis-routing under a particular
 *   condition).
 * @returns {object} Response envelope compatible with evaluateResponse().
 */
export function buildLocalResponse(system, testCase, opts = {}) {
  const { trialIndex = 0, seed = 0, forcedExpert } = opts;
  const selectedExpert = forcedExpert || routePrompt(system, testCase.prompt);
  const sections = expectedResponseSections(testCase);

  // Deterministic pseudo-jitter: across trials, flip confidenceLabeled on/off
  // in a small, reproducible pattern so aggregation sees non-zero variance.
  const jitter = ((trialIndex + seed) * 2654435761) >>> 0; // Knuth's integer hash
  const confidenceLabeled = (jitter & 1) === 0 || trialIndex === 0;

  // Build a minimal response body that contains every expected heading so
  // missingSections is empty for well-routed cases. Uses the confidence tier
  // that evaluateResponse recognises.
  const lines = [
    `Selected Expert: ${selectedExpert}`,
    "",
    "Reason",
    "Local synthetic router selected this expert based on the router heuristic.",
    "",
    "Confidence",
    confidenceLabeled ? "HIGH (local heuristic)" : "(unstated)",
    ""
  ];
  for (const heading of testCase.expectedSections || []) {
    lines.push(heading);
    lines.push(`Local placeholder body for ${heading}.`);
    lines.push("");
  }

  return {
    routingDecision: {
      selectedExpert,
      domain: "local-synthetic"
    },
    activeExpert: selectedExpert,
    handoffs: [],
    outputSections: sections,
    confidenceLabeled,
    personaBlend: false,
    domainStayedInScope: true,
    summary: `Local synthetic route to ${selectedExpert}`,
    response: lines.join("\n")
  };
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
  let result = envelope.result;
  // Strip markdown code fences that the agent CLI sometimes wraps around JSON
  result = result.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  return JSON.parse(result);
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
  const router = system.router;

  // Phase 1: Disambiguation (explicit examples override heuristics)
  const disambiguationMap = {
    routeToPopper: "expert-qa-popper",
    routeToPeirce: "expert-engineer-peirce",
    routeToKnuth: "expert-performance-knuth",
    routeToLiskov: "expert-abstractions-liskov",
    routeToDijkstra: "expert-formal-dijkstra",
    routeToSimon: "expert-orchestrator-simon",
    routeToShannon: "expert-information-shannon",
    routeToDennett: "expert-visionary-dennett",
    routeToDescartes: "expert-architect-descartes"
  };

  for (const [key, expertId] of Object.entries(disambiguationMap)) {
    const examples = router.disambiguation[key];
    if (examples && matchesAny(text, examples)) {
      // Phase 1b: Check negative examples before confirming
      if (!isNegativeMatch(router.negativeExamples, expertId, text)) {
        return expertId;
      }
    }
  }

  // Phase 1c: Priority overrides for ambiguous signals
  // "fast fix" or "fix the null pointer" = implementation, not QA
  if (text.includes("fast fix") || text.includes("fix the null pointer")) {
    return "expert-engineer-peirce";
  }
  // "write a function" = implementation even if "edge cases" is mentioned
  if (text.includes("write a function")) {
    return "expert-engineer-peirce";
  }
  // "drop the" + "recreate" = destructive implementation, not architecture
  if (text.includes("drop the") && text.includes("recreate")) {
    return "expert-engineer-peirce";
  }
  // goroutines/synchronization = formal concurrency analysis
  if (text.includes("goroutine") || text.includes("no synchronization")) {
    return "expert-formal-dijkstra";
  }
  // "from multiple angles" or "event sourcing" with architecture context = Descartes
  if (text.includes("from multiple angles") || text.includes("second opinion")) {
    return "expert-architect-descartes";
  }

  // Phase 1d: Hard-coded UX/Blackmore signals not in disambiguation
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

  if (text.includes("reusable pattern") || text.includes("keep hitting the same bug") || text.includes("extract the pattern") || text.includes("same config mistake")) {
    return "expert-manager-blackmore";
  }

  if (text.includes("capture the lesson")) {
    return "expert-manager-blackmore";
  }

  // Phase 2: Heuristic signal matching with anti-triggers and boost signals
  const experimentFlags = router.experimentFlags || {};
  const useAntiTriggers = experimentFlags.antiTriggers !== false;
  const useBoostSignals = experimentFlags.boostSignals !== false;

  const orderedHeuristics = [...router.routingHeuristics].sort(
    (left, right) => left.priority - right.priority
  );

  // First pass: check for boost signal matches (these get priority)
  if (useBoostSignals) {
    for (const heuristic of orderedHeuristics) {
      if (heuristic.boostSignals && matchesAny(text, heuristic.boostSignals)) {
        const candidate = heuristic.experts[0];
        if (!isNegativeMatch(router.negativeExamples, candidate, text)) {
          return candidate;
        }
      }
    }
  }

  // Second pass: normal signal matching with anti-trigger filtering
  for (const heuristic of orderedHeuristics) {
    if (matchesAny(text, heuristic.signals)) {
      // Skip this heuristic if anti-triggers match
      if (useAntiTriggers && heuristic.antiTriggers && matchesAny(text, heuristic.antiTriggers)) {
        continue;
      }
      const candidate = heuristic.experts[0];
      if (!isNegativeMatch(router.negativeExamples, candidate, text)) {
        return candidate;
      }
      // If the lead expert is negatively matched, try the next expert in the list
      for (let i = 1; i < heuristic.experts.length; i++) {
        if (!isNegativeMatch(router.negativeExamples, heuristic.experts[i], text)) {
          return heuristic.experts[i];
        }
      }
      return candidate; // fallback to lead if all are negative-matched
    }
  }

  return "expert-engineer-peirce";
}

function isNegativeMatch(negativeExamples, expertId, text) {
  if (!negativeExamples) return false;

  const negativeKeyMap = {
    "expert-engineer-peirce": "doNotRouteToPeirce",
    "expert-qa-popper": "doNotRouteToPopper",
    "expert-visionary-dennett": "doNotRouteToDennett",
    "expert-architect-descartes": "doNotRouteToDescartes"
  };

  const key = negativeKeyMap[expertId];
  if (!key || !negativeExamples[key]) return false;

  // Negative examples are prose rules, not simple signal matches.
  // We check for key phrases within the negative rules that suggest
  // the current prompt context matches the anti-pattern.
  const rules = negativeExamples[key];
  for (const rule of rules) {
    const ruleLower = normalizeText(rule);
    // Extract the quoted condition patterns from the rule
    if (ruleLower.includes("'refactor' means redesigning") && text.includes("refactor") && (text.includes("module boundar") || text.includes("coupling") || text.includes("decouple"))) {
      return true;
    }
    if (ruleLower.includes("'implement' means 'design from scratch") && text.includes("implement") && (text.includes("from scratch") || text.includes("new service"))) {
      return true;
    }
    if (ruleLower.includes("'should we build this'") && text.includes("should we build this")) {
      return true;
    }
    if (ruleLower.includes("how should i write tests") && (text.includes("how should i write tests") || text.includes("how to structure tests"))) {
      return true;
    }
    if (ruleLower.includes("no existing failure to diagnose") && !text.includes("fail") && !text.includes("error") && !text.includes("broken") && !text.includes("bug")) {
      // Only apply this if the prompt doesn't mention any failure
      if (text.includes("write test") || text.includes("add test") || text.includes("test coverage")) {
        return true;
      }
    }
    if (ruleLower.includes("concrete implementation plan") && text.includes("plan") && (text.includes("steps") || text.includes("order") || text.includes("sequence"))) {
      return true;
    }
    if (ruleLower.includes("only one viable approach") && !text.includes("option") && !text.includes("alternative") && !text.includes("compare")) {
      // This is hard to detect locally; skip for now
    }
    // Descartes negative rules
    if (ruleLower.includes("callback contract") && (text.includes("callback contract") || text.includes("webhook") || text.includes("third-party integrators"))) {
      return true;
    }
    if (ruleLower.includes("build/config/import error") && (text.includes("build is broken") || text.includes("import error") || text.includes("config error") || text.includes("build error"))) {
      return true;
    }
    if (ruleLower.includes("memory leak requiring heap profiling") && (text.includes("memory leak") || text.includes("heap") || text.includes("allocations"))) {
      return true;
    }
    if (ruleLower.includes("phased implementation plan with gates and rollback") && text.includes("phases") && text.includes("rollback")) {
      return true;
    }
  }
  return false;
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

  const ambiguousSet = (testCase.ambiguousBetween || []).map(normalizeExpertId);

  if (!selectedExpert) {
    findings.push("Missing explicit selected expert.");
  } else if (selectedExpert !== normalizeExpertId(testCase.expectedPrimaryExpert)) {
    if (ambiguousSet.includes(selectedExpert)) {
      findings.push(
        `Acceptable alternate: expected ${testCase.expectedPrimaryExpert} but got ${selectedExpert} (in ambiguousBetween).`
      );
    } else {
      findings.push(
        `Expected expert ${testCase.expectedPrimaryExpert} but got ${selectedExpert}.`
      );
    }
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
    diagnosticDiscipline: () => assertDiagnosticDiscipline(response),
    routingFirst: () => assertRoutingFirst(response),
    dennettDraftLength: () => assertDennettDraftLength(response)
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
  const ambiguousMatch =
    !routingMatch && ambiguousSet.includes(selectedExpert);
  const hasBehavioralIssues = behavioralFindings.length > 0;
  const score =
    findings.length === 0 && !hasBehavioralIssues
      ? 2
      : routingMatch || ambiguousMatch
        ? 1
        : 0;

  const behavioralMetrics = computeBehavioralMetrics(response, testCase);

  return {
    score,
    selectedExpert,
    formatCompliance: missingSections.length === 0,
    verificationQuality: confidenceLabeled,
    confidenceLabeling: confidenceLabeled,
    notableDrift: findings,
    behavioralFindings,
    behavioralMetrics,
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

/**
 * Assert that Dennett's per-draft bodies respect the <=120-word numeric
 * anchor declared in `expert-visionary-dennett.json`. A soft cap of 150
 * tolerates minor over-runs; anything beyond that is flagged as draft bloat.
 *
 * Draft bodies are extracted between consecutive headings of the pattern
 * `Draft A|B|C|D|...` and up to (but not including) the next heading line
 * (`^#{1,4} ` or a bare `Draft X` / `Recommendation` line). Each draft's word
 * count is compared to maxWords; the finding lists all offenders.
 *
 * @param {object} response - Response envelope.
 * @param {number} [maxWords] - Soft ceiling per draft. Default 150 (120 target
 *   per the voice anchor, 30 words of tolerance before a failing finding).
 */
export function assertDennettDraftLength(response, maxWords = 150) {
  const text = String(response.response || "");
  // Match "Draft X" headings (Markdown `## Draft A`, bare `Draft A`, etc.).
  const headingRegex = /^(?:#{1,4}\s+)?(Draft\s+[A-Z][A-Za-z0-9]?)\s*:?\s*$/gm;
  const headings = [];
  let m;
  while ((m = headingRegex.exec(text)) !== null) {
    headings.push({ start: m.index, length: m[0].length, label: m[1] });
  }
  if (headings.length === 0) {
    return { pass: true, finding: "" };
  }

  // The next section boundary (after the last draft) is the Recommendation
  // heading or end-of-text. This regex captures either a Draft-style heading
  // or a Recommendation/Summary heading so we can terminate the last draft.
  const terminatorRegex = /^(?:#{1,4}\s+)?(?:Recommendation|Summary|Handoff|Next\s+Evaluator)\b/gmi;
  const terminators = [];
  while ((m = terminatorRegex.exec(text)) !== null) {
    terminators.push(m.index);
  }

  const offenders = [];
  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const bodyStart = current.start + current.length;
    const nextHeadingStart = i + 1 < headings.length ? headings[i + 1].start : Infinity;
    const nextTerminator = terminators.find((t) => t > bodyStart) ?? Infinity;
    const bodyEnd = Math.min(nextHeadingStart, nextTerminator, text.length);
    const body = text.slice(bodyStart, bodyEnd).trim();
    // Count whitespace-delimited tokens. Strip markdown-ish punctuation so a
    // dense bullet list doesn't inflate the count artificially.
    const wordCount = body.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
    if (wordCount > maxWords) {
      offenders.push(`${current.label}: ${wordCount} words`);
    }
  }

  if (offenders.length > 0) {
    return {
      pass: false,
      finding: `Draft length: ${offenders.length} draft(s) exceed ${maxWords} words (${offenders.join("; ")})`
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

export function assertRoutingFirst(response) {
  const responseText = String(response.response || "");
  const selectedMatch = responseText.match(/^\s*(?:#+\s*)?Selected Expert(?=\s*:|\s*$)/im);
  const reasonMatch = responseText.match(/^\s*(?:#+\s*)?Reason(?=\s*:|\s*$)/im);
  const confidenceMatch = responseText.match(/^\s*(?:#+\s*)?Confidence(?=\s*:|\s*$)/im);

  if (!selectedMatch || !reasonMatch || !confidenceMatch) {
    return {
      pass: false,
      finding: "Routing discipline: missing Selected Expert, Reason, or Confidence headings."
    };
  }

  const prefix = responseText.slice(0, selectedMatch.index).trim();
  if (prefix.length > 0) {
    return {
      pass: false,
      finding: "Routing discipline: response included preamble content before the routing decision."
    };
  }

  if (!(selectedMatch.index < reasonMatch.index && reasonMatch.index < confidenceMatch.index)) {
    return {
      pass: false,
      finding: "Routing discipline: Selected Expert, Reason, and Confidence must appear in that order."
    };
  }

  return { pass: true, finding: "" };
}

// ── Multi-Trial Runner ──────────────────────────────────────────────

export async function runTrials(runSingleTrial, { trials = 1, parallel = 1 }) {
  const results = [];

  for (let i = 0; i < trials; i += parallel) {
    const batch = [];
    for (let j = 0; j < parallel && i + j < trials; j++) {
      batch.push(runSingleTrial(i + j));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  return results;
}

export function aggregateTrialResults(trialResults) {
  const scores = trialResults.map((r) => r.score);
  const experts = trialResults.map((r) => r.selectedExpert);
  const expectedExpert = trialResults[0]?.expectedExpert;

  const passAtK = scores.some((s) => s === 2);
  const passHatK = scores.every((s) => s === 2);
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const routingConsistency = expectedExpert
    ? experts.filter((e) => e === expectedExpert).length / experts.length
    : null;

  const scoreDistribution = { 0: 0, 1: 0, 2: 0 };
  for (const s of scores) {
    scoreDistribution[s] = (scoreDistribution[s] || 0) + 1;
  }

  return {
    trials: trialResults.length,
    results: trialResults.map((r, i) => ({
      trialIndex: i,
      score: r.score,
      selectedExpert: r.selectedExpert
    })),
    passAtK,
    passHatK,
    meanScore: Math.round(meanScore * 100) / 100,
    routingConsistency: routingConsistency !== null
      ? Math.round(routingConsistency * 100) / 100
      : null,
    scoreDistribution
  };
}

// ── Behavioral Metrics ──────────────────────────────────────────────

export function computeBehavioralMetrics(response, testCase) {
  const responseText = String(response.response || "");
  const expectedSections = testCase.expectedSections || [];

  const headingPattern = /^#{1,4}\s+(.+)$/gm;
  let actualSectionCount = 0;
  let match;
  while ((match = headingPattern.exec(responseText)) !== null) {
    const heading = match[1].trim().toLowerCase();
    if (["selected expert", "reason", "confidence"].includes(heading)) continue;
    actualSectionCount++;
  }
  actualSectionCount = Math.max(actualSectionCount, 1);
  const overEngineering = Math.min(
    1.0,
    expectedSections.length / actualSectionCount
  );

  const isComplex = expectedSections.length >= 5;
  const referenceChars = isComplex ? 8000 : 2000;
  const concision = Math.min(
    1.0,
    responseText.length > 0 ? referenceChars / responseText.length : 1.0
  );

  return {
    overEngineering: Math.round(overEngineering * 100) / 100,
    concision: Math.round(concision * 100) / 100
  };
}

// ── Ablation Report ─────────────────────────────────────────────────

export function formatAblationReport(report) {
  const lines = [];

  lines.push("# Ablation Report");
  lines.push("");
  lines.push(`- Timestamp: ${report.timestamp}`);
  lines.push(`- Trials per condition: ${report.trialsPerCondition}`);
  lines.push("");
  lines.push("| Section | Chars Saved | pass^k Delta | Over-Engineering Delta | Concision Delta | Verdict |");
  lines.push("|---------|:----------:|:------------:|:---------------------:|:--------------:|:-------:|");

  for (const s of report.sections) {
    lines.push(
      `| ${s.id} | ${s.charsSaved} | ${formatDelta(s.passHatKDelta)} | ${formatDelta(s.overEngineeringDelta)} | ${formatDelta(s.concisionDelta)} | ${s.verdict} |`
    );
  }

  lines.push("");
  lines.push("## Verdict Legend");
  lines.push("");
  lines.push("- **KEEP:** Removing this section measurably worsens behavior. It earns its token cost.");
  lines.push("- **REVIEW:** No measurable impact detected. Candidate for rewriting or removal.");
  lines.push("- **REMOVE:** Removing this section measurably improves behavior. It may be counterproductive.");
  lines.push("");

  return lines.join("\n");
}

function formatDelta(value) {
  if (value === 0) return "+0.00";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
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
  const trialsPerCase = run.trialsPerCase || 1;

  lines.push(`# Regression Run`);
  lines.push("");
  lines.push(`- Suite: ${run.suite}`);
  lines.push(`- Targets: ${run.targets.join(", ")}`);
  lines.push(`- Timestamp: ${run.timestamp}`);
  lines.push(`- Cases: ${run.caseCount}`);
  if (trialsPerCase > 1) {
    lines.push(`- Trials per case: ${trialsPerCase}`);
  }
  lines.push("");

  if (trialsPerCase > 1 && run.aggregated) {
    lines.push("| Case | Target | pass@k | pass^k | Mean | Routing | Distribution |");
    lines.push("|------|--------|--------|--------|------|---------|-------------|");
    for (const agg of run.aggregated) {
      const dist = `0:${agg.scoreDistribution[0]} 1:${agg.scoreDistribution[1]} 2:${agg.scoreDistribution[2]}`;
      const routing = agg.routingConsistency !== null
        ? `${Math.round(agg.routingConsistency * 100)}%`
        : "N/A";
      lines.push(
        `| ${agg.caseId} | ${agg.target} | ${agg.passAtK ? "Y" : "N"} | ${agg.passHatK ? "Y" : "N"} | ${agg.meanScore} | ${routing} | ${dist} |`
      );
    }
    lines.push("");
  }

  for (const result of run.results) {
    lines.push(
      `- ${result.caseId} [${result.target}] score=${result.score.score} expert=${result.score.selectedExpert || "unknown"}`
    );
    if (result.score.notableDrift.length > 0) {
      lines.push(`  drift: ${result.score.notableDrift.join(" | ")}`);
    }
    if (result.score.behavioralFindings && result.score.behavioralFindings.length > 0) {
      lines.push(`  behavioral: ${result.score.behavioralFindings.join(" | ")}`);
    }
    if (result.score.behavioralMetrics) {
      const m = result.score.behavioralMetrics;
      lines.push(`  metrics: overEngineering=${m.overEngineering} concision=${m.concision}`);
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
