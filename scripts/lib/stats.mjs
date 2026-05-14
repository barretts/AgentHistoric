// Statistical helpers for paired prompt-evaluation runs.
// Pure functions only: no I/O, network, or model calls.

export function mcnemarExact(b, c) {
  const left = nonNegativeInteger(b, "b");
  const right = nonNegativeInteger(c, "c");
  const n = left + right;
  if (n === 0) {
    return {
      test: "mcnemar-exact",
      b: left,
      c: right,
      n,
      pValue: 1,
      statistic: 0
    };
  }

  const k = Math.min(left, right);
  let tail = 0;
  for (let i = 0; i <= k; i += 1) {
    tail += binomialProbability(n, i, 0.5);
  }

  return {
    test: "mcnemar-exact",
    b: left,
    c: right,
    n,
    pValue: roundProb(Math.min(1, tail * 2)),
    statistic: Math.abs(left - right)
  };
}

export function mcnemarChi2(b, c, opts = {}) {
  const left = nonNegativeInteger(b, "b");
  const right = nonNegativeInteger(c, "c");
  const n = left + right;
  const continuity = opts.continuity !== false;
  if (n === 0) {
    return {
      test: "mcnemar-chi2",
      b: left,
      c: right,
      n,
      continuity,
      pValue: 1,
      statistic: 0
    };
  }
  const numerator = Math.abs(left - right) - (continuity ? 1 : 0);
  const statistic = Math.max(0, numerator) ** 2 / n;
  return {
    test: "mcnemar-chi2",
    b: left,
    c: right,
    n,
    continuity,
    pValue: roundProb(chiSquareSurvival(statistic, 1)),
    statistic: roundNumber(statistic)
  };
}

export function wilcoxonSignedRank(deltas, opts = {}) {
  const zeroMethod = opts.zeroMethod || "wilcox";
  if (zeroMethod !== "wilcox") {
    throw new Error(`Unsupported zeroMethod: ${zeroMethod}`);
  }
  const nonZero = deltas
    .map((delta) => Number(delta))
    .filter((delta) => Number.isFinite(delta) && delta !== 0);

  if (nonZero.length === 0) {
    return {
      test: "wilcoxon-signed-rank",
      n: 0,
      statistic: 0,
      positiveRankSum: 0,
      negativeRankSum: 0,
      pValue: 1,
      method: "exact"
    };
  }

  const ranked = rankAbsoluteValues(nonZero);
  const positiveRankSum = ranked
    .filter((row) => row.value > 0)
    .reduce((sum, row) => sum + row.rank, 0);
  const negativeRankSum = ranked
    .filter((row) => row.value < 0)
    .reduce((sum, row) => sum + row.rank, 0);
  const statistic = Math.min(positiveRankSum, negativeRankSum);

  const pValue = ranked.length <= 20
    ? exactWilcoxonPValue(ranked.map((row) => row.rank), statistic)
    : normalWilcoxonPValue(ranked.length, statistic);

  return {
    test: "wilcoxon-signed-rank",
    n: ranked.length,
    statistic: roundNumber(statistic),
    positiveRankSum: roundNumber(positiveRankSum),
    negativeRankSum: roundNumber(negativeRankSum),
    pValue: roundProb(pValue),
    method: ranked.length <= 20 ? "exact" : "normal"
  };
}

export function bootstrapCI(samples, statistic = mean, opts = {}) {
  const values = samples.map(Number).filter(Number.isFinite);
  if (values.length === 0) {
    return {
      method: opts.method || "percentile",
      resamples: 0,
      alpha: opts.alpha ?? 0.05,
      estimate: null,
      lower: null,
      upper: null
    };
  }

  const method = opts.method || "percentile";
  if (method !== "percentile") {
    throw new Error(`Unsupported bootstrap method for Phase 7: ${method}`);
  }
  const resamples = Math.max(1, Math.floor(opts.resamples || 10000));
  const alpha = opts.alpha ?? 0.05;
  const rng = seededRandom(opts.seed ?? 1);
  const estimates = [];

  for (let i = 0; i < resamples; i += 1) {
    const draw = [];
    for (let j = 0; j < values.length; j += 1) {
      draw.push(values[Math.floor(rng() * values.length)]);
    }
    estimates.push(statistic(draw));
  }
  estimates.sort((a, b) => a - b);

  return {
    method,
    resamples,
    alpha,
    estimate: roundNumber(statistic(values)),
    lower: roundNumber(quantileSorted(estimates, alpha / 2)),
    upper: roundNumber(quantileSorted(estimates, 1 - alpha / 2))
  };
}

