import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";
import { AuthProvider } from "./Auth";
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

function sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function setup() {    
    console.log('Performing really heavy frontend setup task...')
    await sleep(3);
    console.log('Frontend setup task complete!')
    try {
        await invoke('set_complete', { task: 'frontend' });
        console.log('Frontend marked complete');
    } catch (e) {
        console.error('Invoke failed:', e);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    setup()
});