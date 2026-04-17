#!/usr/bin/env bash
# clr wrapper: invokes cursor-agent in --print mode with the joined argv as the prompt.
#
# clr's driver passes the prompt as space-split argv tokens (see
# cli-runner-learner/src/runner/driver.ts). cursor-agent accepts variadic
# positional prompts natively, but we wrap for two reasons:
#   1. Symmetry with claude-print.sh (which needs the join).
#   2. Bake in --print, --output-format text, and the model flag so profiles
#      remain data-only.
#
# Usage: agent-print.sh <prompt-tokens...>
# Env:   AGENT_MODEL (default: gpt-5.4-medium)
set -euo pipefail

MODEL="${AGENT_MODEL:-gpt-5.4-medium}"
PROMPT="$*"

if [ -z "$PROMPT" ]; then
  echo "agent-print.sh: empty prompt" >&2
  exit 2
fi

exec cursor-agent --trust -p --output-format text --model "$MODEL" "$PROMPT"
