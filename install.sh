#!/bin/bash
# Quick install: copies plugin into a dsh repo
# Usage: ./install.sh /path/to/deepseek-harness
set -e

DSH_DIR="${1:?Usage: ./install.sh /path/to/deepseek-harness}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$DSH_DIR/packages/web/browser-bridge"

echo "Installing dsh-browser-bridge to $TARGET ..."
mkdir -p "$TARGET"
cp -r "$SCRIPT_DIR/plugin/." "$TARGET/"
echo ""
echo "Done! Now configure dsh:"
echo "  1. cordis.patch.yml — see dsh-config/README.md"
echo "  2. package.json — add dependency"
echo "  3. tsconfig.host.json — add reference"
echo "  4. Restart dsh"
