# Nityaseva Development Guide

**Nityaseva** is a Tauri + React + Rust desktop application for spiritual/devotional practices.

## Project Structure

- **Frontend:** `src/` — React 19 + TypeScript + Vite
- **Backend:** `src-tauri/src/` — Rust with Tauri 2, Tokio async runtime
- **Config:** `src-tauri/tauri.conf.json` — windows, bundle targets, build hooks
- **Rust manifest:** `src-tauri/Cargo.toml`
- **Package:** `package.json` + `bun.lock` — Bun-based scripts and dependency lockfile

## Build & Development

**Package manager:** Bun (not npm/yarn)

```bash
bun install                 # install dependencies if needed
bun run dev                 # start Vite dev server for Tauri development
bun run build               # build frontend assets for production
bun run tauri -- [cmd]      # run Tauri CLI commands when needed
```

Notes:
- Vite is configured in `vite.config.ts` to use port `1420` with `strictPort: true`.
- `src-tauri/tauri.conf.json` uses `bun run dev` and `bun run build` as the frontend hooks.
- `src-tauri/tauri.conf.json` also defines both the splash screen and the hidden main window.

## Frontend-Backend Communication

Use Tauri's **IPC (invoke)** to call Rust commands from React:

```tsx
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("command_name", { arg1: value });
```

Current commands:
- `greet(name)` → returns greeting message from Rust

To add new commands:
1. Add `#[tauri::command]` function in `src-tauri/src/lib.rs`
2. Register it in `.invoke_handler(tauri::generate_handler![...])`
3. Call it from the frontend with `invoke("function_name", {...})`

## Key Technical Decisions

- **Async setup:** `src-tauri/src/lib.rs` spawns initialization tasks so windows can create while setup runs.
- **Splash screen + hidden main window:** startup flow is managed in `src-tauri/tauri.conf.json`.
- **macOS-specific support:** `tauri` is built with `macos-private-api` feature enabled.
- **Plugin usage:** `tauri-plugin-opener` is initialized in Rust.
- **Build isolation:** Vite ignores changes under `src-tauri` while running dev.

## Platform Targets

Configured for macOS, Windows, and Linux via Tauri bundling.

## Development Conventions

- Rust library is named `nityaseva_lib` in `Cargo.toml` to avoid Windows name conflicts.
- Keep styles co-located with React components (`App.css` next to `App.tsx`).
- Main frontend entry is `index.html`; splash screen is `splashscreen.html`.
- Use `src-tauri/src/lib.rs` for backend commands and `src/App.tsx` for frontend invoke usage.
