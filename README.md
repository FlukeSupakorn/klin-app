# KLIN App

Desktop AI file organizer built with Tauri, React, and a local `klin-worker` backend.

This README is for the `klin-app` repo. It explains the exact setup that currently works in development and what is expected for production packaging.

## What ships in this app

- React + Vite frontend
- Tauri desktop shell
- `klin-worker` sidecar for local API/database work
- `llama-server` sidecar for local chat and embedding inference
- Windows `llama-server` runtime DLLs in [`src-tauri/binaries`](C:\Work\MyProject\Senior-Project\klin-app\src-tauri\binaries)

Users do not need to install `llama.cpp` separately if you package the app correctly. The app still needs model files.

## Supported runtime modes

KLIN supports two development modes:

1. `Sidecar mode`
   - Tauri spawns `klin-worker`
   - Tauri spawns `llama-server` for chat/embed when needed
   - best default for app development

2. `External worker mode`
   - you run `klin-worker` yourself from the worker repo
   - Tauri still spawns `llama-server` for chat/embed
   - useful when developing worker code with reload

## Prerequisites

Install these first:

- Bun `1.2+`
- Rust stable toolchain
- Tauri v2 system prerequisites for your OS
- Python and `uv` if you want external worker mode

On Windows, make sure WebView2 is installed.

## Model files

Place model files in [`models`](C:\Work\MyProject\Senior-Project\klin-app\models).

Current working local setup:

- chat model:
  - `Qwen2.5-VL-3B-Instruct-IQ4_XS.gguf`
- embedding model:
  - `Qwen3-Embedding-0.6B-f16.gguf`

Important:

- If you use a VL chat model, you should also provide the matching `mmproj` file for full vision support.
- Text chat may start without `mmproj`, but production reliability is better with it configured.

## Environment file

Create [`klin-app/.env`](C:\Work\MyProject\Senior-Project\klin-app\.env) from [`klin-app/.env.example`](C:\Work\MyProject\Senior-Project\klin-app\.env.example).

Example:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_SKIP_ONBOARDING=false

KLIN_WORKER_EXTERNAL=false

KLIN_CHAT_MODEL_PATH="C:\Work\MyProject\Senior-Project\klin-app\models\Qwen2.5-VL-3B-Instruct-IQ4_XS.gguf"
KLIN_MODEL_PATH="C:\Work\MyProject\Senior-Project\klin-app\models\Qwen2.5-VL-3B-Instruct-IQ4_XS.gguf"
KLIN_EMBED_MODEL_PATH="C:\Work\MyProject\Senior-Project\klin-app\models\Qwen3-Embedding-0.6B-f16.gguf"
KLIN_MMPROJ_PATH=""
KLIN_N_GPU_LAYERS=-1
KLIN_CTX_SIZE=4096
```

Notes:

- Keep Windows paths quoted.
- `KLIN_MODEL_PATH` is kept for compatibility, but chat should use `KLIN_CHAT_MODEL_PATH`.
- `KLIN_WORKER_EXTERNAL=false` means sidecar mode.

## Quick start

From [`klin-app`](C:\Work\MyProject\Senior-Project\klin-app):

```bash
bun install
```

Then run:

```bash
bun tauri dev
```

If everything is configured correctly:

- Vite starts on `http://localhost:1420`
- Tauri launches the desktop app
- `klin-worker` sidecar starts automatically
- `llama-server` chat/embed are started lazily when onboarding or AI features need them

## Recommended dev flow: sidecar mode

Use this when you want the app to behave like production.

### 1. Set `.env`

```env
KLIN_WORKER_EXTERNAL=false
```

### 2. Do not run worker manually

Do not start `uv run ...` in another terminal.

### 3. Run the app

From [`klin-app`](C:\Work\MyProject\Senior-Project\klin-app):

```bash
bun tauri dev
```

Expected startup behavior:

- `klin-worker` is spawned by Tauri
- onboarding saves base path and categories into the worker database
- `embed` starts on `127.0.0.1:8081` when needed
- `chat` starts on `127.0.0.1:8080` when needed

## External worker mode

Use this only when you want live-reload while editing the Python worker.

