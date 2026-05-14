import { readFile } from "node:fs/promises";
import path from "node:path";

// ── Built-In Rubrics ────────────────────────────────────────────────
//
// Each rubric defines a natural-language evaluation criterion that an LLM
// (the "judge") uses to score a response. Rubrics are keyed by id and can
// be attached to specific experts, all experts, or specific test cases.
//
// Scoring: 0 = fails criterion, 1 = partially meets, 2 = fully meets.
//

export const BUILTIN_RUBRICS = [
  {
    id: "factual-grounding",
    name: "Factual Grounding",
    description: "Are claims in the response grounded in the provided context, code, or verified facts vs. fabricated?",
    prompt: (response, context) =>
      `Evaluate the following response for factual grounding.

Rubric:
- Score 2: All claims are explicitly tied to evidence (code references, test results, verified facts). No fabrication.
- Score 1: Most claims are grounded, but 1-2 assertions lack clear evidence.
- Score 0: Response contains fabricated or unsupported claims presented as facts.

Context: ${context || "No specific context provided."}

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: "all"
  },
  {
    id: "failure-mode-analysis",
    name: "Failure Mode Analysis",
    description: "Does the analysis name concrete failure modes and fallbacks, not just happy-path scenarios?",
    prompt: (response, context) =>
      `Evaluate the following response for failure mode analysis quality.

Rubric:
- Score 2: Response names at least 2 concrete failure modes with specific fallback/ mitigation strategies.
- Score 1: Names 1 failure mode or mentions failures generically without specifics.
- Score 0: No failure mode analysis; only happy-path described.

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-architect-descartes", "expert-formal-dijkstra", "expert-qa-popper"]
  },
  {
    id: "contract-explicitness",
    name: "Contract Explicitness",
    description: "Does the response define clear contracts (inputs, outputs, invariants) before implementation details?",
    prompt: (response, context) =>
      `Evaluate the following response for contract explicitness.

Rubric:
- Score 2: Response clearly defines inputs, outputs, and invariants/contracts before any implementation detail.
- Score 1: Contracts are implied but not stated explicitly, or contracts come after implementation.
- Score 0: No contract definition; jumps straight into implementation.

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-architect-descartes", "expert-abstractions-liskov"]
  },
  {
    id: "diagnostic-before-fix",
    name: "Diagnostic Before Fix",
    description: "When debugging, does the response diagnose the problem before proposing a solution?",
    prompt: (response, context) =>
      `Evaluate the following response for diagnostic discipline.

Rubric:
- Score 2: Response clearly diagnoses the root cause (with evidence) before proposing any fix.
- Score 1: Response mentions a diagnosis but the fix is proposed before diagnostic evidence is complete.
- Score 0: Jump straight to a fix with no diagnosis.

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-qa-popper", "expert-engineer-peirce"]
  },
  {
    id: "draft-diversity",
    name: "Draft Diversity",
    description: "When exploring options, are the generated drafts meaningfully different (not cosmetic variants)?",
    prompt: (response, context) =>
      `Evaluate the following response for draft diversity.

Rubric:
- Score 2: Contains at least 3 meaningfully different drafts with distinct tradeoffs (architecture, complexity, or risk profile differ significantly).
- Score 1: Contains 3 drafts but they are minor variants of the same approach.
- Score 0: Fewer than 3 drafts, or all drafts are cosmetic variants.

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-visionary-dennett"]
  },
  {
    id: "human-cost-awareness",
    name: "Human Cost Awareness",
    description: "Does the response consider the user's cognitive load, emotional experience, or accessibility needs?",
    prompt: (response, context) =>
      `Evaluate the following response for human cost awareness.

Rubric:
- Score 2: Response explicitly discusses user experience, cognitive load, or accessibility impact with concrete mitigation.
- Score 1: Mentions user impact briefly but without concrete mitigation.
- Score 0: No consideration of user experience; purely technical.

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-ux-rogers"]
  },
  {
    id: "measurement-before-optimization",
    name: "Measurement Before Optimization",
    description: "Does the response cite measurement evidence before proposing performance improvements?",
    prompt: (response, context) =>
      `Evaluate the following response for measurement-first discipline.

Rubric:
- Score 2: Response identifies the bottleneck with measurement evidence (profiling data, benchmarks, metrics) before proposing any optimization.
- Score 1: Mentions measurement but the bottleneck identification is weak or the optimization predates evidence.
- Score 0: Proposes optimization without any measurement evidence.

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-performance-knuth"]
  },
  {
    id: "persona-stance-fidelity",
    name: "Persona Stance Fidelity",
    description: "Does the response inhabit the selected expert persona instead of collapsing into generic assistant behavior?",
    prompt: (response, context) =>
      `Evaluate the following response for persona stance fidelity.

Rubric:
- Score 2: Response visibly inhabits the selected expert's persona through its priorities, resisted temptation, and domain-specific stance.
- Score 1: Response names or routes to the expert but mostly sounds like a generic assistant.
- Score 0: Response does not preserve a recognizable selected expert persona.

Context: ${context || "No specific context provided."}

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: "all"
  },
  {
    id: "philosophical-popper-falsification",
    name: "Popper Falsification Pressure",
    description: "Does the response resist confirmation by naming how the claim or fix could be falsified?",
    prompt: (response, context) =>
      `Evaluate the following response for Popper-style falsification pressure.

Rubric:
- Score 2: Response names what evidence, reproduction, counterexample, or failure would falsify the claim before accepting it.
- Score 1: Response mentions testing or verification but does not state a concrete falsifier.
- Score 0: Response validates or assumes correctness without an adversarial falsification path.

Context: ${context || "No specific context provided."}

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-qa-popper"]
  },
  {
    id: "philosophical-descartes-doubt",
    name: "Descartes Assumption Doubt",
    description: "Does the response resist inherited assumptions by reducing the problem to bedrock constraints?",
    prompt: (response, context) =>
      `Evaluate the following response for Descartes-style assumption doubt.

Rubric:
- Score 2: Response explicitly challenges assumptions and reduces the design to foundational constraints before proposing structure.
- Score 1: Response lists assumptions or constraints but does not visibly doubt or reduce them.
- Score 0: Response accepts the prompt framing and jumps into design details.

Context: ${context || "No specific context provided."}

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-architect-descartes"]
  },
  {
    id: "philosophical-rogers-nonblame",
    name: "Rogers Non-Blame User Proxy",
    description: "Does the response resist blaming the user and assign responsibility to interface affordances or system design?",
    prompt: (response, context) =>
      `Evaluate the following response for Rogers-style non-blame user advocacy.

Rubric:
- Score 2: Response explicitly avoids blaming users and explains the human cost or interface affordance that caused the problem.
- Score 1: Response mentions user experience or friction but does not clearly reject user blame.
- Score 0: Response blames users, treats confusion as user error, or ignores human cost.

Context: ${context || "No specific context provided."}

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-ux-rogers"]
  },
  {
    id: "philosophical-shannon-signal-retention",
    name: "Shannon Signal Retention",
    description: "Does the response resist more-context-is-better by separating signal, noise, compression, and critical retention?",
    prompt: (response, context) =>
      `Evaluate the following response for Shannon-style signal retention discipline.

Rubric:
- Score 2: Response distinguishes signal from noise and states what must be retained during compression or filtering.
- Score 1: Response mentions signal, noise, compression, or filtering but lacks explicit retention criteria.
- Score 0: Response adds context or truncates content without signal/noise analysis.

Context: ${context || "No specific context provided."}

Response:
${response}

Return ONLY a JSON object: {"score": 0|1|2, "reasoning": "brief explanation"}`,
    applicableTo: ["expert-information-shannon"]
  }
];

export const BUILTIN_RUBRICS_PAIRWISE = BUILTIN_RUBRICS.map((rubric) => ({
  id: rubric.id,
  name: `${rubric.name} (Pairwise)`,
  description: rubric.description,
  applicableTo: rubric.applicableTo,
  prompt: (responseA, responseB, context) =>
    `Compare Response A and Response B for this criterion:

${rubric.description}

Use the same rubric intent as the pointwise evaluator, but choose the response
that better satisfies the criterion. Prefer "tie" when neither response is
materially better.

Context: ${context || "No specific context provided."}

Response A:
${responseA}

Response B:
${responseB}

Return ONLY a JSON object: {"winner": "A"|"B"|"tie", "reasoning": "brief explanation"}`
}));

// ── Rubric Resolution ───────────────────────────────────────────────

export function resolveRubricsForCase(testCase, expertId, customRubrics = []) {
  const allRubrics = [...BUILTIN_RUBRICS, ...customRubrics];
  const requestedRubricIds = testCase.judgeRubrics || [];

  if (requestedRubricIds.length > 0) {
    // User explicitly requested specific rubrics for this case
    return allRubrics.filter((r) => requestedRubricIds.includes(r.id));
  }

  // Otherwise, resolve by expert applicability
  return allRubrics.filter((r) => {
    if (r.applicableTo === "all") return true;
    if (Array.isArray(r.applicableTo)) {
      return r.applicableTo.includes(expertId);
    }
    return false;
  });
}

export async function loadJudgeConfig(workspaceRoot) {
  const configPath = path.join(workspaceRoot, "regression", "judge-config.json");
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    return {
      judgeModelFamily: null,
      defaultFewShotExamples: 3,
      kappaFloor: 0.4
    };
  }
}

export async function loadJudgeCalibrationReport(workspaceRoot) {
  const reportPath = path.join(workspaceRoot, "regression", "judge-calibration", "report.json");
  try {
    return JSON.parse(await readFile(reportPath, "utf8"));
  } catch {
    return null;
  }
}

export function validateJudgeCalibration(activeRubricIds, report, opts = {}) {
  const kappaFloor = opts.kappaFloor ?? 0.4;
  const failures = [];
  const warnings = [];
  if (!report) {
    const message = "judge calibration report missing";
    if (opts.requireCalibratedJudge) failures.push(message);
    else warnings.push(message);
    return { ok: failures.length === 0, failures, warnings };
  }

  const byRubric = new Map((report.rubrics || []).map((row) => [row.rubricId, row]));
  for (const rubricId of activeRubricIds) {
    const row = byRubric.get(rubricId);
    if (!row) {
      const message = `rubric ${rubricId} missing from judge calibration report`;
      if (opts.requireCalibratedJudge) failures.push(message);
      else warnings.push(message);
      continue;
    }
    if (typeof row.kappa !== "number" || row.kappa < kappaFloor) {
      const message = `rubric ${rubricId} kappa ${row.kappa ?? "N/A"} below floor ${kappaFloor}`;
      if (opts.requireCalibratedJudge) failures.push(message);
      else warnings.push(message);
    }
  }
  return { ok: failures.length === 0, failures, warnings };
}

export async function loadFewShotExamples(workspaceRoot, rubricIds, limit = 3) {
  const examplesByRubric = {};
  for (const rubricId of rubricIds) {
    const filePath = path.join(
      workspaceRoot,
      "regression",
      "judge-calibration",
      "gold",
      `${rubricId}.jsonl`
    );
    try {
      const content = await readFile(filePath, "utf8");
      examplesByRubric[rubricId] = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, limit)
        .map((line) => JSON.parse(line));
    } catch {
      examplesByRubric[rubricId] = [];
    }
  }
  return examplesByRubric;
}

// ── Judge Evaluation ────────────────────────────────────────────────

/**
 * Evaluate a single response against a rubric using an LLM as judge.
 *
 * In local (deterministic) mode, this runs a heuristic approximation of the
 * rubric rather than calling an external LLM. This lets the test suite exercise
 * the judge infrastructure without spending budget.
 *
 * @param {object} params
 * @param {string} params.response - The full response text to evaluate.
 * @param {object} params.rubric - A rubric definition.
 * @param {string} [params.context] - Optional context (e.g., original prompt).
 * @param {boolean} [params.local] - If true, use heuristic scoring instead of LLM call.
 * @returns {Promise<{score: number, reasoning: string, mode: 'llm'|'heuristic'}>}
 */
export async function judgeResponse(params) {
  const { response, rubric, context, local = true } = params;

  if (local) {
    return judgeResponseHeuristic(response, rubric, context);
  }

  // Real LLM judge path (requires a configured LLM client)
  return judgeResponseWithLLM(response, rubric, context, params);
}

export async function judgePairwise(params) {
  const {
    responseA,
    responseB,
    rubric,
    context,
    local = true,
    swapOrder = true
  } = params;

  const forward = await judgePairwiseRaw({
    responseA,
    responseB,
    rubric,
    context,
    local,
    options: params
  });
  if (!swapOrder) {
    return {
      winner: normalizeRawWinner(forward.winner, false),
      swapConsistent: true,
      positionBiasDetected: false,
      forward,
      reverse: null,
      rubricId: rubric.id
    };
  }

  const reverse = await judgePairwiseRaw({
    responseA: responseB,
    responseB: responseA,
    rubric,
    context,
    local,
    options: params
  });

  const forwardWinner = normalizeRawWinner(forward.winner, false);
  const reverseWinner = normalizeRawWinner(reverse.winner, true);
  const swapConsistent = forwardWinner === reverseWinner;
  const positionBiasDetected =
    !swapConsistent
    && rawPosition(forward.winner) !== "tie"
    && rawPosition(forward.winner) === rawPosition(reverse.winner);

  return {
    winner: swapConsistent ? forwardWinner : "tie",
    swapConsistent,
    positionBiasDetected,
    forward,
    reverse,
    rubricId: rubric.id
  };
}

/**
 * Heuristic approximation of rubric scoring for local/deterministic testing.
 * These heuristics are intentionally simpler than the full LLM judge but
 * exercise the same evaluation pipeline structure.
 */
async function judgeResponseHeuristic(response, rubric, context) {
  const text = String(response || "");
  let score = 0;
  let reasoning = "";

  switch (rubric.id) {
    case "factual-grounding":
      if (/\bVERIFIED\b/.test(text) || /\b(code|line \d+|test|log|evidence)\b/i.test(text)) {
        score = 2;
        reasoning = "Claims reference concrete evidence (heuristic).";
      } else if (/\b(HYPOTHESIS|assume|probably)\b/i.test(text)) {
        score = 1;
        reasoning = "Some uncertainty acknowledged (heuristic).";
      } else {
        score = 0;
        reasoning = "No evidence markers found (heuristic).";
      }
      break;

    case "failure-mode-analysis":
      const failureCount = countMatches(text, [
        /\bfailure mode\b/i, /\bfallback\b/i, /\bif.*fail/i,
        /\bwhen.*break/i, /\berror.*case\b/i, /\bdegrad/i, /\bboundary\b/i
      ]);
      if (failureCount >= 2) {
        score = 2;
        reasoning = `Names ${failureCount} failure-mode-related concepts.`;
      } else if (failureCount >= 1) {
        score = 1;
        reasoning = `Names ${failureCount} failure-mode concept.`;
      } else {
        score = 0;
        reasoning = "No failure mode analysis detected.";
      }
      break;

    case "contract-explicitness":
      if (/\b(contract|interface|schema|input|output|invariant|precondition|postcondition)\b/i.test(text)) {
        const beforeImpl = findBeforeSection(text, /\b(implementation|code|function|class)\b/i);
        if (beforeImpl) {
          score = 2;
          reasoning = "Contract concepts appear before implementation details.";
        } else {
          score = 1;
          reasoning = "Contract concepts present but not clearly before implementation.";
        }
      } else {
        score = 0;
        reasoning = "No contract concepts detected.";
      }
      break;

    case "diagnostic-before-fix":
      const hasDiagnosis = /\b(diagnosis|root cause|error.*shows?|stack.*indicates?|reading.*error|investigat)\b/i.test(text);
      const hasFix = /\b(fix|solution|replace|add.*check|change)\b/i.test(text);
      if (hasDiagnosis && hasFix) {
        const diagIdx = text.search(/\b(diagnosis|root cause|error.*shows?|reading.*error)\b/i);
        const fixIdx = text.search(/\b(fix|solution|replace)\b/i);
        if (diagIdx >= 0 && fixIdx >= 0 && diagIdx < fixIdx) {
          score = 2;
          reasoning = "Diagnosis precedes proposed fix.";
        } else {
          score = 1;
          reasoning = "Both diagnosis and fix present but ordering unclear.";
        }
      } else if (hasFix) {
        score = 0;
        reasoning = "Fix proposed without diagnosis.";
      } else {
        score = 1;
        reasoning = "No fix proposed; diagnostic content only.";
      }
      break;

    case "draft-diversity":
      const drafts = extractDraftBodies(text);
      if (drafts.length >= 3) {
        const uniqueTopics = new Set(drafts.map(d => getDominantKeywords(d, 3).join("|")));
        if (uniqueTopics.size >= 2) {
          score = 2;
          reasoning = `${drafts.length} drafts with diverse approaches detected.`;
        } else {
          score = 1;
          reasoning = `${drafts.length} drafts but similar topic coverage.`;
        }
      } else {
        score = 0;
        reasoning = `Only ${drafts.length} draft(s) found.`;
      }
      break;

    case "human-cost-awareness":
      if (/\b(cognitive|user.*feel|confusion|accessibility|frustration|intuitive|learning curve)\b/i.test(text)) {
        score = 2;
        reasoning = "Human cost factors explicitly discussed.";
      } else if (/\b(user.*experience|usability|ux)\b/i.test(text)) {
        score = 1;
        reasoning = "UX mentioned briefly.";
      } else {
        score = 0;
        reasoning = "No human cost awareness detected.";
      }
      break;

    case "measurement-before-optimization":
      const hasMeasure = /\b(profil|benchmark|measur|latency|throughput|O\(|ms|seconds|memory usage)\b/i.test(text);
      const hasOptimize = /\b(optimiz|cache|batch|parallel|reduce.*call|eliminat.*alloc)\b/i.test(text);
      if (hasMeasure) {
        score = 2;
        reasoning = "Measurement evidence cited.";
      } else if (hasOptimize) {
        score = 0;
        reasoning = "Optimization proposed without measurement.";
      } else {
        score = 1;
        reasoning = "Neither measurement nor explicit optimization detected.";
      }
      break;

    case "persona-stance-fidelity":
      const selectedExpertMatch = text.match(/\bSelected Expert:\s*(expert-[\w-]+)/i);
      const selectedExpert = selectedExpertMatch?.[1]?.toLowerCase();
      const personaPatterns = {
        "expert-qa-popper": /\b(falsif|refut|disprov|counterexample|try to break|reproduc|failure coordinate)\b/i,
        "expert-architect-descartes": /\b(assumption|doubt|bedrock|foundation|first principle|trust boundary|constraint)\b/i,
        "expert-ux-rogers": /\b(user|human cost|cognitive|confusion|friction|accessibility|interface|affordance)\b/i,
        "expert-information-shannon": /\b(signal|noise|compression|retention|fidelity|critical.*retain)\b/i
      };
      if (selectedExpert && personaPatterns[selectedExpert]?.test(text)) {
        score = 2;
        reasoning = "Selected expert and matching persona stance markers detected.";
      } else if (selectedExpert) {
        score = 1;
        reasoning = "Selected expert is named but persona stance markers are weak.";
      } else {
        score = 0;
        reasoning = "No selected expert persona marker detected.";
      }
      break;

    case "philosophical-popper-falsification":
      const hasFalsifier = /\b(falsif|refut|disprov|counterexample|would break|try to break|reproduc|failure coordinate)\b/i.test(text);
      const hasAcceptanceBoundary = /\b(if|unless|until|only then|survive|accept)\b/i.test(text);
      if (hasFalsifier && hasAcceptanceBoundary) {
        score = 2;
        reasoning = "Names a concrete falsification path and acceptance boundary.";
      } else if (hasFalsifier || /\b(test|verify|evidence)\b/i.test(text)) {
        score = 1;
        reasoning = "Mentions testing pressure but lacks a complete falsifier.";
      } else {
        score = 0;
        reasoning = "No falsification pressure detected.";
      }
      break;

    case "philosophical-descartes-doubt":
      const hasDoubt = /\b(assumption|doubt|challenge|strip|reduce|bedrock|first principle)\b/i.test(text);
      const hasFoundation = /\b(foundat|constraint|invariant|trust boundary|irreducible|before design)\b/i.test(text);
      if (hasDoubt && hasFoundation) {
        score = 2;
        reasoning = "Challenges assumptions and reduces to foundational constraints.";
      } else if (hasDoubt || hasFoundation) {
        score = 1;
        reasoning = "Names assumptions or foundations without full reduction.";
      } else {
        score = 0;
        reasoning = "No assumption doubt detected.";
      }
      break;

    case "philosophical-rogers-nonblame":
      const rejectsBlame = /\b(not.*user.*fault|do not blame|interface.*afford|design failure|system.*responsib)\b/i.test(text);
      const hasHumanCost = /\b(human cost|cognitive|confusion|friction|accessibility|user.*feel|misclick)\b/i.test(text);
      if (rejectsBlame && hasHumanCost) {
        score = 2;
        reasoning = "Rejects user blame and names human/interface cost.";
      } else if (hasHumanCost || /\b(user experience|usability|ux)\b/i.test(text)) {
        score = 1;
        reasoning = "Mentions user impact without explicit non-blame stance.";
      } else {
        score = 0;
        reasoning = "No non-blame user advocacy detected.";
      }
      break;

    case "philosophical-shannon-signal-retention":
      const hasSignalNoise = /\bsignal\b/i.test(text) && /\bnoise\b/i.test(text);
      const hasRetention = /\b(retain|retention|critical|must keep|do not drop|lossless|fidelity)\b/i.test(text);
      const hasCompression = /\b(compress|filter|summariz|drop|context|token)\b/i.test(text);
      if (hasSignalNoise && hasRetention) {
        score = 2;
        reasoning = "Separates signal/noise and states retention criteria.";
      } else if (hasSignalNoise || (hasCompression && hasRetention)) {
        score = 1;
        reasoning = "Mentions compression discipline without complete signal retention.";
      } else {
        score = 0;
        reasoning = "No signal retention discipline detected.";
      }
      break;

    default:
      // Generic fallback: any rubric without a specific heuristic
      score = 1;
      reasoning = `No specific heuristic for rubric "${rubric.id}"; defaulting to neutral.`;
  }

  return { score, reasoning, mode: "heuristic", rubricId: rubric.id };
}

/**
 * Real LLM judge path. Expects a `JUDGE_MODEL` env var or defaults to a
 * reasonably capable model. Uses the OpenAI-compatible chat completions API.
 */
export async function judgeResponseWithLLM(response, rubric, context, opts = {}) {
  const apiKey = process.env.JUDGE_API_KEY;
  const baseUrl = process.env.JUDGE_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.JUDGE_MODEL || "gpt-4o-mini";
  enforceJudgeFamily({
    judgeModelFamily: opts.judgeModelFamily || inferModelFamily(model),
    subjectModelFamily: opts.subjectModelFamily,
    allowSameFamily: opts.allowSameFamily
  });

  if (!apiKey) {
    // Graceful degradation: if no API key, fall back to heuristic
    return {
      ...await judgeResponseHeuristic(response, rubric, context),
      note: "no JUDGE_API_KEY; heuristic fallback"
    };
  }

  const prompt = withFewShotExamples(
    rubric.prompt(response, context),
    opts.fewShotExamples || []
  );

  let result;
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a precise evaluator of technical responses. Return ONLY valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      throw new Error(`Judge API returned ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json();
    const contentStr = data.choices?.[0]?.message?.content || "{}";
    result = JSON.parse(contentStr);
  } catch (err) {
    // Fall back to heuristic on any LLM error
    const fallback = await judgeResponseHeuristic(response, rubric, context);
    return { ...fallback, note: `LLM call failed (${err.message}); heuristic fallback` };
  }

  return {
    score: clampScore(result.score),
    reasoning: result.reasoning || "No reasoning provided by judge.",
    mode: "llm",
    rubricId: rubric.id,
    rawLLM: result
  };
}

