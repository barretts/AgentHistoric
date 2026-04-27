#!/usr/bin/env bash
# Enforce Tenet 3: long-running shell commands must write stdout+stderr to a persistent log path.
#
# Supports four host shapes via --mode:
#   --mode=cursor   stdin: {"command": "..."}
#                   stdout: {"permission": "allow|ask", "userMessage": "...", "agentMessage": "..."}
#   --mode=claude   stdin: {"tool_name":"Bash","tool_input":{"command":"..."}}
#                   stdout: {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow|ask","permissionDecisionReason":"..."}}
#   --mode=codex    Claude-compatible JSON contract. Codex parses "ask"/"allow"
#                   but currently fails open on "ask"; the nudge still surfaces
#                   via permissionDecisionReason in the transcript.
#   --mode=gemini   Claude-compatible JSON contract per geminicli.com/docs/hooks.
#
# failClosed is handled by the host: if this script crashes or times out, the host
# falls back to its default (allow). We therefore bias toward `allow` on uncertainty.

set -u

MODE="cursor"
for arg in "$@"; do
  case "$arg" in
    --mode=cursor) MODE="cursor" ;;
    --mode=claude|--mode=codex|--mode=gemini) MODE="claude" ;;
  esac
done

INPUT="$(cat)"

# JSON helpers: prefer jq if installed, fall back to node (always present since
# the install script requires Node >= 18). Both fall back to empty string on
# parse failure -- empty CMD triggers fail-open allow downstream.
HAVE_JQ=0
if command -v jq >/dev/null 2>&1; then
  HAVE_JQ=1
fi

# json_get <input> <jq-path-or-dotpath>
# Examples: json_get "$INPUT" '.command'   json_get "$INPUT" '.tool_input.command'
json_get() {
  local input="$1" path="$2"
  if [ "$HAVE_JQ" -eq 1 ]; then
    printf '%s' "$input" | jq -r "$path // empty" 2>/dev/null
  else
    INPUT_FOR_NODE="$input" PATH_FOR_NODE="$path" node -e '
      try {
        const obj = JSON.parse(process.env.INPUT_FOR_NODE || "{}");
        const segs = (process.env.PATH_FOR_NODE || "").replace(/^\.+/, "").split(".").filter(Boolean);
        let v = obj;
        for (const s of segs) { v = v == null ? v : v[s]; }
        process.stdout.write(v == null ? "" : String(v));
      } catch { process.stdout.write(""); }
    ' 2>/dev/null
  fi
}

# json_ask <user_msg> <agent_msg>: emits the host-appropriate "ask" payload.
json_ask() {
  local user_msg="$1" agent_msg="$2" mode="$3"
  if [ "$HAVE_JQ" -eq 1 ]; then
    if [ "$mode" = "claude" ]; then
      jq -n --arg reason "$agent_msg" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$reason}}'
    else
      jq -n --arg u "$user_msg" --arg a "$agent_msg" \
        '{permission:"ask", userMessage:$u, agentMessage:$a}'
    fi
  else
    USER_FOR_NODE="$user_msg" AGENT_FOR_NODE="$agent_msg" MODE_FOR_NODE="$mode" node -e '
      const u = process.env.USER_FOR_NODE || "";
      const a = process.env.AGENT_FOR_NODE || "";
      const mode = process.env.MODE_FOR_NODE;
      const out = mode === "claude"
        ? { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: a } }
        : { permission: "ask", userMessage: u, agentMessage: a };
      process.stdout.write(JSON.stringify(out));
    '
    printf '\n'
  fi
}

