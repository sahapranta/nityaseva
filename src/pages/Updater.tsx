import { useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; update: Update }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  const checkForUpdates = async (silent = false) => {
    setState({ status: "checking" });
    try {
      const update = await check();
      if (update?.available) {
        setState({ status: "available", update });
      } else {
        setState({ status: "idle" });
        if (!silent) alert("You are on the latest version.");
      }
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  };

  const installUpdate = async () => {
    if (state.status !== "available") return;
    const { update } = state;

    setState({ status: "downloading", progress: 0 });
    try {
      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          setState({ status: "downloading", progress: pct });
        } else if (event.event === "Finished") {
          setState({ status: "ready" });
        }
      });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  };

  const restart = async () => {
    await relaunch();
  };

  // Auto-check on launch (silent)
  useEffect(() => {
    const t = setTimeout(() => checkForUpdates(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return { state, checkForUpdates, installUpdate, restart };
}

// ── Update dialog component ───────────────────────────────────────────
export function UpdaterDialog() {
  const { state, installUpdate, restart } = useUpdater();

  if (state.status === "idle" || state.status === "checking") return null;

  if (state.status === "error") {
    return (
      <div className="toast" style={{ borderColor: "var(--color-danger)" }}>
        <span>⚠</span> Update check failed: {state.message}
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">
            {state.status === "ready" ? "✅ Update Ready" : "🆕 Update Available"}
          </div>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {state.status === "available" && (
            <>
              <p style={{ fontSize: 14 }}>
                A new version of Nityaseva is available.
                {state.update.version && (
                  <> Version <strong>{state.update.version}</strong> is ready to download.</>
                )}
              </p>
              {state.update.body && (
                <div style={{
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border-soft)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  whiteSpace: "pre-wrap",
                  maxHeight: 160,
                  overflowY: "auto",
                }}>
                  {state.update.body}
                </div>
              )}
            </>
          )}

          {state.status === "downloading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 14 }}>Downloading update…</p>
              <div style={{
                height: 8, background: "var(--color-surface-4)",
                borderRadius: 99, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${state.progress}%`,
                  background: "var(--color-saffron-500)",
                  borderRadius: 99,
                  transition: "width 300ms",
                }} />
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center" }}>
                {state.progress}%
              </p>
            </div>
          )}

          {state.status === "ready" && (
            <p style={{ fontSize: 14 }}>
              Update downloaded successfully. Restart Nityaseva to apply the update.
            </p>
          )}
        </div>

        <div className="modal-footer">
          {state.status === "available" && (
            <>
              <button className="btn btn-secondary" onClick={() => {}}>Later</button>
              <button className="btn btn-primary" onClick={installUpdate}>
                Download & Install
              </button>
            </>
          )}
          {state.status === "downloading" && (
            <button className="btn btn-secondary" disabled>Downloading…</button>
          )}
          {state.status === "ready" && (
            <button className="btn btn-primary" onClick={restart}>
              Restart Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Manual check button (add to Settings or topbar)
export function CheckUpdatesButton() {
  const { state, checkForUpdates } = useUpdater();
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={() => checkForUpdates(false)}
      disabled={state.status === "checking"}
    >
      {state.status === "checking" ? "Checking…" : "Check for Updates"}
    </button>
  );
}