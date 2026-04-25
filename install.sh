#!/usr/bin/env bash
# install.sh -- Remote bootstrap installer for Agent Historic.
# Usage: bash <(curl -fsSL <host>/install.sh) [install.js options]
#
# Downloads the repo tarball and runs `node install.js` from it.
# Requirements: curl, tar, node. (Node is required by the build step.)

set -euo pipefail

REPO_SLUG="${AGENT_HISTORIC_REPO:-barretts/AgentHistoric}"
REPO_REF="${AGENT_HISTORIC_REF:-main}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required for remote install."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required for remote install. Install Node.js >= 18 and retry."
  exit 1
fi

TARBALL_URL="https://github.com/${REPO_SLUG}/archive/refs/heads/${REPO_REF}.tar.gz"

echo "==> agent-historic remote bootstrap"
echo "    Repo: ${REPO_SLUG}@${REPO_REF}"
echo ""
echo "--> Downloading tarball..."

curl -fsSL "$TARBALL_URL" | tar -xz -C "$TMP_DIR"

# GitHub tarballs extract to <RepoName>-<ref>/
REPO_DIR="$(ls -d "$TMP_DIR"/*/ | head -1)"

echo ""
echo "--> Running install.js..."
node "${REPO_DIR}install.js" "$@"
