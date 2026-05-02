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
} from '../../hooks/opencode-log-shell-output-evaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const BASH_HOOK = path.join(repoRoot, 'hooks', 'log-shell-output.sh');

// --- Helpers ---------------------------------------------------------------

function runBashHook({ mode, payload }) {
  const result = spawnSync('bash', ['-c', 'printf "%s" "$HOOK_PAYLOAD" | "$HOOK_PATH" "$HOOK_MODE"'], {
    env: {
      ...process.env,
      HOOK_PATH: BASH_HOOK,
      HOOK_MODE: `--mode=${mode}`,
      HOOK_PAYLOAD: typeof payload === 'string' ? payload : JSON.stringify(payload),
    },
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
  } else if (mode === 'codex') {
    assert.deepEqual(out, {}, `codex allow must emit no unsupported permissionDecision, got ${JSON.stringify(out)}`);
  } else {
    assert.equal(
      out.hookSpecificOutput?.permissionDecision,
      'allow',
      `${mode} allow expected, got ${JSON.stringify(out)}`,
    );
  }
}

function expectAsk(out, mode) {
  let message;
  if (mode === 'cursor') {
    assert.equal(out.permission, 'ask', `cursor ask expected, got ${JSON.stringify(out)}`);
    message = out.agentMessage || '';
  } else if (mode === 'codex') {
    assert.deepEqual(
      Object.keys(out),
      ['systemMessage'],
      `codex ask should only emit systemMessage, got ${JSON.stringify(out)}`,
    );
    message = out.systemMessage || '';
  } else {
    assert.equal(
      out.hookSpecificOutput?.permissionDecision,
      'ask',
      `${mode} ask expected, got ${JSON.stringify(out)}`,
    );
    message = out.hookSpecificOutput?.permissionDecisionReason || '';
  }
  assert.match(message, /TENET 3/);
  assert.match(message, /REWRITE REQUIRED/);
  assert.match(message, /PowerShell pattern/);
  assert.doesNotMatch(message, /Approve only if/i);
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

    test('already-redirected: hidden logs directory redirect', () => {
      const cmd = 'npm run lint > .agent/logs/lint-$(date +%s).log 2>&1';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('already-redirected: absolute .logs path direct redirect', () => {
      const cmd = 'node /tmp/x.mjs > /Users/me/proj/.logs/foo.log 2>&1';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('already-redirected: home .logs path direct redirect', () => {
      const cmd = 'node /tmp/x.mjs > ~/proj/.logs/foo.log 2>&1';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('already-redirected: POSIX variable points to hidden logs directory', () => {
      const cmd = 'LOG=.agent/logs/lint-$(date +%s).log && npm run lint > "$LOG" 2>&1; echo "exit=$?"; tail -20 "$LOG"';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('already-redirected: POSIX variable points to absolute .logs path', () => {
      const cmd = 'LOG="/Users/me/proj/.logs/foo-$(date +%s).log"; node /tmp/x.mjs > "$LOG" 2>&1';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('already-redirected: bare whitelisted log variables', () => {
      for (const cmd of [
        'node /tmp/x.mjs > "$LOGFILE" 2>&1',
        'node /tmp/x.mjs > "$LOG_FILE" 2>&1',
        'node /tmp/x.mjs > $LOG 2>&1',
      ]) {
        const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
        expectAllow(out, mode);
      }
    });

    test('already-redirected: PowerShell redirect points to hidden logs directory', () => {
      const cmd = 'npm run lint *> .agent\\logs\\lint.log; Get-Content -Tail 20 .agent\\logs\\lint.log';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('already-redirected: PowerShell variable points to hidden logs directory', () => {
      const cmd = '$Log = ".agent\\logs\\lint.log"; npm run lint *> $Log; Get-Content -Tail 20 $Log';
      const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
      expectAllow(out, mode);
    });

    test('denylist hit: long-running command without redirect', () => {
      const out = runBashHook({ mode, payload: payloadFor(mode, 'npm test') });
      expectAsk(out, mode);
    });

    test('denylist hit: bare non-whitelisted log variables', () => {
      for (const cmd of [
        'node /tmp/x.mjs > "$OUTPUT" 2>&1',
        'node /tmp/x.mjs > "$FOO" 2>&1',
      ]) {
        const out = runBashHook({ mode, payload: payloadFor(mode, cmd) });
        expectAsk(out, mode);
      }
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

  test('already-redirected: hidden logs directory returns null', () => {
    const cmd = 'npm run lint > .agent/logs/lint-$(date +%s).log 2>&1';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('already-redirected: absolute .logs path returns null', () => {
    const cmd = 'node /tmp/x.mjs > /Users/me/proj/.logs/foo.log 2>&1';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('already-redirected: home .logs path returns null', () => {
    const cmd = 'node /tmp/x.mjs > ~/proj/.logs/foo.log 2>&1';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('already-redirected: POSIX variable hidden logs directory returns null', () => {
    const cmd = 'LOG=.agent/logs/lint-$(date +%s).log && npm run lint > "$LOG" 2>&1; echo "exit=$?"; tail -20 "$LOG"';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('already-redirected: POSIX variable absolute .logs path returns null', () => {
    const cmd = 'LOG="/Users/me/proj/.logs/foo-$(date +%s).log"; node /tmp/x.mjs > "$LOG" 2>&1';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('already-redirected: bare whitelisted log variables return null', () => {
    for (const cmd of [
      'node /tmp/x.mjs > "$LOGFILE" 2>&1',
      'node /tmp/x.mjs > "$LOG_FILE" 2>&1',
      'node /tmp/x.mjs > $LOG 2>&1',
    ]) {
      assert.equal(evaluateCommand(cmd), null);
    }
  });

  test('already-redirected: PowerShell direct redirect returns null', () => {
    const cmd = 'npm run lint *> .agent\\logs\\lint.log; Get-Content -Tail 20 .agent\\logs\\lint.log';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('already-redirected: PowerShell variable redirect returns null', () => {
    const cmd = '$Log = ".agent\\logs\\lint.log"; npm run lint *> $Log; Get-Content -Tail 20 $Log';
    assert.equal(evaluateCommand(cmd), null);
  });

  test('denylist hit: returns { reason } containing TENET 3', () => {
    const verdict = evaluateCommand('npm test');
    assert.ok(verdict, 'expected a non-null verdict for denylist hit');
    assert.match(verdict.reason, /TENET 3/);
    assert.match(verdict.reason, /REWRITE REQUIRED/);
    assert.match(verdict.reason, /PowerShell pattern/);
    assert.match(verdict.reason, /rc=\$\?/);
    assert.doesNotMatch(verdict.reason, /status=\$\?/);
    assert.doesNotMatch(verdict.reason, /exit \$status/);
    assert.doesNotMatch(verdict.reason, /Approve only if/i);
  });

  test('denylist hit: bare non-whitelisted log variables return TENET 3 verdict', () => {
    for (const cmd of [
      'node /tmp/x.mjs > "$OUTPUT" 2>&1',
      'node /tmp/x.mjs > "$FOO" 2>&1',
    ]) {
      const verdict = evaluateCommand(cmd);
      assert.ok(verdict, `expected a non-null verdict for ${cmd}`);
      assert.match(verdict.reason, /TENET 3/);
    }
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
