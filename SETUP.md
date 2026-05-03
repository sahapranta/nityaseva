# Nityaseva — Theme Setup Instructions

## 1. Install Tailwind CSS v4

```bash
bun add -D tailwindcss@next @tailwindcss/vite
```

## 2. Update vite.config.ts

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
});
```

## 3. Replace files

- Copy `src/index.css`  → replaces your existing `src/index.css`
- Copy `src/App.tsx`    → replaces your existing `src/App.tsx`

## 4. Update src/main.tsx (if not already importing css)

```tsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 5. Add Bengali font to index.html

Add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

## 6. Run

```bash
bun run dev
```

---

## What you get

- `app-shell` grid layout: sidebar (220px) + topbar (44px) + scrollable content
- Saffron/maroon brand palette (spiritual tone)
- Desktop-feel components: `card`, `stat-card`, `table`, `badge`, `btn`, `input`, `modal`
- EN / বাং language toggle stub in topbar (wired up in Phase 4)
- Sidebar with grouped nav, active state highlighting
- Dashboard with stat cards + two data tables (dummy data for now)
