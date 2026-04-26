#!/usr/bin/env bash
# Enforce Tenet 3: long-running shell commands must write stdout+stderr to .logs/.
#
# Supports two host shapes via --mode:
#   --mode=cursor   stdin: {"command": "..."}
#                   stdout: {"permission": "allow|ask", "userMessage": "...", "agentMessage": "..."}
#   --mode=claude   stdin: {"tool_name":"Bash","tool_input":{"command":"..."}}
#                   stdout: {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow|ask","permissionDecisionReason":"..."}}
#
# failClosed is handled by the host: if this script crashes or times out, the host
# falls back to its default (allow). We therefore bias toward `allow` on uncertainty.

set -u

MODE="cursor"
for arg in "$@"; do
  case "$arg" in
    --mode=cursor) MODE="cursor" ;;
    --mode=claude) MODE="claude" ;;
  esac
done

INPUT="$(cat)"

# Only Bash tool calls in Claude carry a shell command. Non-Bash -> allow silently.
if [ "$MODE" = "claude" ]; then
  TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
  if [ -n "$TOOL_NAME" ] && [ "$TOOL_NAME" != "Bash" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'
    exit 0
  fi
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  CMD=$(printf '%s' "$INPUT" | jq -r '.command // empty' 2>/dev/null)
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
  local user_msg="$1"
  local agent_msg="$2"
  if [ "$MODE" = "claude" ]; then
    # Claude supports deny/ask/allow; we use "ask" so user can still approve.
    jq -n --arg reason "$agent_msg" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$reason}}'
  else
    jq -n --arg u "$user_msg" --arg a "$agent_msg" \
      '{permission:"ask", userMessage:$u, agentMessage:$a}'
  fi
  exit 0
}

# Empty or unparseable -> allow (fail open).
[ -z "$CMD" ] && emit_allow

# 1. Already-redirected commands -> allow.
#    Matches: > .logs/...  >> .logs/...  | tee .logs/...  > /dev/null  >/dev/null
if printf '%s' "$CMD" | grep -qE '(>>?[[:space:]]*\.logs/|\|[[:space:]]*tee[[:space:]]+(-a[[:space:]]+)?\.logs/|>[[:space:]]*/dev/null|>/dev/null)'; then
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
  USER_MSG="Long-running shell command without \`.logs/\` redirect. Recommend re-issue with \`> .logs/run-<slug>-\$(date +%s).log 2>&1\`. See Tenet 3."
  AGENT_MSG="TENET 3 VIOLATION: this command will lose context if the terminal dies. Re-issue as: mkdir -p .logs && LOG=\".logs/run-<slug>-\$(date +%s).log\" && (your command) > \"\$LOG\" 2>&1 ; then tail -n 50 \"\$LOG\" to inspect. Approve only if you have accepted the data-loss risk."
  emit_ask "$USER_MSG" "$AGENT_MSG"
fi

# 4. Default: allow.
emit_allow
