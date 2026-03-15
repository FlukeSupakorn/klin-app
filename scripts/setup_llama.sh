#!/bin/bash

set -euo pipefail

# Configuration
VERSION="b4864" # specify the llama.cpp release version
BIN_DIR="src-tauri/binaries"

mkdir -p "$BIN_DIR"

OS=$(uname -s)
ARCH=$(uname -m)

# Determine the correct release file based on OS and architecture
case "$OS" in
    Darwin)
        if [ "$ARCH" = "arm64" ]; then
            FILE="llama-${VERSION}-bin-macos-arm64.zip"
            TARGET_BIN="${BIN_DIR}/llama-server-aarch64-apple-darwin"
        else
            FILE="llama-${VERSION}-bin-macos-x64.zip"
            TARGET_BIN="${BIN_DIR}/llama-server-x86_64-apple-darwin"
        fi
        ;;
    Linux)
        # Add Linux specific binaries if needed, e.g CUDA
        if [ "$ARCH" = "x86_64" ]; then
            # Defaulting to ubuntu x64
            FILE="llama-${VERSION}-bin-ubuntu-x64.zip"
            TARGET_BIN="${BIN_DIR}/llama-server-x86_64-unknown-linux-gnu"
        else
            echo "Unsupported Linux architecture: $ARCH"
            exit 1
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        FILE="llama-${VERSION}-bin-win-vulkan-x64.zip"
        TARGET_BIN="${BIN_DIR}/llama-server-x86_64-pc-windows-msvc.exe"
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

URL="https://github.com/ggml-org/llama.cpp/releases/download/${VERSION}/${FILE}"
TMP_DIR=$(mktemp -d)

echo "Downloading llama.cpp ${VERSION} for ${OS} ${ARCH}..."
echo "URL: $URL"

if command -v curl >/dev/null 2>&1; then
    curl -L -o "${TMP_DIR}/${FILE}" "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget -O "${TMP_DIR}/${FILE}" "$URL"
else
    echo "Error: Neither curl nor wget is installed."
    exit 1
fi

echo "Extracting..."
unzip -q -o "${TMP_DIR}/${FILE}" -d "$TMP_DIR"

# Move the llama-server binary to the target location with the Tauri expected name
# Recent release zips place executables at archive root; older ones used build/bin.
case "$OS" in
    MINGW*|MSYS*|CYGWIN*)
        if [ -f "${TMP_DIR}/llama-server.exe" ]; then
            mv "${TMP_DIR}/llama-server.exe" "$TARGET_BIN"
        else
            mv "${TMP_DIR}/build/bin/llama-server.exe" "$TARGET_BIN"
        fi
        ;;
    *)
        if [ -f "${TMP_DIR}/llama-server" ]; then
            mv "${TMP_DIR}/llama-server" "$TARGET_BIN"
        else
            mv "${TMP_DIR}/build/bin/llama-server" "$TARGET_BIN"
        fi
        ;;
esac

# Ensure it's executable
chmod +x "$TARGET_BIN"

# Clean up
rm -rf "$TMP_DIR"

echo "Successfully installed llama-server to ${TARGET_BIN}"
