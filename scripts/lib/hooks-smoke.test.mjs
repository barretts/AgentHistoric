// Pure (no-API) smoke tests for the shell-logging hooks.
//
// Covers:
//   - hooks/log-shell-output.sh in --mode=cursor|claude|codex|gemini
//   - hooks/opencode-log-shell-output.js (evaluateCommand)
//
// Three deterministic cases per mode:
//   1. Allow case          -> short read-only command, expect allow
//   2. Already-redirected  -> denylist-shaped command but pre-piped to .logs/, expect allow
//   3. Denylist hit        -> long-running command without redirect, expect ask/nudge

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateCommand,
} from '../../hooks/opencode-log-shell-output.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const BASH_HOOK = path.join(repoRoot, 'hooks', 'log-shell-output.sh');

// --- Helpers ---------------------------------------------------------------

function runBashHook({ mode, payload }) {
  const result = spawnSync('bash', [BASH_HOOK, `--mode=${mode}`], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`hook exited ${result.status}: ${result.stderr}`);
  }
  const stdout = result.stdout.trim();
  if (!stdout) return {};
  try {
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Hook stdout was not JSON: ${stdout}\n(${err.message})`);
  }
}

function payloadFor(mode, command) {
  if (mode === 'cursor') return { command };
  // claude/codex/gemini share the Claude PreToolUse contract
  return { tool_name: 'Bash', tool_input: { command } };
}

function expectAllow(out, mode) {
  if (mode === 'cursor') {
    assert.equal(out.permission, 'allow', `cursor allow expected, got ${JSON.stringify(out)}`);
  } else {
    assert.equal(
      out.hookSpecificOutput?.permissionDecision,
      'allow',
      `${mode} allow expected, got ${JSON.stringify(out)}`,
    );
  }
}

function expectAsk(out, mode) {
  if (mode === 'cursor') {
    assert.equal(out.permission, 'ask', `cursor ask expected, got ${JSON.stringify(out)}`);
    assert.match(out.agentMessage || '', /TENET 3/);
  } else {
    assert.equal(
      out.hookSpecificOutput?.permissionDecision,
      'ask',
      `${mode} ask expected, got ${JSON.stringify(out)}`,
    );
    assert.match(out.hookSpecificOutput?.permissionDecisionReason || '', /TENET 3/);
  }
}

// --- Bash hook: 4 modes x 3 cases = 12 tests ------------------------------

const BASH_MODES = ['cursor', 'claude', 'codex', 'gemini'];

for (const mode of BASH_MODES) {
  describe(`HOOKS-SMOKE: bash hook --mode=${mode}`, () => {
    test('allow case: short read-only command', () => {
      const out = runBashHook({ mode, payload: payloadFor(mode, 'ls -la') });
      expectAllow(out, mode);
    });

    test('already-redirected: denylist-shape with .logs/ redirect', () => {
      const cmd = 'npm test > .logs/run-smoke-$(date +%s).log 2>&1';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('denylist hit: long-running command without redirect', () => {
      const out = runBashHook({ mode, payload: payloadFor(mode, 'npm test') });
      expectAsk(out, mode);
    });
  });
}

// --- OpenCode hook: 3 cases via evaluateCommand ---------------------------

describe('HOOKS-SMOKE: opencode plugin (evaluateCommand)', () => {
  test('allow case: short read-only command returns null', () => {
    assert.equal(evaluateCommand('ls -la'), null);
  });

  test('already-redirected: pre-piped to .logs/ returns null', () => {
    const cmd = 'npm test > .logs/run-smoke-$(date +%s).log 2>&1';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('denylist hit: returns { reason } containing TENET 3', () => {
    const verdict = evaluateCommand('npm test');
    assert.ok(verdict, 'expected a non-null verdict for denylist hit');
    assert.match(verdict.reason, /TENET 3/);
  });

  test('null/empty input is fail-open (returns null)', () => {
    assert.equal(evaluateCommand(''), null);
    assert.equal(evaluateCommand(null), null);
    assert.equal(evaluateCommand(undefined), null);
  });

  test('git read-only subcommands are allowed', () => {
    assert.equal(evaluateCommand('git status'), null);
    assert.equal(evaluateCommand('git log -n 5'), null);
  });

  test('node --version probe is allowed', () => {
    assert.equal(evaluateCommand('node --version'), null);
  });
});
