#!/bin/bash

set -euo pipefail

# Configuration
REPO="ggml-org/llama.cpp"
REPO_URL="https://github.com/${REPO}.git"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="${PROJECT_ROOT}/src-tauri/binaries"
LOG_DIR="${PROJECT_ROOT}/scripts/logs"

mkdir -p "$BIN_DIR"
mkdir -p "$LOG_DIR"

OS=$(uname -s)
ARCH=$(uname -m)
RUN_ID=$(date -u +"%Y%m%dT%H%M%SZ")
BUILD_TIMESTAMP_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LATEST_WINDOWS_FILE="${LOG_DIR}/llama-build-latest-windows.json"
LATEST_MAC_FILE="${LOG_DIR}/llama-build-latest-mac.json"
LATEST_LINUX_FILE="${LOG_DIR}/llama-build-latest-linux.json"
START_EPOCH=$(date +%s)
TMP_DIR=""
BUILD_STATUS="failed"
TARGET_BIN=""
SERVER_BIN=""
SELECTED_GENERATOR=""
VULKAN_MODE="not-applicable"
LLAMA_COMMIT="unknown"
LLAMA_RELEASE_LINK=""
VERSION=""
BUILD_FINISHED_UTC=""
BUILD_DURATION_SECONDS=0
TARGET_BIN_SIZE_BYTES=0
TARGET_BIN_SIZE_MB="0.00"

OS_TAG="unknown"
case "$OS" in
    Darwin)
        OS_TAG="mac"
        ;;
    Linux)
        OS_TAG="linux"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        OS_TAG="windows"
        ;;
esac

json_escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e $'s/\t/\\t/g' -e $'s/\r/\\r/g'
}

log() {
    local msg="$*"
    echo "$msg"
}

file_size_bytes() {
    local file="$1"
    if stat -c%s "$file" >/dev/null 2>&1; then
        stat -c%s "$file"
    else
        wc -c < "$file" | tr -d '[:space:]'
    fi
}

cleanup_and_finalize() {
    local end_epoch duration platform_log_file
    end_epoch=$(date +%s)
    duration=$((end_epoch - START_EPOCH))
    BUILD_DURATION_SECONDS="$duration"
    BUILD_FINISHED_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    platform_log_file=""

    case "$OS_TAG" in
        windows)
            platform_log_file="$LATEST_WINDOWS_FILE"
            ;;
        mac)
            platform_log_file="$LATEST_MAC_FILE"
            ;;
        linux)
            platform_log_file="$LATEST_LINUX_FILE"
            ;;
    esac

    if [ -n "$platform_log_file" ]; then
        {
            echo "{"
            echo "  \"run_id\": \"$(json_escape "$RUN_ID")\","
            echo "  \"status\": \"$(json_escape "$BUILD_STATUS")\","
            echo "  \"build_date_utc\": \"$(json_escape "$BUILD_TIMESTAMP_UTC")\","
            echo "  \"finished_utc\": \"$(json_escape "$BUILD_FINISHED_UTC")\","
            echo "  \"duration_seconds\": ${BUILD_DURATION_SECONDS},"
            echo "  \"os\": \"$(json_escape "$OS")\","
            echo "  \"arch\": \"$(json_escape "$ARCH")\","
            echo "  \"llama_repo\": \"$(json_escape "$REPO_URL")\","
            echo "  \"llama_tag\": \"$(json_escape "$VERSION")\","
            echo "  \"llama_commit\": \"$(json_escape "$LLAMA_COMMIT")\","
            echo "  \"llama_release_link\": \"$(json_escape \"$LLAMA_RELEASE_LINK\")\","
            echo "  \"binary_size_bytes\": ${TARGET_BIN_SIZE_BYTES},"
            echo "  \"binary_size_mb\": ${TARGET_BIN_SIZE_MB},"
            echo "  \"vulkan_mode\": \"$(json_escape "$VULKAN_MODE")\","
            echo "  \"cmake_generator\": \"$(json_escape "$SELECTED_GENERATOR")\""
            echo "}"
        } > "$platform_log_file"
    fi

    [ -f "$LATEST_WINDOWS_FILE" ] || printf 'null\n' > "$LATEST_WINDOWS_FILE"
    [ -f "$LATEST_MAC_FILE" ] || printf 'null\n' > "$LATEST_MAC_FILE"
    [ -f "$LATEST_LINUX_FILE" ] || printf 'null\n' > "$LATEST_LINUX_FILE"

    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi

    if [ "$BUILD_STATUS" = "success" ]; then
        echo "Successfully built and installed llama-server"
        if [ -n "$platform_log_file" ]; then
            echo "Build metadata log: ${platform_log_file}"
        fi
        echo "Platform logs: ${LATEST_WINDOWS_FILE} ${LATEST_MAC_FILE} ${LATEST_LINUX_FILE}"
    else
        if [ -n "$platform_log_file" ]; then
            echo "Build failed. See metadata log: ${platform_log_file}"
        else
            echo "Build failed. Unknown OS tag for platform log: ${OS_TAG}"
        fi
        echo "Platform logs: ${LATEST_WINDOWS_FILE} ${LATEST_MAC_FILE} ${LATEST_LINUX_FILE}"
    fi
}

