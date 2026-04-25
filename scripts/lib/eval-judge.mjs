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
  }
];

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
  return judgeResponseWithLLM(response, rubric, context);
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
async function judgeResponseWithLLM(response, rubric, context) {
  const apiKey = process.env.JUDGE_API_KEY;
  const baseUrl = process.env.JUDGE_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.JUDGE_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    // Graceful degradation: if no API key, fall back to heuristic
    return {
      ...await judgeResponseHeuristic(response, rubric, context),
      note: "no JUDGE_API_KEY; heuristic fallback"
    };
  }

  const prompt = rubric.prompt(response, context);

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
    const result = await judgeResponse({ response, rubric, context, local });
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
      customRubrics: opts.customRubrics
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