### 1. Set app `.env`

```env
KLIN_WORKER_EXTERNAL=true
```

### 2. Start worker manually

From [`klin-worker`](C:\Work\MyProject\Senior-Project\klin-worker):

```powershell
$env:KLIN_APP_DATA_DIR="C:\Users\<YOUR_USER>\AppData\Roaming\com.klin.app"
uv sync
uv run python main.py --reload
```

Important:

- the external worker must use the same `KLIN_APP_DATA_DIR` as the app
- otherwise the worker and app will read different databases

### 3. Start the app

From [`klin-app`](C:\Work\MyProject\Senior-Project\klin-app):

```bash
bun tauri dev
```

In this mode:

- Tauri does not spawn `klin-worker`
- Tauri still manages `llama-server` sidecars

## Onboarding flow

Current intended onboarding flow:

1. User walks through tabs.
2. Each tab stores changes in frontend onboarding state only.
3. Nothing important is committed until `Launch`.
4. On `Launch`, the app:
   - ensures embed server is available
   - saves default base path
   - creates or updates categories
   - saves watcher config
5. Existing categories should not block onboarding.

Default base path behavior:

- onboarding initializes to `Downloads/KLIN`
- user can change it before launch
- that chosen value is what gets written to the worker

## Production packaging

For production builds:

- keep `KLIN_WORKER_EXTERNAL=false`
- ship `klin-worker` as a sidecar
- ship `llama-server` as a sidecar
- ship the required Windows `.dll` files together with `llama-server`
- either:
  - bundle model files, or
  - download/select them during onboarding

Production users should not need to install `llama.cpp` themselves.

They will still need:

- model files
- `mmproj` file too, if you want VL features to work reliably

## No `llma.sh` setup step

There is currently no `llma.sh` or equivalent setup script in this repo.

That means setup is controlled by:

- [`klin-app/.env`](C:\Work\MyProject\Senior-Project\klin-app\.env)
- sidecar binaries in [`src-tauri/binaries`](C:\Work\MyProject\Senior-Project\klin-app\src-tauri\binaries)
- model files in [`models`](C:\Work\MyProject\Senior-Project\klin-app\models)

If you add a future bootstrap script, document it here, but it is not required for the current working flow.

## Useful commands

From [`klin-app`](C:\Work\MyProject\Senior-Project\klin-app):

```bash
bun run dev:vite
bun tauri dev
bun run build
bun tauri build
bun.cmd run lint
```

## Troubleshooting

### `KLIN_EMBED_MODEL_PATH not set`

Check:

- `.env` exists at [`klin-app/.env`](C:\Work\MyProject\Senior-Project\klin-app\.env)
- the path is quoted on Windows
- the embedding model file actually exists

### `127.0.0.1:8081/health` refused

This means embed did not start. Check:

- model path is valid
- `llama-server` sidecar binary exists
- required DLLs exist in [`src-tauri/binaries`](C:\Work\MyProject\Senior-Project\klin-app\src-tauri\binaries)
- no stale `llama-server.exe` process is blocking startup

### Categories do not appear in settings

If using external worker mode, make sure:

- `KLIN_WORKER_EXTERNAL=true`
- the worker is running
- worker uses the same `KLIN_APP_DATA_DIR` as the app

### Tauri build says `Access is denied`

Usually stale processes are locking sidecar files. Stop them and retry:

```powershell
Get-Process | Where-Object {
  $_.ProcessName -eq 'klin-worker' -or
  $_.ProcessName -eq 'klin-app' -or
  $_.ProcessName -eq 'llama-server' -or
  $_.ProcessName -eq 'cargo' -or
  $_.ProcessName -eq 'rustc'
} | Stop-Process -Force
```

## Related docs

- Worker backend guide: [`klin-worker/README.md`](C:\Work\MyProject\Senior-Project\klin-worker\README.md)
- Tauri config: [`src-tauri/tauri.conf.json`](C:\Work\MyProject\Senior-Project\klin-app\src-tauri\tauri.conf.json)
- App env template: [`.env.example`](C:\Work\MyProject\Senior-Project\klin-app\.env.example)
