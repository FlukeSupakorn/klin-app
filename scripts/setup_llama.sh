#!/bin/bash

set -euo pipefail

# Configuration
REPO="ggml-org/llama.cpp"
REPO_URL="https://github.com/${REPO}.git"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="${PROJECT_ROOT}/src-tauri/binaries"

mkdir -p "$BIN_DIR"

OS=$(uname -s)
ARCH=$(uname -m)

# ── Prerequisites ────────────────────────────────────────────────────
for cmd in git cmake; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: ${cmd} is required but not installed."
        exit 1
    fi
done

# Verify a C++ compiler is available
if ! command -v c++ >/dev/null 2>&1 && ! command -v g++ >/dev/null 2>&1 && ! command -v clang++ >/dev/null 2>&1; then
    echo "Error: A C++ compiler (c++, g++, or clang++) is required."
    exit 1
fi

# ── Resolve latest version ───────────────────────────────────────────
echo "Fetching latest release tag from ${REPO}..."
if command -v curl >/dev/null 2>&1; then
    RELEASE_JSON=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest")
elif command -v wget >/dev/null 2>&1; then
    RELEASE_JSON=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest")
else
    echo "Error: Neither curl nor wget is installed."
    exit 1
fi

VERSION=$(echo "$RELEASE_JSON" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$VERSION" ]; then
    echo "Error: Failed to fetch latest release tag."
    exit 1
fi

echo "Latest version: ${VERSION}"

# ── Platform-specific settings ───────────────────────────────────────
CMAKE_EXTRA_FLAGS=()
CMAKE_GENERATOR_ARGS=()
BUILD_CONFIG=""
case "$OS" in
    Darwin)
        if [ "$ARCH" = "arm64" ]; then
            TARGET_BIN="${BIN_DIR}/llama-server-aarch64-apple-darwin"
        else
            TARGET_BIN="${BIN_DIR}/llama-server-x86_64-apple-darwin"
        fi
        CMAKE_EXTRA_FLAGS=("-DGGML_METAL=ON" "-DGGML_METAL_EMBED_LIBRARY=ON")
        SERVER_BIN="llama-server"
        NPROC=$(sysctl -n hw.ncpu)
        ;;
    Linux)
        if [ "$ARCH" = "x86_64" ]; then
            TARGET_BIN="${BIN_DIR}/llama-server-x86_64-unknown-linux-gnu"
        else
            echo "Unsupported Linux architecture: $ARCH"
            exit 1
        fi
        CMAKE_EXTRA_FLAGS=("-DGGML_METAL=OFF")
        SERVER_BIN="llama-server"
        NPROC=$(nproc)
        ;;
    MINGW*|MSYS*|CYGWIN*)
        TARGET_BIN="${BIN_DIR}/llama-server-x86_64-pc-windows-msvc.exe"
        # Force MSVC toolchain on Windows to avoid MinGW compatibility issues
        # (for example, CreateFile2-related failures in cpp-httplib).
        CMAKE_GENERATOR_ARGS=("-G" "Visual Studio 17 2022" "-A" "x64")
        BUILD_CONFIG="Release"
        CMAKE_EXTRA_FLAGS=("-DGGML_VULKAN=ON")
        SERVER_BIN="llama-server.exe"
        NPROC=$(nproc 2>/dev/null || echo 4)
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

# ── Clone and build ──────────────────────────────────────────────────
TMP_DIR=$(mktemp -d)
echo "Cloning llama.cpp ${VERSION}..."
git clone --depth 1 --branch "$VERSION" "$REPO_URL" "$TMP_DIR"

echo "Building llama-server (static, release)..."
cmake "${CMAKE_GENERATOR_ARGS[@]}" -B "${TMP_DIR}/build" -S "$TMP_DIR" \
    -DBUILD_SHARED_LIBS=OFF \
    -DLLAMA_BUILD_SERVER=ON \
    -DCMAKE_BUILD_TYPE=Release \
    "${CMAKE_EXTRA_FLAGS[@]}"

BUILD_ARGS=(--target llama-server --parallel "$NPROC")
if [ -n "$BUILD_CONFIG" ]; then
    BUILD_ARGS=(--config "$BUILD_CONFIG" "${BUILD_ARGS[@]}")
fi

cmake --build "${TMP_DIR}/build" "${BUILD_ARGS[@]}"

# ── Install ──────────────────────────────────────────────────────────
FOUND_BIN=$(find "${TMP_DIR}/build" -name "$SERVER_BIN" -type f | head -1)

if [ -z "$FOUND_BIN" ]; then
    echo "Error: Build succeeded but could not find ${SERVER_BIN}."
    rm -rf "$TMP_DIR"
    exit 1
fi

mv "$FOUND_BIN" "$TARGET_BIN"
chmod +x "$TARGET_BIN"

# Clean up
rm -rf "$TMP_DIR"

echo "Successfully built and installed llama-server to ${TARGET_BIN}"