export function holmCorrection(pValues, alpha = 0.05) {
  const entries = pValues.map((pValue, index) => ({
    index,
    pValue: sanitizePValue(pValue)
  })).sort((a, b) => a.pValue - b.pValue);

  const adjusted = Array(pValues.length).fill(1);
  let runningMax = 0;
  for (let rank = 0; rank < entries.length; rank += 1) {
    const multiplier = entries.length - rank;
    runningMax = Math.max(runningMax, entries[rank].pValue * multiplier);
    adjusted[entries[rank].index] = Math.min(1, runningMax);
  }

  return {
    method: "holm",
    alpha,
    adjustedPValues: adjusted.map(roundProb),
    rejected: adjusted.map((p) => p <= alpha)
  };
}

export function benjaminiHochberg(pValues, alpha = 0.05) {
  const entries = pValues.map((pValue, index) => ({
    index,
    pValue: sanitizePValue(pValue)
  })).sort((a, b) => a.pValue - b.pValue);

  const adjusted = Array(pValues.length).fill(1);
  let runningMin = 1;
  for (let rank = entries.length - 1; rank >= 0; rank -= 1) {
    const oneBasedRank = rank + 1;
    runningMin = Math.min(runningMin, entries[rank].pValue * entries.length / oneBasedRank);
    adjusted[entries[rank].index] = Math.min(1, runningMin);
  }

  return {
    method: "benjamini-hochberg",
    alpha,
    adjustedPValues: adjusted.map(roundProb),
    rejected: adjusted.map((p) => p <= alpha)
  };
}

export function sampleRatioMismatch(observedCounts, expectedRatios, opts = {}) {
  const observed = observedCounts.map((count, index) => nonNegativeNumber(count, `observedCounts[${index}]`));
  const ratios = expectedRatios.map((ratio, index) => nonNegativeNumber(ratio, `expectedRatios[${index}]`));
  if (observed.length !== ratios.length) {
    throw new Error("observedCounts and expectedRatios must have the same length");
  }
  const totalObserved = observed.reduce((sum, value) => sum + value, 0);
  const totalRatio = ratios.reduce((sum, value) => sum + value, 0);
  if (totalObserved === 0 || totalRatio === 0) {
    return {
      test: "sample-ratio-mismatch",
      statistic: 0,
      degreesOfFreedom: Math.max(0, observed.length - 1),
      pValue: 1,
      failed: false,
      alpha: opts.alpha ?? 0.001
    };
  }

  let statistic = 0;
  for (let i = 0; i < observed.length; i += 1) {
    const expected = totalObserved * ratios[i] / totalRatio;
    if (expected > 0) {
      statistic += ((observed[i] - expected) ** 2) / expected;
    }
  }

  const degreesOfFreedom = Math.max(1, observed.length - 1);
  const pValue = chiSquareSurvival(statistic, degreesOfFreedom);
  const alpha = opts.alpha ?? 0.001;
  return {
    test: "sample-ratio-mismatch",
    statistic: roundNumber(statistic),
    degreesOfFreedom,
    pValue: roundProb(pValue),
    failed: pValue < alpha,
    alpha
  };
}

