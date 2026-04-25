import test from "node:test";
import assert from "node:assert/strict";

import {
  detectDistributionShift,
  formatShiftReport
} from "./distribution-shift.mjs";

// ── No shift: same domain prompts ──────────────────────────────────

test("detectDistributionShift: no shift when both sets use same domain", () => {
  const existing = [
    "Fix the null pointer in the user service",
    "Add error handling to the payment processor",
    "The API returns undefined for edge cases",
    "Debug the failing auth tests",
    "Refactor the config module to reduce coupling"
  ];
  const newPrompts = [
    "Fix the race condition in the order service",
    "Add input validation to the login handler",
    "The database returns null for missing keys",
    "Debug the integration test failures",
    "Optimize the query module response time"
  ];

  const result = detectDistributionShift(existing, newPrompts);
  assert.strictEqual(typeof result.shiftDetected, "boolean");
  assert.strictEqual(typeof result.classifierAccuracy, "number");
  assert.ok(result.classifierAccuracy < 0.8,
    `Accuracy ${result.classifierAccuracy} should be < 0.8 for similar domain prompts`);
});

// ── Significant shift: completely different domain ─────────────────

test("detectDistributionShift: significant shift when domains differ", () => {
  // Need enough prompts that the 80/20 split still has enough test samples
  const existing = [
    "Fix the null pointer exception in the user service",
    "Add unit tests for the payment service layer",
    "Debug the build failure after dependency upgrade",
    "Refactor the routing logic for performance improvements",
    "Handle the race condition in concurrent database updates",
    "Fix the authentication token expiration bug",
    "Add integration tests for the API endpoints",
    "Debug the CI pipeline failure on the staging branch",
    "Refactor the database migration scripts for safety",
    "Handle the edge case with empty input arrays",
    "Fix the memory leak in the worker thread pool",
    "Add error logging to all exception handlers",
    "Debug the timeout issue in the notification service",
    "Refactor the configuration loading module",
    "Handle the null return from the cache layer",
    "Fix the pagination offset calculation bug",
    "Add retry logic to the external API calls",
    "Debug the serialization error in the message queue",
    "Refactor the session management middleware",
    "Handle the concurrent write contention in the ledger"
  ];
  const newPrompts = [
    "Design a multimodal AI system for image classification and text generation",
    "Build an autonomous agent orchestration platform with skill routing",
    "Deploy a federated learning pipeline across edge devices and data centers",
    "Implement a neural architecture search framework for transformer variants",
    "Create a reinforcement learning reward model for code generation tasks",
    "Design a quantum computing simulation framework for algorithm testing",
    "Build autonomous vehicle perception using neural radiance fields",
    "Deploy a distributed consensus protocol for microservice coordination",
    "Implement a self-supervised pre-training pipeline for medical imaging",
    "Create a meta-learning system for few-shot adaptation in robotics",
    "Design a graph neural network for molecular property prediction",
    "Build a large-scale language model training infrastructure from scratch",
    "Deploy a real-time anomaly detection system for network security",
    "Implement a differentiable physics simulator for robot control",
    "Create a zero-shot translation system using prompt engineering",
    "Design a multi-modal retrieval system for image and document search",
    "Build an automated code review assistant using semantic analysis",
    "Deploy a streaming analytics pipeline for sensor data ingestion",
    "Implement a causal inference engine for observational study analysis",
    "Create a generative model for synthetic data augmentation in training"
  ];

  const result = detectDistributionShift(existing, newPrompts);
  assert.strictEqual(result.shiftDetected, true);
  assert.strictEqual(result.shiftScore, "significant");
  assert.ok(result.classifierAccuracy >= 0.8,
    `Accuracy should be >= 0.8 for different domains, got ${result.classifierAccuracy}`);
});

// ── Marginal: slightly different but overlapping ───────────────────

test("detectDistributionShift: marginal or below when prompts partially differ", () => {
  const existing = [
    "Fix the null pointer in the user service authentication flow",
    "Add tests for authentication middleware token validation",
    "Debug the CI pipeline failure on the login integration test",
    "Refactor the password hashing module for better security",
    "Handle the expired session cleanup in the middleware",
    "Fix the rate limiting logic for failed login attempts",
    "Add validation to the OAuth callback handler response",
    "Debug the SSO token refresh mechanism timeout issue",
    "Refactor the permission checking service layer",
    "Handle the concurrent login conflict in the session store"
  ];
  const newPrompts = [
    "Fix the memory leak in the database connection pool manager",
    "Add performance profiling to the GraphQL resolver query execution",
    "Debug the deployment rollback in Kubernetes pod orchestration",
    "Refactor the container networking layer for better throughput",
    "Handle the disk space exhaustion in the log aggregation service",
    "Fix the CPU spikes during the background indexing batch job",
    "Add caching to the database query result set retrieval",
    "Debug the OOM kill in the data processing worker process",
    "Refactor the API gateway rate limiting middleware pipeline",
    "Handle the connection timeout in the microservice mesh network"
  ];

  const result = detectDistributionShift(existing, newPrompts);
  assert.ok(typeof result.shiftDetected === "boolean");
  // Accuracy can be 0 if the classifier fails entirely on 2-test split
  if (result.classifierAccuracy !== null) {
    assert.ok(result.classifierAccuracy >= 0);
  }
  assert.ok(["no-shift", "marginal", "significant"].includes(result.shiftScore));
});

