#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="${PROJECT_ROOT}/src-tauri/binaries"
LOG_DIR="${PROJECT_ROOT}/scripts/logs"

OS=$(uname -s)
ARCH=$(uname -m)

# Mirror naming convention from setup_llama.sh
case "$OS" in
    Darwin)
        if [ "$ARCH" = "arm64" ]; then
            TARGET_BIN="${BIN_DIR}/llama-server-aarch64-apple-darwin"
        else
            TARGET_BIN="${BIN_DIR}/llama-server-x86_64-apple-darwin"
        fi
        ;;
    Linux)
        TARGET_BIN="${BIN_DIR}/llama-server-x86_64-unknown-linux-gnu"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        TARGET_BIN="${BIN_DIR}/llama-server-x86_64-pc-windows-msvc.exe"
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

if [ ! -f "$TARGET_BIN" ]; then
    echo "llama-server binary not found: $TARGET_BIN"
    echo "Run setup_llama.sh to build it first."
    exit 1
fi

# --- Runtime version from binary ---
echo "=== Binary ==="
echo "Path: $TARGET_BIN"
echo "Size: $(du -sh "$TARGET_BIN" | cut -f1)"

echo ""
echo "=== Runtime Version ==="
"$TARGET_BIN" --version 2>&1 || echo "(--version not supported)"

# --- Build metadata from log ---
OS_TAG="unknown"
case "$OS" in
    Darwin) OS_TAG="mac" ;;
    Linux)  OS_TAG="linux" ;;
    MINGW*|MSYS*|CYGWIN*) OS_TAG="windows" ;;
esac

LOG_FILE="${LOG_DIR}/llama-build-latest-${OS_TAG}.json"

if [ -f "$LOG_FILE" ] && [ "$(cat "$LOG_FILE")" != "null" ]; then
    echo ""
    echo "=== Build Metadata ==="
    # Parse without jq dependency
    grep -E '"(llama_tag|llama_release_link|build_date_utc|binary_size_mb|vulkan_mode)"' "$LOG_FILE" \
        | sed 's/^[[:space:]]*//' \
        | sed 's/",$/"/; s/: "/: /'
fi