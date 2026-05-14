import test from "node:test";
import assert from "node:assert/strict";

import {
  benjaminiHochberg,
  bootstrapCI,
  cohensKappa,
  holmCorrection,
  mcnemarChi2,
  mcnemarExact,
  sampleRatioMismatch,
  wilcoxonSignedRank
} from "./stats.mjs";

test("mcnemarExact handles discordant paired binary outcomes", () => {
  const result = mcnemarExact(1, 9);

  assert.strictEqual(result.n, 10);
  assert.strictEqual(result.statistic, 8);
  assert.ok(result.pValue < 0.05);
});

test("mcnemarChi2 applies continuity correction", () => {
  const result = mcnemarChi2(1, 9);

  assert.strictEqual(result.statistic, 4.9);
  assert.ok(result.pValue < 0.05);
});

test("wilcoxonSignedRank detects directional paired shifts", () => {
  const result = wilcoxonSignedRank([1, 2, 3, 4, 5, 6]);

  assert.strictEqual(result.n, 6);
  assert.strictEqual(result.negativeRankSum, 0);
  assert.ok(result.pValue < 0.05);
});

test("wilcoxonSignedRank ignores zero deltas with wilcox mode", () => {
  const result = wilcoxonSignedRank([0, 0, 2, -2]);

  assert.strictEqual(result.n, 2);
  assert.strictEqual(result.pValue, 1);
});

test("bootstrapCI returns deterministic percentile interval", () => {
  const result = bootstrapCI([1, 2, 3, 4], undefined, {
    resamples: 500,
    seed: 42
  });

  assert.strictEqual(result.method, "percentile");
  assert.strictEqual(result.estimate, 2.5);
  assert.ok(result.lower <= result.estimate);
  assert.ok(result.upper >= result.estimate);
});

test("holmCorrection adjusts p-values monotonically", () => {
  const result = holmCorrection([0.01, 0.04, 0.03], 0.05);

  assert.deepEqual(result.adjustedPValues, [0.03, 0.06, 0.06]);
  assert.deepEqual(result.rejected, [true, false, false]);
});

test("benjaminiHochberg controls false discovery rate", () => {
  const result = benjaminiHochberg([0.01, 0.04, 0.03], 0.05);

  assert.deepEqual(result.adjustedPValues, [0.03, 0.04, 0.04]);
  assert.deepEqual(result.rejected, [true, true, true]);
});

test("sampleRatioMismatch flags large allocation drift", () => {
  const result = sampleRatioMismatch([90, 10], [1, 1], { alpha: 0.001 });

  assert.strictEqual(result.failed, true);
  assert.ok(result.pValue < 0.001);
});

test("sampleRatioMismatch accepts balanced allocation", () => {
  const result = sampleRatioMismatch([51, 49], [1, 1], { alpha: 0.001 });

  assert.strictEqual(result.failed, false);
});

test("cohensKappa measures judge-human agreement", () => {
  const result = cohensKappa([2, 2, 0, 0], [2, 2, 0, 2]);

  assert.strictEqual(result.n, 4);
  assert.ok(result.kappa > 0);
  assert.ok(result.kappa < 1);
});
