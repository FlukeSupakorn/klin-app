# KLIN App

Automation-first desktop file organizer built with Tauri + React.

KLIN helps you analyze dropped files, suggest categories and names, and track organization history from a single desktop UI.

## Tech Stack

- Frontend: React 19, TypeScript, Vite 7, React Router
- Desktop runtime: Tauri v2 (Rust)
- State: Zustand (with persisted slices)
- UI: Tailwind CSS, Radix UI primitives, lucide-react
- Tooling: Bun (package manager + scripts)

## Current App Scope

- Drag-and-drop or picker-based file intake for organize analysis
- Dashboard cards for organize flow, automation status, notes, and calendar
- History view with search/filter and expandable entry details
- Settings for category/default-folder/watched-folder management
- Google account connection for calendar/profile flows (OAuth token flow)
- Local API integration for organize, history, note summary, and calendar endpoints

## Prerequisites

Install these before running the app:

- Bun `>= 1.2`
- Rust toolchain (stable)
- Tauri system prerequisites for your OS

Windows users can follow the official Tauri prerequisites guide if WebView2/Rust toolchain is missing.

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Without this value, Google connect/auth features will stay in an error state.

For the AI runtime, you can choose between:

- bundled sidecar binaries for the normal packaged workflow
- locally run `llama-server` plus a source-run `klin-worker` in development

Start from [.env.example](.env.example) and enable the external-service flags only for the dev workflow.

## Getting Started

```bash
bun install
```

### Run web UI only (Vite)

```bash
bun run dev:vite
```

### Run desktop app (Tauri + Vite)

```bash
bun tauri dev
```

### Rebuild klin-worker sidecar binary

Only needed when you change Python source code in `klin-worker/`. The compiled binary lives in `src-tauri/binaries/` — Tauri spawns it automatically on `bun tauri dev`.

```bash
# 1. In the klin-worker repo — install deps including PyInstaller
cd ../klin-worker
uv sync --extra build

# 2. Build and copy binary to src-tauri/binaries/
.\build-sidecar.ps1          # Windows
pwsh ./build-sidecar.ps1     # macOS / Linux
```

After this, run `bun tauri dev` normally — no separate terminal needed.

### Run desktop app with source worker

1. Copy `.env.example` to `.env`.
2. In `.env`, enable:
	- `KLIN_WORKER_EXTERNAL=true`
3. Ensure `KLIN_CHAT_MODEL_PATH` is set in `.env` so Tauri launches the `llama-server` sidecar.
4. Start `klin-worker` from source in the worker repo:

```bash
uv run python main.py --reload
```

5. Start the desktop app:

```bash
bun tauri dev
```

### Build frontend bundle

```bash
bun run build
```

### Build desktop installer/binaries

```bash
bun tauri build
```

For the packaged workflow, keep `KLIN_WORKER_EXTERNAL` unset or false so Tauri uses the bundled sidecar binaries from [src-tauri/binaries](src-tauri/binaries).

## Available Scripts

- `bun run dev:vite` — start Vite dev server on port `1420`
- `bun run build` — TypeScript project build + Vite production build
- `bun run preview` — preview production web build
- `bun run lint` — TypeScript type-check (`tsc --noEmit`)
- `bun run api:organize` — run local API server on `http://localhost:3000`
- `bun tauri dev` — run desktop app in development mode
- `bun tauri build` — create production desktop build

## Project Structure (high level)

```text
src/
	app/            # Router + app-level boundaries
	components/     # Shared UI/layout building blocks
	features/       # Feature modules (dashboard, history, settings, auth, etc.)
	services/       # API + Tauri client + orchestration services
	stores/         # Zustand stores and slices
	types/          # Domain and IPC types

src-tauri/
	src/commands/   # Tauri command handlers
	src/services/   # Rust-side services
	src/domain/     # Domain models
	src/repositories/
```

## API Server Notes

- Frontend organize analysis currently targets:
	- `http://localhost:3000/organize`
	- `http://localhost:3000/organize/analyze`
- Start the local API server with:

```bash
bun run api:organize
```

- Bruno request definitions are available under `brunoapi/`.

## Google OAuth / Deep Link Notes

- Desktop deep link scheme is configured as `klin://auth`.
- Full setup/testing notes are in `GOOGLE_AUTH_DEEP_LINK_SETUP.md`.
- In practice, deep link callback behavior is reliable on built app binaries (`bun tauri build`) rather than dev runtime.

## Troubleshooting

- `Could not load suggestions... localhost:3000`
	- Ensure local API server is running: `bun run api:organize`
- `Missing VITE_GOOGLE_CLIENT_ID`
	- Add `VITE_GOOGLE_CLIENT_ID` to `.env` and restart the app
- Tauri build/dev startup issues
	- Re-check Rust + Tauri prerequisites and run `bun install` again
