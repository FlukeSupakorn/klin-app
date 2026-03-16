# Llama Server Setup Guide

How to set up `llama-server` for each platform.

## Prerequisites

### macOS

```bash
# Install Xcode Command Line Tools (provides git, clang++)
xcode-select --install

# Install cmake via Homebrew
brew install cmake
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install git cmake g++ build-essential
```

### Windows

1. Install [Git for Windows](https://git-scm.com/download/win)
2. Install [CMake](https://cmake.org/download/) (add to PATH during install)
3. Install [Visual Studio](https://visualstudio.microsoft.com/) with "Desktop development with C++" workload
4. Install [Vulkan SDK](https://vulkan.lunarg.com/sdk/home) for GPU acceleration

## Build & Install

Run from the project root or the `scripts/` directory:

```bash
./scripts/setup_llama.sh
```

On Windows (Git Bash / MSYS2):

```bash
bash ./scripts/setup_llama.sh
```

The script will:
- Fetch the latest llama.cpp release tag
- Clone and build a statically linked `llama-server`
- Place the binary in `src-tauri/binaries/`

## Verify Installation

### macOS

```bash
./src-tauri/binaries/llama-server-aarch64-apple-darwin --help
```

### Linux

```bash
./src-tauri/binaries/llama-server-x86_64-unknown-linux-gnu --help
```

### Windows

```powershell
.\src-tauri\binaries\llama-server-x86_64-pc-windows-msvc.exe --help
```

## Download a Model

You need a GGUF model file to run the server. Example using Qwen2.5:

```bash
mkdir -p models

# Download a small model for testing
curl -L -o models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf \
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
```

## Run Standalone (for testing)

### macOS

```bash
./src-tauri/binaries/llama-server-aarch64-apple-darwin \
  -m models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf \
  --port 8080 \
  -ngl -1 \
  -c 4096
```

### Linux

```bash
./src-tauri/binaries/llama-server-x86_64-unknown-linux-gnu \
  -m models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf \
  --port 8080 \
  -c 4096
```

### Windows

```powershell
.\src-tauri\binaries\llama-server-x86_64-pc-windows-msvc.exe `
  -m models\Qwen2.5-1.5B-Instruct-Q4_K_M.gguf `
  --port 8080 `
  -ngl -1 `
  -c 4096
```

### Common flags

| Flag | Description |
|------|-------------|
| `-m <path>` | Path to GGUF model file |
| `--port <n>` | HTTP port (default: 8080) |
| `-ngl <n>` | Number of layers to offload to GPU (`-1` = all) |
| `-c <n>` | Context size in tokens |
| `--embedding` | Enable embedding endpoint |

## Run with the App

The Tauri app manages `llama-server` automatically as a sidecar. Configure these environment variables in `.env`:

```bash
# Chat model
KLIN_CHAT_MODEL_PATH=./models/Qwen2.5-VL-3B-Instruct-IQ4_XS.gguf
KLIN_MMPROJ_PATH=./models/mmproj.gguf

# Embedding model 
KLIN_EMBED_MODEL_PATH=./models/nomic-embed-text-v1.5.Q8_0.gguf

# GPU layers (-1 = all)
KLIN_N_GPU_LAYERS=-1

# Context size
KLIN_CTX_SIZE=4096

# Ports
KLIN_CHAT_PORT=8080
KLIN_EMBED_PORT=8081

# Idle timeout in seconds (server stops after inactivity)
KLIN_LLAMA_IDLE_TIMEOUT=3000
```

Then start the app normally — `llama-server` will be spawned on demand.

## Troubleshooting

### `cmake is required but not installed`

Install cmake for your platform (see Prerequisites above).

### `Library not loaded: libmtmd.0.dylib`

You are using a pre-built binary from an older setup. Re-run the build script:

```bash
./scripts/setup_llama.sh
```

This builds a statically linked binary with no shared library dependencies.

### `Metal is not supported`

Only Apple Silicon (M1+) and Intel Macs with compatible GPUs support Metal. The build enables Metal automatically on macOS. On Linux, the server runs on CPU only (unless you add CUDA/ROCm flags).

### Build fails on Windows

Ensure Visual Studio's C++ workload is installed and you are running from a terminal that has the build tools in PATH (e.g. "x64 Native Tools Command Prompt" or Git Bash).

### Server crashes immediately

Check that your model file is a valid GGUF format and not corrupted. Re-download if needed.