export function cohensKappa(leftLabels, rightLabels) {
  if (leftLabels.length !== rightLabels.length) {
    throw new Error("Label arrays must have the same length");
  }
  if (leftLabels.length === 0) {
    return {
      kappa: null,
      observedAgreement: null,
      expectedAgreement: null,
      n: 0
    };
  }
  const labels = [...new Set([...leftLabels, ...rightLabels])];
  let observedMatches = 0;
  const leftCounts = new Map();
  const rightCounts = new Map();
  for (let i = 0; i < leftLabels.length; i += 1) {
    if (leftLabels[i] === rightLabels[i]) observedMatches += 1;
    leftCounts.set(leftLabels[i], (leftCounts.get(leftLabels[i]) || 0) + 1);
    rightCounts.set(rightLabels[i], (rightCounts.get(rightLabels[i]) || 0) + 1);
  }
  const n = leftLabels.length;
  const observedAgreement = observedMatches / n;
  const expectedAgreement = labels.reduce((sum, label) => {
    return sum + ((leftCounts.get(label) || 0) / n) * ((rightCounts.get(label) || 0) / n);
  }, 0);
  const kappa = expectedAgreement === 1
    ? 1
    : (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
  return {
    kappa: roundNumber(kappa),
    observedAgreement: roundNumber(observedAgreement),
    expectedAgreement: roundNumber(expectedAgreement),
    n
  };
}

function nonNegativeInteger(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

function nonNegativeNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return n;
}

function sanitizePValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function binomialProbability(n, k, p) {
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function logChoose(n, k) {
  let result = 0;
  for (let i = 1; i <= k; i += 1) {
    result += Math.log(n - (k - i)) - Math.log(i);
  }
  return result;
}

function rankAbsoluteValues(values) {
  const sorted = values
    .map((value, index) => ({ value, index, abs: Math.abs(value) }))
    .sort((a, b) => a.abs - b.abs);
  const ranked = Array(values.length);
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor + 1;
    while (end < sorted.length && sorted[end].abs === sorted[cursor].abs) {
      end += 1;
    }
    const firstRank = cursor + 1;
    const lastRank = end;
    const averageRank = (firstRank + lastRank) / 2;
    for (let i = cursor; i < end; i += 1) {
      ranked[sorted[i].index] = {
        value: sorted[i].value,
        rank: averageRank
      };
    }
    cursor = end;
  }
  return ranked;
}

function exactWilcoxonPValue(ranks, statistic) {
  const sums = new Map([[0, 1]]);
  for (const rank of ranks) {
    for (const [sum, count] of [...sums.entries()]) {
      const next = sum + rank;
      sums.set(next, (sums.get(next) || 0) + count);
    }
  }
  const total = 2 ** ranks.length;
  let tail = 0;
  for (const [sum, count] of sums.entries()) {
    const mirrored = Math.min(sum, ranks.reduce((a, b) => a + b, 0) - sum);
    if (mirrored <= statistic + 1e-9) {
      tail += count;
    }
  }
  return tail / total;
}

function normalWilcoxonPValue(n, statistic) {
  const meanRank = n * (n + 1) / 4;
  const variance = n * (n + 1) * (2 * n + 1) / 24;
  const z = (Math.abs(statistic - meanRank) - 0.5) / Math.sqrt(variance);
  return 2 * normalCdf(-Math.abs(z));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function quantileSorted(sorted, q) {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

function chiSquareSurvival(x, degreesOfFreedom) {
  if (x <= 0) return 1;
  if (degreesOfFreedom === 1) {
    return erfc(Math.sqrt(x / 2));
  }
  if (degreesOfFreedom === 2) {
    return Math.exp(-x / 2);
  }
  // Wilson-Hilferty normal approximation for uncommon df>2 SRM checks.
  const z = ((x / degreesOfFreedom) ** (1 / 3) - (1 - 2 / (9 * degreesOfFreedom)))
    / Math.sqrt(2 / (9 * degreesOfFreedom));
  return 1 - normalCdf(z);
}

function normalCdf(x) {
  return 0.5 * erfc(-x / Math.SQRT2);
}

function erfc(x) {
  // Abramowitz and Stegun 7.1.26 approximation.
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const r = t * Math.exp(
    -z * z
    - 1.26551223
    + t * (1.00002368
      + t * (0.37409196
        + t * (0.09678418
          + t * (-0.18628806
            + t * (0.27886807
              + t * (-1.13520398
                + t * (1.48851587
                  + t * (-0.82215223 + t * 0.17087277))))))))
  );
  return x >= 0 ? r : 2 - r;
}

function roundProb(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundNumber(value) {
  if (value === null) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}
