// Enforce Tenet 3 inside OpenCode: nudge long-running bash commands toward
// persistent log redirection so transcripts survive a dropped terminal session.
//
// OpenCode plugins are loaded from `~/.config/opencode/plugins/*.{js,ts}` and
// receive lifecycle events. We hook `tool.call` to inspect bash invocations
// before the host executes them. The plugin biases toward allow on any error
// (fail-open) so a regex bug never breaks the host.
//
// Mirrors the allowlist/denylist of `hooks/log-shell-output.sh`. Keep these in
// sync if you change one.

const LOG_PATH_RE = String.raw`(["']?)(?:\.logs|\.([^/\\\s"']+)[/\\]([^/\\\s"']*logs|logs[^/\\\s"']*))[/\\]`;
const ALLOW_REDIRECT_RE = new RegExp(
  String.raw`(?:>>?\s*${LOG_PATH_RE}|[0-9]*>>?\s*${LOG_PATH_RE}|\|\s*tee\s+(-a\s+)?${LOG_PATH_RE}|Tee-Object(?:[^;|]*\s)(?:-FilePath|-Path)\s+${LOG_PATH_RE}|Start-Transcript(?:[^;|]*\s)(?:-Path|-LiteralPath)\s+${LOG_PATH_RE}|>\s*/dev/null|>/dev/null|>\s*NUL|>\s*\$null)`,
  'i',
);
const POSIX_LOG_VAR_RE = new RegExp(String.raw`\b([A-Za-z_][A-Za-z0-9_]*)=${LOG_PATH_RE}`);
const POWERSHELL_LOG_VAR_RE = new RegExp(String.raw`\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*${LOG_PATH_RE}`, 'i');

const ALLOW_FIRST_TOKEN = new Set([
  // Pure read / inspect.
  'echo', 'printf', 'pwd', 'which', 'cd', 'ls', 'cat', 'head', 'tail', 'wc',
  'file', 'stat', 'true', 'false', 'exit', 'test', '[', 'jq', 'yq', 'xmllint',
  'sort', 'uniq', 'date', 'basename', 'dirname', 'realpath', 'readlink',
  'hostname', 'whoami', 'id', 'uname', 'tty', 'env', 'export', 'type',
  // Read-only search.
  'rg', 'grep', 'ag', 'ack', 'find', 'fd', 'tree', 'mdfind', 'locate',
  // Process inspection.
  'ps', 'pgrep', 'pkill', 'kill', 'lsof', 'netstat', 'ss', 'top', 'df', 'du',
  'free', 'uptime',
  // File ops (rarely produce long output).
  'mkdir', 'touch', 'rm', 'mv', 'cp', 'ln', 'chmod', 'chown',
]);

const ALLOW_GIT_SUB = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'remote', 'rev-parse', 'config',
  'tag', 'describe', 'reflog', 'stash', 'blame', 'ls-files', 'ls-tree',
  'cat-file', 'shortlog', 'worktree',
]);

const ALLOW_GH_SUB = new Set([
  'api', 'auth', 'repo', 'pr', 'issue', 'run', 'workflow', 'release', 'gist',
  'label', 'ruleset', 'search', 'browse',
]);

const VERSION_PROBE_RE = /(--version|-v\s*$|--help|-h\s*$)/;