trap cleanup_and_finalize EXIT

# ── Prerequisites ────────────────────────────────────────────────────
for cmd in git cmake; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: ${cmd} is required but not installed."
        exit 1
    fi
done

# Verify a C++ compiler is available for non-Windows builds.
# Windows uses the Visual Studio generator (MSVC), which does not require c++/g++ in PATH.
if [[ "$OS" != MINGW* && "$OS" != MSYS* && "$OS" != CYGWIN* ]]; then
    if ! command -v c++ >/dev/null 2>&1 && ! command -v g++ >/dev/null 2>&1 && ! command -v clang++ >/dev/null 2>&1; then
        echo "Error: A C++ compiler (c++, g++, or clang++) is required."
        exit 1
    fi
fi

# ── Resolve latest version ───────────────────────────────────────────
log "Fetching latest release tag from ${REPO}..."
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

log "Latest version: ${VERSION}"
log "llama.repo=${REPO_URL}"
log "llama.tag=${VERSION}"
LLAMA_RELEASE_LINK="${REPO_URL%.git}/releases/tag/${VERSION}"
log "llama.release_link=${LLAMA_RELEASE_LINK}"

# ── Platform-specific settings ───────────────────────────────────────
CMAKE_EXTRA_FLAGS=()
WINDOWS_GENERATORS=()
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
        if command -v nvcc >/dev/null 2>&1; then
            CMAKE_EXTRA_FLAGS=("-DGGML_METAL=OFF" "-DGGML_CUDA=ON")
        else
            CMAKE_EXTRA_FLAGS=("-DGGML_METAL=OFF" "-DGGML_CUDA=OFF")
        fi
        SERVER_BIN="llama-server"
        NPROC=$(nproc)
        ;;
    MINGW*|MSYS*|CYGWIN*)
        TARGET_BIN="${BIN_DIR}/llama-server-x86_64-pc-windows-msvc.exe"
        # Force MSVC toolchain on Windows to avoid MinGW compatibility issues.
        # Try the newest supported Visual Studio generator first.
        WINDOWS_GENERATORS=(
            "Visual Studio 18 2026"
            "Visual Studio 17 2022"
            "Visual Studio 16 2019"
        )
        BUILD_CONFIG="Release"
        CMAKE_EXTRA_FLAGS=("-DGGML_VULKAN=ON")
        VULKAN_MODE="enabled"
        SERVER_BIN="llama-server.exe"
        NPROC=$(nproc 2>/dev/null || echo 4)
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

log "build.target_bin=${TARGET_BIN}"
log "build.server_bin=${SERVER_BIN}"
log "build.parallel=${NPROC}"
log "build.config=${BUILD_CONFIG:-Release}"