async function judgePairwiseRaw({ responseA, responseB, rubric, context, local, options }) {
  const pairwiseRubric = BUILTIN_RUBRICS_PAIRWISE.find((candidate) => candidate.id === rubric.id) || {
    id: rubric.id,
    prompt: (left, right, ctx) =>
      `Compare the two responses for rubric ${rubric.id}.

Context: ${ctx || "No context."}

Response A:
${left}

Response B:
${right}

Return ONLY JSON: {"winner":"A"|"B"|"tie","reasoning":"brief explanation"}`
  };

  if (local) {
    const left = await judgeResponseHeuristic(responseA, rubric, context);
    const right = await judgeResponseHeuristic(responseB, rubric, context);
    let winner = "tie";
    if (left.score > right.score) winner = "A";
    if (right.score > left.score) winner = "B";
    return {
      winner,
      reasoning: `Heuristic pairwise comparison: A=${left.score}, B=${right.score}.`,
      mode: "heuristic",
      rubricId: rubric.id,
      left,
      right
    };
  }

  return judgePairwiseWithLLM(responseA, responseB, pairwiseRubric, context, options);
}

async function judgePairwiseWithLLM(responseA, responseB, rubric, context, opts = {}) {
  const apiKey = process.env.JUDGE_API_KEY;
  const baseUrl = process.env.JUDGE_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.JUDGE_MODEL || "gpt-4o-mini";
  enforceJudgeFamily({
    judgeModelFamily: opts.judgeModelFamily || inferModelFamily(model),
    subjectModelFamily: opts.subjectModelFamily,
    allowSameFamily: opts.allowSameFamily
  });

  if (!apiKey) {
    return judgePairwiseRaw({
      responseA,
      responseB,
      rubric: BUILTIN_RUBRICS.find((candidate) => candidate.id === rubric.id) || rubric,
      context,
      local: true,
      options: opts
    });
  }

  const prompt = withFewShotExamples(
    rubric.prompt(responseA, responseB, context),
    opts.fewShotExamples || []
  );

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a precise evaluator of technical responses. Return ONLY valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });
    if (!resp.ok) {
      throw new Error(`Judge API returned ${resp.status}: ${await resp.text()}`);
    }
    const data = await resp.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return {
      winner: normalizePairwiseWinner(raw.winner),
      reasoning: raw.reasoning || "No reasoning provided by judge.",
      mode: "llm",
      rubricId: rubric.id,
      rawLLM: raw
    };
  } catch (err) {
    const fallback = await judgePairwiseRaw({
      responseA,
      responseB,
      rubric: BUILTIN_RUBRICS.find((candidate) => candidate.id === rubric.id) || rubric,
      context,
      local: true,
      options: opts
    });
    return { ...fallback, note: `LLM call failed (${err.message}); heuristic fallback` };
  }
}

