#!/usr/bin/env bash
# clr wrapper: invokes claude in --print mode with the joined argv as the prompt.
#
# claude does NOT accept split argv as a joined prompt -- it reads only the first
# token and waits on stdin. This wrapper re-joins all argv tokens and passes the
# result as a single quoted positional argument to claude -p.
#
# Usage: claude-print.sh <prompt-tokens...>
set -euo pipefail

PROMPT="$*"

if [ -z "$PROMPT" ]; then
  echo "claude-print.sh: empty prompt" >&2
  exit 2
fi

exec claude -p "$PROMPT"
