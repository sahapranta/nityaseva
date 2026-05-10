import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SyncStatus {
  connected: boolean;
  last_synced: string | null;
  message: string;
}

// First-launch Turso setup screen
export function TursoSetupScreen({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    if (!url.trim() || !token.trim()) {
      setError("Both URL and auth token are required");
      return;
    }
    if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
      setError("URL must start with libsql:// or https://");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await invoke("turso_setup", { url: url.trim(), authToken: token.trim() });
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-surface-0">
      <div className="w-[400px]">
        <div className="text-center mb-7">
          <div className="w-[52px] h-[52px] rounded-[14px] bg-saffron-600 flex items-center justify-center text-white text-xl font-semibold" style={{
            margin: "0 auto 12px",
          }}>ন</div>
          <div className="text-xl font-bold" style={{ letterSpacing: -0.4 }}>Nityaseva</div>
          <div className="text-xs text-text-muted mt-[2px]">
            Database Setup
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Connect to Turso Database</div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Nityaseva uses Turso for secure cloud sync. Enter your database credentials from the
              {" "}<a href="https://app.turso.io" target="_blank" style={{ color: "var(--color-saffron-600)" }}>
                Turso dashboard
              </a>.
            </p>

            <div className="form-group">
              <label className="label">Database URL</label>
              <input
                className="input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="libsql://your-db-org.turso.io"
                autoFocus
              />
              <span className="text-[11px] text-text-muted">
                Found in Turso dashboard → Your DB → Connect
              </span>
            </div>

            <div className="form-group">
              <label className="label">Auth Token</label>
              <input
                className="input"
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="eyJhbGciOi..."
              />
              <span className="text-[11px] text-text-muted">
                Generate a token in Turso dashboard → Your DB → Generate Token
              </span>
            </div>

            {error && (
              <div style={{
                background: "#fde0e0", border: "1px solid #f8b4b4",
                borderRadius: "var(--radius-md)", padding: "10px 12px",
                fontSize: 13, color: "var(--color-danger)",
              }}>{error}</div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSetup}
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? "Connecting…" : "Connect & Continue"}
            </button>

            <div style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.6 }}>
              Your credentials are stored securely on this device only.<br />
              The app works offline — syncs when internet is available.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Turso tab in Settings
export function TursoSettingsTab({ onToast }: { onToast: (m: string, ok: boolean) => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await invoke<SyncStatus>("turso_status");
      setStatus(s);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const s = await invoke<SyncStatus>("turso_sync");
      setStatus(s);
      onToast(s.message, s.connected);
    } catch (e) {
      onToast(String(e), false);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!url.trim() || !token.trim()) {
      onToast("Both URL and token are required", false);
      return;
    }
    setSaving(true);
    try {
      await invoke("turso_update_credentials", { url: url.trim(), authToken: token.trim() });
      setEditMode(false);
      setUrl("");
      setToken("");
      await loadStatus();
      onToast("Credentials updated and synced", true);
    } catch (e) {
      onToast(String(e), false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
      {/* Status card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Turso Sync</div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: status?.connected ? "var(--color-success)" : "var(--color-text-muted)",
            }} />
            <span style={{ fontSize: 13, color: status?.connected ? "var(--color-success)" : "var(--color-text-muted)" }}>
              {status?.connected ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "12px 14px",
            background: "var(--color-surface-3)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--color-text-secondary)",
          }}>
            {status?.message ?? "Loading…"}
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "↻ Sync Now"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setEditMode(e => !e); setUrl(""); setToken(""); }}
            >
              {editMode ? "Cancel" : "Update Credentials"}
            </button>
          </div>

          {editMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--color-border-soft)", paddingTop: 14 }}>
              <div className="form-group">
                <label className="label">New Database URL</label>
                <input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="libsql://your-db-org.turso.io" autoFocus />
              </div>
              <div className="form-group">
                <label className="label">New Auth Token</label>
                <input className="input" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="eyJhbGciOi..." />
              </div>
              <button className="btn btn-primary" onClick={handleUpdateCredentials} disabled={saving}>
                {saving ? "Saving…" : "Save & Reconnect"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="card">
        <div className="card-body" style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>How sync works</div>
          <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>All data is stored locally on this device — works offline indefinitely</li>
            <li>Pressing "Sync Now" pushes local changes to Turso cloud and pulls remote changes</li>
            <li>Sync also runs automatically when the app launches (if internet is available)</li>
            <li>Other devices will see your changes after they sync</li>
          </ul>
        </div>
      </div>
    </div>
  );
}