#!/usr/bin/env bash
# install.sh -- Remote bootstrap installer for Agent Historic.
# Usage: bash <(curl -fsSL <host>/install.sh) [install-local options]

set -euo pipefail

REPO_SLUG="${AGENT_HISTORIC_REPO:-barretts/AgentHistoric}"
REPO_REF="${AGENT_HISTORIC_REF:-main}"
LOCAL_INSTALLER="install-local.sh"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required for remote install."
  exit 1
fi

DOWNLOAD_URL="https://raw.githubusercontent.com/${REPO_SLUG}/${REPO_REF}/${LOCAL_INSTALLER}"
TARGET_SCRIPT="$TMP_DIR/$LOCAL_INSTALLER"

echo "==> agent-historic remote bootstrap"
echo "    Repo: ${REPO_SLUG}@${REPO_REF}"
echo "    URL:  ${DOWNLOAD_URL}"
echo ""

curl -fsSL "$DOWNLOAD_URL" -o "$TARGET_SCRIPT"
chmod +x "$TARGET_SCRIPT"

echo "--> Running local installer..."
bash "$TARGET_SCRIPT" "$@"
