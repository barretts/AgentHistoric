#!/usr/bin/env bash
# clr wrapper: invokes crush in non-interactive mode with the joined argv as the prompt.
#
# Crush uses `crush run "<prompt>"` for non-interactive output. clr's args-mode
# driver splits the input on spaces and passes each token as argv. Re-join here
# and pass as a single positional argument to `crush run` so the prompt stays
# intact.
#
# Why crush and not claude: this machine's `claude -p` hangs indefinitely
# (waits for TUI init that never settles). crush is a working stand-in that
# provides cross-model diversity alongside cursor-agent.
#
# Usage: crush-print.sh <prompt-tokens...>
set -euo pipefail

PROMPT="$*"

if [ -z "$PROMPT" ]; then
  echo "crush-print.sh: empty prompt" >&2
  exit 2
fi

# --quiet hides the spinner; these env vars further disable color/animation
# features that otherwise emit ANSI escape chatter (cursor moves, line clears,
# colored glamour markdown rendering) and would corrupt sentinel markers in a
# narrow PTY.
#
# Notes:
#   - NO_COLOR/CLICOLOR/CLICOLOR_FORCE/FORCE_COLOR: broad no-color hints.
#   - TERM=dumb asks the charm.land TUI stack to skip cursor-control sequences.
#   - GLAMOUR_STYLE=notty disables glamour markdown rendering.
#   - Crush still emits OSC 9;4 progress-bar escape codes (e.g. \x1b]9;4;3\x07)
#     continuously while running. These are stripped by the sentinel extractor's
#     OSC regex (`\x1b\][^\x07]*\x07`) and the wider PTY cols=10000, so they no
#     longer cause mid-JSON line wrap and do not affect correctness. They just
#     inflate transcript size a few kB.
export NO_COLOR=1
export CLICOLOR=0
export CLICOLOR_FORCE=0
export TERM=dumb
export GLAMOUR_STYLE=notty
export FORCE_COLOR=0

exec crush run --quiet "$PROMPT"