# ── Clone and build ──────────────────────────────────────────────────
TMP_DIR=$(mktemp -d)
log "Cloning llama.cpp ${VERSION}..."
git clone --depth 1 --branch "$VERSION" "$REPO_URL" "$TMP_DIR"
LLAMA_COMMIT=$(git -C "$TMP_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
log "llama.commit=${LLAMA_COMMIT}"

log "Building llama-server (static, release)..."

configure_windows_with_generators() {
    local -a extra_flags=("$@")
    for gen in "${WINDOWS_GENERATORS[@]}"; do
        log "Trying CMake generator: ${gen}"
        if cmake -G "$gen" -A x64 -B "${TMP_DIR}/build" -S "$TMP_DIR" \
            -DBUILD_SHARED_LIBS=OFF \
            -DLLAMA_BUILD_SERVER=ON \
            -DCMAKE_BUILD_TYPE=Release \
            "${extra_flags[@]}"; then
            SELECTED_GENERATOR="$gen"
            return 0
        fi
    done
    return 1
}

if [[ "$OS" == MINGW* || "$OS" == MSYS* || "$OS" == CYGWIN* ]]; then
    if ! configure_windows_with_generators "${CMAKE_EXTRA_FLAGS[@]}"; then
        if [[ " ${CMAKE_EXTRA_FLAGS[*]} " == *" -DGGML_VULKAN=ON "* ]]; then
            log "Vulkan configure failed; retrying with Vulkan disabled (CPU fallback)."
            rm -rf "${TMP_DIR}/build"
            CMAKE_EXTRA_FLAGS=("-DGGML_VULKAN=OFF")
            VULKAN_MODE="fallback-disabled"

            if ! configure_windows_with_generators "${CMAKE_EXTRA_FLAGS[@]}"; then
                echo "Error: Could not configure CMake with any supported Visual Studio generator."
                echo "Install Visual Studio Build Tools with 'Desktop development with C++'."
                exit 1
            fi
        else
            echo "Error: Could not configure CMake with any supported Visual Studio generator."
            echo "Install Visual Studio Build Tools with 'Desktop development with C++'."
            exit 1
        fi
    fi
else
    cmake -B "${TMP_DIR}/build" -S "$TMP_DIR" \
        -DBUILD_SHARED_LIBS=OFF \
        -DLLAMA_BUILD_SERVER=ON \
        -DCMAKE_BUILD_TYPE=Release \
        "${CMAKE_EXTRA_FLAGS[@]}"
fi

if [ -n "$SELECTED_GENERATOR" ]; then
    log "build.cmake_generator=${SELECTED_GENERATOR}"
fi
log "build.vulkan_mode=${VULKAN_MODE}"

BUILD_ARGS=(--target llama-server --parallel "$NPROC")
if [ -n "$BUILD_CONFIG" ]; then
    BUILD_ARGS=(--config "$BUILD_CONFIG" "${BUILD_ARGS[@]}")
fi

log "build.args=${BUILD_ARGS[*]}"
cmake --build "${TMP_DIR}/build" "${BUILD_ARGS[@]}"

# ── Install ──────────────────────────────────────────────────────────
FOUND_BIN=$(find "${TMP_DIR}/build" -name "$SERVER_BIN" -type f | head -1)

if [ -z "$FOUND_BIN" ]; then
    echo "Error: Build succeeded but could not find ${SERVER_BIN}."
    exit 1
fi

mv "$FOUND_BIN" "$TARGET_BIN"
chmod +x "$TARGET_BIN"

TARGET_BIN_SIZE_BYTES=$(file_size_bytes "$TARGET_BIN")
TARGET_BIN_SIZE_MB=$(awk -v bytes="$TARGET_BIN_SIZE_BYTES" 'BEGIN { printf "%.2f", bytes / 1048576 }')

BUILD_STATUS="success"
