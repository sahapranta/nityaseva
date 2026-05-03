# Nityaseva Development Guide

**Nityaseva** is a Tauri + React + Rust desktop application for spiritual/devotional practices.

## Project Structure

- **Frontend:** `src/` — React 19 + TypeScript + Vite
- **Backend:** `src-tauri/src/` — Rust with Tauri 2, Tokio async runtime
- **Config:** `tauri.conf.json` — Application windows, bundle settings
- **Package:** `package.json` — Dependencies, build scripts (uses Bun, not npm)

## Build & Development

**Package manager:** Bun (not npm/yarn)

```bash
bun run dev      # Start frontend dev server + Tauri dev mode
bun run build    # Build frontend (tsc + vite) and create production binary
bun tauri [cmd]  # Run Tauri CLI commands
```

**Important:** The app uses a **splash screen window** (splashscreen.html) that shows during startup, plus a hidden main window. The setup task calls `set_complete` commands to coordinate initialization.

## Frontend-Backend Communication

Use Tauri's **IPC (invoke)** to call Rust commands:

```tsx
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("command_name", { arg1: value });
```

**Current commands:**
- `greet(name)` → Returns greeting message from Rust

To add new commands:
1. Add `#[tauri::command]` function in `src-tauri/src/lib.rs`
2. Register in `.invoke_handler(tauri::generate_handler![...])` 
3. Call via `invoke("function_name", {...})` from React

## Key Technical Decisions

- **Async setup:** Rust runs setup tasks concurrently with window creation using `spawn()` and `SetupState`
- **macOS support:** Enables `macOS-private-api` for native OS integration
- **Window isolation:** Splash screen (non-resizable, transparent) + main app window (hidden on startup)
- **Multi-window IPC:** Both windows can communicate via Tauri events if needed

## Platform Targets

Configured for: macOS, Windows, Linux (via Tauri bundle)

## Development Conventions

- Rust lib uses `nityaseva_lib` (underscore) to avoid Windows name conflicts
- TypeScript strict mode enabled (`tsconfig.json`)
- CSS co-located with components (`App.css` next to `App.tsx`)
- HTML entry point: `index.html` (main app), `splashscreen.html` (splash window)
