#!/bin/bash
# Quick install: copies plugin into a dsh repo
# Usage: ./install.sh /path/to/deepseek-harness
set -e
DSH_DIR=""
TARGET="/packages/web/browser-bridge"
echo "Installing dsh-browser-bridge to  ..."
mkdir -p ""
cp -r plugin/* "/"
echo "Done. Now configure per dsh-config/README.md"