// ── Multi-Rubric Evaluation ─────────────────────────────────────────

/**
 * Evaluate a response against all applicable rubrics for a given case/expert.
 *
 * @param {object} params
 * @param {object} params.system - Loaded prompt system spec.
 * @param {object} params.testCase - Regression test case.
 * @param {string} params.response - Full response text.
 * @param {string} params.expertId - The active expert for this case.
 * @param {string} [params.context] - Original prompt/ context for the case.
 * @param {boolean} [params.local] - Local heuristic mode vs real LLM.
 * @param {object[]} [params.customRubrics] - Additional rubrics beyond built-ins.
 * @returns {Promise<{results: object[], aggregateScore: number, avgScore: number}>}
 */
export async function judgeResponseMulti(params) {
  const { system, testCase, response, expertId, context, local = true, customRubrics = [] } = params;
  const rubrics = resolveRubricsForCase(testCase, expertId, customRubrics);

  if (rubrics.length === 0) {
    return { results: [], aggregateScore: 2, avgScore: 2, rubricCount: 0 };
  }

  const results = [];
  for (const rubric of rubrics) {
    const result = await judgeResponse({
      response,
      rubric,
      context,
      local,
      judgeModelFamily: params.judgeModelFamily,
      subjectModelFamily: params.subjectModelFamily,
      allowSameFamily: params.allowSameFamily,
      fewShotExamples: params.fewShotExamplesByRubric?.[rubric.id] || []
    });
    results.push(result);
  }

  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = results.length * 2;
  const avgScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 200) / 100 : 2;

  return {
    results,
    aggregateScore: totalScore,
    maxScore,
    avgScore,
    rubricCount: rubrics.length
  };
}

