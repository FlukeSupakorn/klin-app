# Klin App

Automation-first AI-powered file organizer desktop app.

## Stack

- React 19 + TypeScript + Vite 7
- Tauri v2 (Rust backend)
- Zustand persisted stores
- React Router v6
- shadcn-style UI primitives + TailwindCSS + tailwind-animate
- Markdown: react-markdown + remark-gfm + @uiw/react-md-editor
- Icons: lucide-react
- Package manager: Bun

## Architecture

- Frontend: feature-first architecture under `src/features`
- Service abstraction: all Tauri IPC through `src/services/tauri-client.ts`
- AI scoring layer: `src/lib/ai-scoring-service.ts`
- Persisted stores: `src/stores/*`
- Rust clean architecture modules under `src-tauri/src/{domain,services,repositories,commands,infrastructure,dto}`

## Commands

```bash
bun install
bun run dev:vite
bun tauri dev
bun run build
bun tauri build
```

## Product Behavior

- Fully automatic scoring-based file flow
- Category scoring breakdown persisted per movement
- Category → folder mapping through rule engine
- No manual organize button
- No preview/confirmation dialogs
- No Python worker
- No environment variables
- No theme switching
