import path from "node:path";
import fs from "node:fs";

export function parseHandshake(content) {
  const re = /^\s*\[rules:loaded\s+init\s+router\s+experts@(\d+)\]/;
  const match = content.match(re);
  return match
    ? { present: true, count: parseInt(match[1], 10) }
    : { present: false, count: 0 };
}

export function parseTrailers(content) {
  const re = /Announce:\s*"Assimilated:\s*([a-zA-Z0-9_-]+)"/g;
  const found = [...content.matchAll(re)].map((m) => m[1]);
  return {
    present: found.length > 0,
    proportion: 1,
    found,
  };
}

export function parseTrailerCompliance(content, expectedIds) {
  const re = /Announce:\s*"Assimilated:\s*([a-zA-Z0-9_-]+)"/g;
  const found = [...content.matchAll(re)].map((m) => m[1]);
  const matched = expectedIds.filter((id) => found.includes(id));
  return {
    present: expectedIds.length > 0 && matched.length === expectedIds.length,
    proportion: expectedIds.length > 0 ? matched.length / expectedIds.length : 0,
    found,
  };
}

export function parseLoggingCompliance(toolCalls) {
  if (!toolCalls?.length) {
    return { proportion: 0, compliant: 0, total: 0 };
  }
  const re = /(?:>|\| tee)\s*\.logs\//;
  const runs = toolCalls.filter((t) => t.type === "run_command");
  const total = runs.length;
  const compliant = runs.filter((t) => re.test(t.command)).length;
  return {
    proportion: total > 0 ? compliant / total : 0,
    compliant,
    total,
  };
}

export function parseRoutingBlock(content) {
  const re = /Selected Expert.*\nReason.*\nConfidence/ms;
  return { present: re.test(content) };
}

export function parseUncertaintyLabeling(content) {
  const re = /\b(VERIFIED|HYPOTHESIS)\b/g;
  const sentences = content.split(/[.!?]/).filter((s) => s.trim().length > 10);
  const labeled = sentences.filter((s) => re.test(s));
  return {
    proportion: sentences.length > 0 ? labeled.length / sentences.length : 0,
    total: sentences.length,
    labeled: labeled.length,
  };
}

export function auditTranscript(transcript, expectedExpertIds = []) {
  return {
    id: transcript.id,
    handshake_present: parseHandshake(transcript.result).present,
    trailer_present_per_file: parseTrailerCompliance(transcript.result, expectedExpertIds).proportion,
    logging_compliance: parseLoggingCompliance(transcript.tool_calls ?? transcript.toolCalls ?? []).proportion,
    routing_block_present: parseRoutingBlock(transcript.result).present,
    uncertainty_labeling: parseUncertaintyLabeling(transcript.result).proportion,
  };
}

export function runAudit(transcripts) {
  const results = transcripts.map((t) => auditTranscript(t, t.expectedExpertIds ?? []));
  const n = results.length;
  return {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      handshakePresentRate: results.filter((r) => r.handshake_present).length / n,
      trailerPresentRate: results.reduce((sum, r) => sum + r.trailer_present_per_file, 0) / n,
      loggingComplianceRate: results.reduce((sum, r) => sum + r.logging_compliance, 0) / n,
      routingBlockPresentRate: results.filter((r) => r.routing_block_present).length / n,
      uncertaintyLabelingRate: results.reduce((sum, r) => sum + r.uncertainty_labeling, 0) / n,
    },
  };
}

export function writeReport(report, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "compliance-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const summaryLines = [
    `# Compliance Audit Report`,
    ``,
    `Generated: ${report.timestamp}`,
    ``,
    `| Check | Rate |`,
    `|-------|------|`,
    `| Handshake Present | ${(report.summary.handshakePresentRate * 100).toFixed(0)}% |`,
    `| Trailer Present | ${(report.summary.trailerPresentRate * 100).toFixed(0)}% |`,
    `| Logging Compliance | ${(report.summary.loggingComplianceRate * 100).toFixed(0)}% |`,
    `| Routing Block | ${(report.summary.routingBlockPresentRate * 100).toFixed(0)}% |`,
    `| Uncertainty Labeling | ${(report.summary.uncertaintyLabelingRate * 100).toFixed(0)}% |`,
    ``,
    `## Per-Transcript Results`,
    ``,
  ];

  for (const r of report.results) {
    summaryLines.push(`### ${r.id}`);
    summaryLines.push(`- Handshake: ${r.handshake_present ? "PASS" : "FAIL"}`);
    summaryLines.push(`- Logging: ${(r.logging_compliance * 100).toFixed(0)}%`);
    summaryLines.push(`- Routing Block: ${r.routing_block_present ? "PASS" : "FAIL"}`);
    summaryLines.push(`- Uncertainty: ${(r.uncertainty_labeling * 100).toFixed(0)}%`);
    summaryLines.push(``);
  }

  const summaryPath = path.join(outputDir, "compliance-summary.md");
  fs.writeFileSync(summaryPath, summaryLines.join("\n"));

  return { reportPath, summaryPath };
}