# Only Bash tool calls in Claude/Codex/Gemini carry a shell command. Non-Bash -> allow silently.
if [ "$MODE" = "claude" ]; then
  TOOL_NAME=$(json_get "$INPUT" '.tool_name')
  if [ -n "$TOOL_NAME" ] && [ "$TOOL_NAME" != "Bash" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'
    exit 0
  fi
  CMD=$(json_get "$INPUT" '.tool_input.command')
else
  CMD=$(json_get "$INPUT" '.command')
fi

emit_allow() {
  if [ "$MODE" = "claude" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'
  else
    printf '{"permission":"allow"}\n'
  fi
  exit 0
}

emit_ask() {
  json_ask "$1" "$2" "$MODE"
  exit 0
}

# Empty or unparseable -> allow (fail open).
[ -z "$CMD" ] && emit_allow

LOG_PATH='(["'\'']?)(\.logs|\.([^/\\[:space:]"'\'']+)[/\\]([^/\\[:space:]"'\'']*logs|logs[^/\\[:space:]"'\'']*))[/\\]'
LOG_VAR='[A-Za-z_][A-Za-z0-9_]*'

# 1. Already-redirected commands -> allow.
#    Matches POSIX redirects/tee and PowerShell redirects/Tee-Object/Start-Transcript
#    to .logs/... or hidden directories with a logs path segment, plus /dev/null/NUL.
if printf '%s' "$CMD" | grep -qiE "(>>?[[:space:]]*$LOG_PATH|[0-9]*>>?[[:space:]]*$LOG_PATH|\\|[[:space:]]*tee[[:space:]]+(-a[[:space:]]+)?$LOG_PATH|Tee-Object([^;|]*[[:space:]])(-FilePath|-Path)[[:space:]]+$LOG_PATH|Start-Transcript([^;|]*[[:space:]])(-Path|-LiteralPath)[[:space:]]+$LOG_PATH|>[[:space:]]*/dev/null|>/dev/null|>[[:space:]]*NUL|>[[:space:]]*\\\$null)"; then
  emit_allow
fi

if printf '%s' "$CMD" | grep -qE "$LOG_VAR=$LOG_PATH" && printf '%s' "$CMD" | grep -qE ">>?[[:space:]]*\\\"?\\\$($LOG_VAR)\\\"?"; then
  emit_allow
fi

if printf '%s' "$CMD" | grep -qiE "\\\$[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*$LOG_PATH" && printf '%s' "$CMD" | grep -qE ">>?[[:space:]]*\\\"?\\\$[A-Za-z_][A-Za-z0-9_]*\\\"?"; then
  emit_allow
fi

# 2. Quick-probe allowlist (first executable token).
#    Cheap, read-only, bounded output. Strip leading "env VAR=x" and "sudo" if present.
FIRST=$(printf '%s' "$CMD" | awk '{
  i=1
  while ($i ~ /^[A-Z_][A-Z0-9_]*=/ || $i == "sudo" || $i == "env") i++
  print $i
}')

case "$FIRST" in
  echo|printf|pwd|which|cd|ls|cat|head|tail|wc|file|stat|true|false|exit|test|[|jq|yq|xmllint|sort|uniq|date|basename|dirname|realpath|readlink|hostname|whoami|id|uname|tty|env|export|type)
    emit_allow ;;
  rg|grep|ag|ack|find|fd|tree|mdfind|locate)
    # Read-only search tools. Output is bounded by user's pattern; allow.
    emit_allow ;;
  ps|pgrep|pkill|kill|lsof|netstat|ss|top|df|du|free|uptime)
    emit_allow ;;
  mkdir|touch|rm|mv|cp|ln|chmod|chown)
    # File ops rarely need logging; they do not spew failure traces.
    emit_allow ;;
  git)
    # Read-only git subcommands are fine. Anything else falls through to denylist.
    SUB=$(printf '%s' "$CMD" | awk '{print $2}')
    case "$SUB" in
      status|log|diff|show|branch|remote|rev-parse|config|tag|describe|reflog|stash|blame|ls-files|ls-tree|cat-file|shortlog|worktree) emit_allow ;;
    esac
    ;;
  gh)
    SUB=$(printf '%s' "$CMD" | awk '{print $2}')
    case "$SUB" in
      api|auth|repo|pr|issue|run|workflow|release|gist|label|ruleset|search|browse) emit_allow ;;
    esac
    ;;
  node|npm|npx|pnpm|yarn)
    # Version/help probes are safe.
    if printf '%s' "$CMD" | grep -qE -- '(--version|-v[[:space:]]*$|--help|-h[[:space:]]*$)'; then
      emit_allow
    fi
    ;;
esac

# 3. Long-running denylist. Scan the whole command string (handles pipes, && chains).
DENYLIST='(^|[[:space:]\|&;(`$])(npx[[:space:]]+(tsx|tsc|vitest|jest|playwright|mocha|ava|eslint|prettier|cypress|webpack|vite|nuxt|next|ts-node)|npm[[:space:]]+(run|test|install|ci|exec|publish|audit)|pnpm[[:space:]]+(install|run|test|exec|dlx|build|publish|audit)|yarn[[:space:]]+(install|run|test|build|exec|publish|audit)|bun[[:space:]]+(run|test|install|build)|node[[:space:]]+[^-][^[:space:]]*\.(m?js|cjs|ts)|node[[:space:]]+-e|tsx[[:space:]]+[^[:space:]]+|deno[[:space:]]+(run|test)|pytest|python3?[[:space:]]+-m[[:space:]]+pytest|python3?[[:space:]]+[^-][^[:space:]]*\.py|cargo[[:space:]]+(test|build|run|check|bench)|go[[:space:]]+(test|build|run|generate)|mvn[[:space:]]|gradlew?[[:space:]]|make([[:space:]]|$)|docker[[:space:]]+(build|run|compose)|terraform[[:space:]]+(plan|apply)|ansible-playbook|claude[[:space:]]+(-p|--print)|rake[[:space:]]|bundle[[:space:]]+(exec|install))'

if printf '%s' "$CMD" | grep -qE "$DENYLIST"; then
  USER_MSG="Long-running shell command without a persistent log redirect. The agent should rewrite and re-issue it with logging before asking for human intervention. See Tenet 3."
  AGENT_MSG="TENET 3 REWRITE REQUIRED: rewrite and re-issue this command with persistent logging instead of asking the human to accept data-loss risk. POSIX pattern: mkdir -p .logs && LOG=\".logs/run-<slug>-\$(date +%s).log\" && (your command) > \"\$LOG\" 2>&1; status=\$?; tail -n 50 \"\$LOG\"; exit \$status. PowerShell pattern: New-Item -ItemType Directory -Force .logs | Out-Null; \$Log = \".logs/run-<slug>-\$(Get-Date -Format yyyyMMddHHmmss).log\"; your command *> \$Log; \$Status = \$LASTEXITCODE; Get-Content -Tail 50 \$Log; exit \$Status."
  emit_ask "$USER_MSG" "$AGENT_MSG"
fi

# 4. Default: allow.
emit_allow