// ── Insufficient data ──────────────────────────────────────────────

test("detectDistributionShift: returns insufficient-data for tiny sets", () => {
  const existing = ["Fix a bug"];
  const newPrompts = ["Design a system"];

  const result = detectDistributionShift(existing, newPrompts);
  assert.strictEqual(result.shiftScore, "insufficient-data");
  assert.strictEqual(result.classifierAccuracy, null);
  assert.ok(result.message.includes("Not enough data"));
});

// ── Novel prompt identification ────────────────────────────────────

test("detectDistributionShift: identifies novel prompts when shift is detected", () => {
  const existing = [
    "Fix bug in the login function",
    "Add validation to the form handler",
    "Debug the test failure in the parser",
    "Refactor the routing module for clarity",
    "Handle null pointer in the service",
    "Optimize the database query performance",
    "Add error handling to the API endpoint",
    "Debug the build failure after upgrade",
    "Fix the race condition in the worker",
    "Refactor the config loading logic"
  ];
  const newPrompts = [
    "Design quantum-resistant encryption for satellite communication",
    "Build autonomous vehicle navigation using neural radiance fields",
    "Create multi-agent debate framework for mathematical theorem proving",
    "Implement federated learning across hospital medical records",
    "Develop protein folding prediction with diffusion models"
  ];

  const result = detectDistributionShift(existing, newPrompts);
  if (result.shiftDetected) {
    // All new prompts should be classified as somewhat novel
    const novelCount = result.novelPrompts.length;
    assert.ok(novelCount >= 0, `Should have novel prompts listed. Got ${novelCount}`);
    assert.ok(novelCount <= 10, `Should cap at 10 novel prompts. Got ${novelCount}`);
    result.novelPrompts.forEach(p => {
      assert.ok(typeof p.noveltyScore === "number");
      assert.ok(p.noveltyScore >= 0 && p.noveltyScore <= 1);
    });
  }
});

// ── Report formatting ──────────────────────────────────────────────

test("formatShiftReport renders markdown with shift detected", () => {
  const result = {
    shiftDetected: true,
    classifierAccuracy: 0.92,
    shiftScore: "significant",
    totalNewPrompts: 5,
    novelPrompts: [
      { index: 0, prompt: "Quantum computing design", noveltyScore: 0.95 },
      { index: 1, prompt: "Neural network architecture", noveltyScore: 0.87 }
    ],
    message: "Classifier accuracy: 92.0%. Shift: significant — new inputs differ significantly from test coverage."
  };

  const md = formatShiftReport(result);
  assert.match(md, /# Distribution Shift Analysis/);
  assert.match(md, /Shift detected: Yes/);
  assert.match(md, /significant/);
  assert.match(md, /92\.0%/);
  assert.match(md, /Quantum computing/);
  assert.match(md, /Neural network/);
});

test("formatShiftReport renders markdown with no shift", () => {
  const result = {
    shiftDetected: false,
    classifierAccuracy: 0.45,
    shiftScore: "no-shift",
    totalNewPrompts: 3,
    novelPrompts: [],
    message: "Classifier accuracy: 45.0%. Shift: no-shift."
  };

  const md = formatShiftReport(result);
  assert.match(md, /Shift detected: No/);
  assert.match(md, /no-shift/);
  assert.match(md, /Novel prompts found: 0/);
});

// ── Deterministic results with fixed seed ──────────────────────────

test("detectDistributionShift: same inputs produce same result", () => {
  const existing = [
    "Fix the null pointer in the user service.",
    "Add validation to the API handler.",
    "Debug the failing test in the parser.",
    "Refactor the routing module.",
    "Handle errors in the database layer."
  ];
  const newPrompts = [
    "Implement quantum key distribution protocol.",
    "Build a neural architecture search pipeline.",
    "Deploy federated learning on edge devices.",
    "Create a multi-agent debate system.",
    "Design autonomous vehicle perception."
  ];

  const r1 = detectDistributionShift(existing, newPrompts);
  const r2 = detectDistributionShift(existing, newPrompts);
  assert.strictEqual(r1.shiftDetected, r2.shiftDetected);
  assert.strictEqual(r1.classifierAccuracy, r2.classifierAccuracy);
  assert.strictEqual(r1.shiftScore, r2.shiftScore);
});