import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";
import { AuthProvider } from "./contexts/AuthContext";
import { LangProvider } from "./contexts/LangContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LangProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LangProvider>
  </React.StrictMode>,
);

// ── Splash screen coordination ────────────────────────────────────────
async function setup() {
  console.log("Frontend setup starting…");
  try {
    await invoke("set_complete", { task: "frontend" });
    console.log("Frontend marked complete");
  } catch (e) {
    console.error("Invoke failed:", e);
  }
}

window.addEventListener("DOMContentLoaded", () => setup());