const DENYLIST_RE = new RegExp(
  '(^|[\\s|&;(`$])(' +
    'npx\\s+(tsx|tsc|vitest|jest|playwright|mocha|ava|eslint|prettier|cypress|webpack|vite|nuxt|next|ts-node)' +
    '|npm\\s+(run|test|install|ci|exec|publish|audit)' +
    '|pnpm\\s+(install|run|test|exec|dlx|build|publish|audit)' +
    '|yarn\\s+(install|run|test|build|exec|publish|audit)' +
    '|bun\\s+(run|test|install|build)' +
    '|node\\s+[^-]\\S*\\.(m?js|cjs|ts)' +
    '|node\\s+-e' +
    '|tsx\\s+\\S+' +
    '|deno\\s+(run|test)' +
    '|pytest' +
    '|python3?\\s+-m\\s+pytest' +
    '|python3?\\s+[^-]\\S*\\.py' +
    '|cargo\\s+(test|build|run|check|bench)' +
    '|go\\s+(test|build|run|generate)' +
    '|mvn\\s' +
    '|gradlew?\\s' +
    '|make(\\s|$)' +
    '|docker\\s+(build|run|compose)' +
    '|terraform\\s+(plan|apply)' +
    '|ansible-playbook' +
    '|claude\\s+(-p|--print)' +
    '|rake\\s' +
    '|bundle\\s+(exec|install)' +
  ')'
);

function firstExecutableToken(cmd) {
  // Strip leading "VAR=value" assignments and "sudo"/"env" prefixes.
  const tokens = cmd.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    if (/^[A-Z_][A-Z0-9_]*=/.test(tokens[i])) { i += 1; continue; }
    if (tokens[i] === 'sudo' || tokens[i] === 'env') { i += 1; continue; }
    break;
  }
  return tokens[i] || '';
}

/**
 * Decide whether a shell command needs a persistent logging nudge.
 * Returns null for "allow" (no modification needed) or { reason } to ask.
 */
export function evaluateCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return null;

  // 1. Already redirected -> allow.
  if (ALLOW_REDIRECT_RE.test(cmd)) return null;
  const posixLogVar = cmd.match(POSIX_LOG_VAR_RE)?.[1];
  if (posixLogVar && new RegExp(String.raw`>>?\s*"?\$${posixLogVar}"?`).test(cmd)) return null;
  const powershellLogVar = cmd.match(POWERSHELL_LOG_VAR_RE)?.[1];
  if (powershellLogVar && new RegExp(String.raw`>>?\s*"?\$${powershellLogVar}"?`, 'i').test(cmd)) return null;

  // 2. Allowlist by first executable token.
  const first = firstExecutableToken(cmd);
  if (ALLOW_FIRST_TOKEN.has(first)) return null;

  if (first === 'git') {
    const sub = cmd.trim().split(/\s+/)[1];
    if (sub && ALLOW_GIT_SUB.has(sub)) return null;
  }
  if (first === 'gh') {
    const sub = cmd.trim().split(/\s+/)[1];
    if (sub && ALLOW_GH_SUB.has(sub)) return null;
  }
  if (['node', 'npm', 'npx', 'pnpm', 'yarn'].includes(first)) {
    if (VERSION_PROBE_RE.test(cmd)) return null;
  }

  // 3. Denylist scan.
  if (DENYLIST_RE.test(cmd)) {
    return {
      reason:
        'TENET 3 REWRITE REQUIRED: rewrite and re-issue this command with persistent logging instead of asking the human to accept data-loss risk. ' +
        'POSIX pattern: mkdir -p .logs && LOG=".logs/run-<slug>-$(date +%s).log" && (your command) > "$LOG" 2>&1; rc=$?; tail -n 50 "$LOG"; exit $rc. ' +
        'PowerShell pattern: New-Item -ItemType Directory -Force .logs | Out-Null; $Log = ".logs/run-<slug>-$(Get-Date -Format yyyyMMddHHmmss).log"; your command *> $Log; $Status = $LASTEXITCODE; Get-Content -Tail 50 $Log; exit $Status.',
    };
  }

  // 4. Default: allow.
  return null;
}

export default async function loggingHook(_input) {
  return {
    hooks: {
      'tool.call': async (toolCall) => {
        try {
          if (!toolCall || toolCall.name !== 'bash') return toolCall;
          const cmd = toolCall?.args?.command;
          const verdict = evaluateCommand(cmd);
          if (!verdict) return toolCall;
          return { ...toolCall, blocked: true, reason: verdict.reason };
        } catch {
          // Fail open: never break the host because of our regex.
          return toolCall;
        }
      },
    },
  };
}