// ── Integration with evaluateResponse ───────────────────────────────

/**
 * Wrapper that integrates judge results into the existing evaluateResponse()
 * result structure. Add `judgeResult` to the score output.
 *
 * Usage in regression tests:
 *   const scoreResult = evaluateResponse(system, testCase, response);
 *   const withJudge = await attachJudgeResults(scoreResult, { system, testCase, response });
 */
export async function attachJudgeResults(system, testCase, response, opts = {}) {
  const scoreResult = opts.scoreResult;
  const expertId = scoreResult?.selectedExpert || testCase.expectedPrimaryExpert || "unknown";
  const local = opts.local !== false; // default true

  try {
    const judgeResult = await judgeResponseMulti({
      system,
      testCase,
      response: response.response || "",
      expertId,
      context: testCase.prompt,
      local,
      customRubrics: opts.customRubrics,
      judgeModelFamily: opts.judgeModelFamily,
      subjectModelFamily: opts.subjectModelFamily,
      allowSameFamily: opts.allowSameFamily,
      fewShotExamplesByRubric: opts.fewShotExamplesByRubric
    });

    // Adjust score based on judge findings
    // If judge gives avgScore < 1.0, degrade the structural score by 1
    let adjustedScore = scoreResult?.score ?? 0;
    if (judgeResult.avgScore < 1.0 && adjustedScore >= 1) {
      adjustedScore = Math.max(0, adjustedScore - 1);
    }

    return {
      ...scoreResult,
      judgeResult,
      score: adjustedScore
    };
  } catch (err) {
    return {
      ...scoreResult,
      judgeResult: { error: err.message, note: "judge evaluation failed" },
      score: scoreResult?.score ?? 0
    };
  }
}

// ── Utility Functions ───────────────────────────────────────────────

function clampScore(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(2, Math.round(n)));
}

function normalizePairwiseWinner(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "A" || value === "B") return value;
  return "tie";
}

function normalizeRawWinner(raw, swapped) {
  const winner = normalizePairwiseWinner(raw);
  if (winner === "tie") return "tie";
  if (!swapped) {
    return winner === "A" ? "control" : "treatment";
  }
  return winner === "A" ? "treatment" : "control";
}

function rawPosition(raw) {
  const winner = normalizePairwiseWinner(raw);
  if (winner === "A") return "first";
  if (winner === "B") return "second";
  return "tie";
}

function enforceJudgeFamily({ judgeModelFamily, subjectModelFamily, allowSameFamily }) {
  if (!judgeModelFamily || !subjectModelFamily || allowSameFamily) return;
  if (normalizeFamily(judgeModelFamily) === normalizeFamily(subjectModelFamily)) {
    throw new Error(
      `Judge model family (${judgeModelFamily}) matches subject model family (${subjectModelFamily}); use --allow-same-family to override.`
    );
  }
}

function inferModelFamily(model) {
  const value = String(model || "").toLowerCase();
  if (value.includes("claude")) return "anthropic";
  if (value.includes("gemini")) return "google";
  if (value.includes("grok")) return "xai";
  if (value.includes("gpt") || value.includes("o1") || value.includes("o3") || value.includes("o4")) return "openai";
  return value.split(/[-_:/.]/)[0] || "unknown";
}

function normalizeFamily(value) {
  return String(value || "").trim().toLowerCase();
}

function withFewShotExamples(prompt, examples) {
  if (!examples || examples.length === 0) return prompt;
  const rendered = examples.map((example, index) => {
    return [
      `Example ${index + 1}:`,
      `Human label: ${example.humanLabel}`,
      `Human critique: ${example.critique || "No critique provided."}`,
      example.response ? `Response:\n${example.response}` : null
    ].filter(Boolean).join("\n");
  }).join("\n\n");
  return [
    "Use these human-labeled critique examples to calibrate your judgment:",
    rendered,
    "",
    prompt
  ].join("\n");
}

function countMatches(text, patterns) {
  let count = 0;
  for (const p of patterns) {
    if (p.test(text)) count++;
    p.lastIndex = 0; // Reset regex state
  }
  return count;
}

function findBeforeSection(text, sectionPattern) {
  const match = text.match(sectionPattern);
  if (!match) return false;
  const sectionIdx = match.index;
  // Check if there are contract-related terms in the first half of the text
  const firstHalf = text.slice(0, Math.floor(text.length / 2));
  return firstHalf.length > sectionIdx * 0.5;
}

function extractDraftBodies(text) {
  const draftPattern = /^(?:#{1,4}\s+)?(Draft\s+[A-Z])\s*:?\s*$/gm;
  const drafts = [];
  let m;
  const positions = [];

  while ((m = draftPattern.exec(text)) !== null) {
    positions.push({ start: m.index + m[0].length, end: text.length, label: m[1] });
  }

  for (let i = 0; i < positions.length; i++) {
    if (i + 1 < positions.length) {
      positions[i].end = positions[i + 1].start;
    }
    drafts.push(text.slice(positions[i].start, positions[i].end).trim());
  }

  return drafts;
}

function getDominantKeywords(text, n = 3) {
  const stopWords = new Set(["the", "a", "an", "is", "are", "to", "of", "in", "for", "on", "with", "this", "that", "and", "or", "but", "it", "as", "at", "by", "from", "be", "was", "were", "has", "had", "have", "do", "does", "did", "will", "would", "should", "could", "can", "may", "might", "not", "no", "yes", "if", "then", "so", "than", "too", "very", "just", "about", "up", "out", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "into", "its", "their", "our", "my", "your", "his", "her", "use", "using", "need", "one", "we", "you", "yourself"]);
  const words = text.toLowerCase().match(/[a-z]{4,}/g) || [];
  const freq = {};
  for (const w of words) {
    if (!stopWords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

/**
 * Load rubrics from a JSON file. Useful for project-specific rubrics beyond
 * the built-in set.
 *
 * @param {string} filePath - Path to a JSON file with rubric definitions.
 * @returns {Promise<object[]>} Array of rubric objects.
 */
export async function loadCustomRubrics(filePath) {
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : (parsed.rubrics || []);
}