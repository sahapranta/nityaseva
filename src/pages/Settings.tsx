import { useEffect, useState, useCallback } from "react";
import { useUpdater } from "./Updater";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { TursoSettingsTab } from "./TursoSetup";

// Types
interface OrgSettings { [key: string]: string; }
interface MembershipType { id: number; name: string; amount: number; interval: string | null; is_active: number; }
interface DonationType { id: number; name: string; is_active: number; }
interface UserRow { id: number; name: string; mobile: string | null; role: string; status: string; }

// Tab bar 
const TABS = ["Organization", "Membership Types", "Donation Types", "Users", "Database", "Updates", "Sync"] as const;
type Tab = typeof TABS[number];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-border)", marginBottom: 20 }}>
      {TABS.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
          fontSize: 13, fontWeight: active === t ? 600 : 400,
          color: active === t ? "var(--color-saffron-700)" : "var(--color-text-secondary)",
          borderBottom: active === t ? "2px solid var(--color-saffron-600)" : "2px solid transparent",
          marginBottom: -1, borderRadius: 0,
        }}>{t}</button>
      ))}
    </div>
  );
}

// ── Toast
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="toast" style={{ borderColor: ok ? "var(--color-success)" : "var(--color-danger)" }}>
      <span>{ok ? "✓" : "✕"}</span> {msg}
    </div>
  );
}

// Organization Tab
function OrgTab({ onToast }: { onToast: (m: string, ok: boolean) => void }) {
  const [form, setForm] = useState({ name: "", address: "", mobile: "", email: "", website: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<OrgSettings>("get_org_settings").then(s => {
      setForm({
        name: s.name ?? "",
        address: s.address ?? "",
        mobile: s.mobile ?? "",
        email: s.email ?? "",
        website: s.website ?? "",
      });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await invoke("set_org_settings", { settings: form });
      onToast("Organization settings saved", true);
    } catch (e) {
      onToast(String(e), false);
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="card-header"><div className="card-title">Organization Details</div></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="form-group">
          <label className="label">Organization Name *</label>
          <input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Nityaseva Sangha" />
        </div>
        <div className="form-group">
          <label className="label">Address</label>
          <textarea className="input" value={form.address} onChange={e => set("address", e.target.value)} rows={3} placeholder="Full postal address" />
        </div>
        <div className="grid-cols-2">
          <div className="form-group">
            <label className="label">Mobile</label>
            <input className="input" value={form.mobile} onChange={e => set("mobile", e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={e => set("email", e.target.value)} placeholder="org@example.com" />
          </div>
        </div>
        <div className="form-group">
          <label className="label">Website</label>
          <input className="input" value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://example.com" />
        </div>
        <div style={{ marginTop: 4 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Membership Types Tab
function MembershipTypesTab({ onToast }: { onToast: (m: string, ok: boolean) => void }) {
  const [types, setTypes] = useState<MembershipType[]>([]);
  const [editing, setEditing] = useState<Partial<MembershipType> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await invoke<MembershipType[]>("list_all_membership_types");
      setTypes(rows);
    } catch (e) { onToast(String(e), false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing?.name?.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        await invoke("update_membership_type", { id: editing.id, name: editing.name, amount: Number(editing.amount ?? 0), interval: editing.interval ?? null });
      } else {
        await invoke("create_membership_type", { name: editing.name, amount: Number(editing.amount ?? 0), interval: editing.interval ?? null });
      }
      setEditing(null);
      load();
      onToast("Saved", true);
    } catch (e) { onToast(String(e), false); }
    finally { setSaving(false); }
  };

  const toggle = async (id: number, active: number) => {
    try {
      await invoke("toggle_membership_type", { id, isActive: active === 1 ? 0 : 1 });
      load();
    } catch (e) { onToast(String(e), false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Membership Types</div>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEditing({ name: "", amount: 0, interval: "" })}>+ Add</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Amount (BDT)</th><th>Interval</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td>৳ {t.amount.toLocaleString()}</td>
                  <td className="text-muted">{t.interval ?? "—"}</td>
                  <td>
                    <span className={`badge ${t.is_active ? "badge-success" : "badge-neutral"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(t.id, t.is_active)}>
                        {t.is_active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing.id ? "Edit" : "Add"} Membership Type</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="label">Name *</label>
                <input className="input" value={editing.name ?? ""} onChange={e => setEditing(v => ({ ...v!, name: e.target.value }))} autoFocus />
              </div>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="label">Amount (BDT)</label>
                  <input className="input" type="number" value={editing.amount ?? 0} onChange={e => setEditing(v => ({ ...v!, amount: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="label">Interval</label>
                  <select className="input" value={editing.interval ?? ""} onChange={e => setEditing(v => ({ ...v!, interval: e.target.value }))}>
                    <option value="">— None —</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half-yearly">Half-Yearly</option>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Donation Types Tab 
function DonationTypesTab({ onToast }: { onToast: (m: string, ok: boolean) => void }) {
  const [types, setTypes] = useState<DonationType[]>([]);
  const [editing, setEditing] = useState<Partial<DonationType> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await invoke<DonationType[]>("list_all_donation_types");
      setTypes(rows);
    } catch (e) { onToast(String(e), false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing?.name?.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        await invoke("update_donation_type", { id: editing.id, name: editing.name });
      } else {
        await invoke("create_donation_type", { name: editing.name });
      }
      setEditing(null);
      load();
      onToast("Saved", true);
    } catch (e) { onToast(String(e), false); }
    finally { setSaving(false); }
  };

  const toggle = async (id: number, active: number) => {
    try {
      await invoke("toggle_donation_type", { id, isActive: active === 1 ? 0 : 1 });
      load();
    } catch (e) { onToast(String(e), false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Donation Types</div>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEditing({ name: "" })}>+ Add</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td><span className={`badge ${t.is_active ? "badge-success" : "badge-neutral"}`}>{t.is_active ? "Active" : "Inactive"}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(t.id, t.is_active)}>{t.is_active ? "Disable" : "Enable"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing.id ? "Edit" : "Add"} Donation Type</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="label">Name *</label>
                <input className="input" value={editing.name ?? ""} onChange={e => setEditing(v => ({ ...v!, name: e.target.value }))} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Database Tab
function DatabaseTab({ onToast }: { onToast: (m: string, ok: boolean) => void }) {
  const [dbPath, setDbPath] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<string>("get_db_path").then(setDbPath).catch(() => setDbPath("Default location"));
  }, []);

  const openExisting = async () => {
    setLoading(true);
    try {
      const selected = await open({ filters: [{ name: "SQLite", extensions: ["db", "sqlite"] }] });
      if (selected && typeof selected === "string") {
        await invoke("open_database", { path: selected });
        setDbPath(selected);
        onToast("Database opened: " + selected, true);
      }
    } catch (e) { onToast(String(e), false); }
    finally { setLoading(false); }
  };

  const createNew = async () => {
    setLoading(true);
    try {
      const selected = await save({ filters: [{ name: "SQLite", extensions: ["db"] }], defaultPath: "nityaseva.db" });
      if (selected) {
        await invoke("open_database", { path: selected });
        setDbPath(selected);
        onToast("New database created: " + selected, true);
      }
    } catch (e) { onToast(String(e), false); }
    finally { setLoading(false); }
  };

  const backup = async () => {
    setLoading(true);
    try {
      const selected = await save({ filters: [{ name: "SQLite", extensions: ["db"] }], defaultPath: "nityaseva-backup.db" });
      if (selected) {
        await invoke("backup_database", { destPath: selected });
        onToast("Backup saved to: " + selected, true);
      }
    } catch (e) { onToast(String(e), false); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="card-header"><div className="card-title">Database</div></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="form-group">
          <label className="label">Current Database File</label>
          <div style={{
            padding: "8px 12px", background: "var(--color-surface-3)",
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
            fontSize: 12, color: "var(--color-text-secondary)", wordBreak: "break-all",
          }}>{dbPath || "No database loaded"}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={openExisting} disabled={loading}>📂 Open Existing</button>
          <button className="btn btn-secondary" onClick={createNew} disabled={loading}>✨ Create New</button>
          <button className="btn btn-secondary" onClick={backup} disabled={loading}>💾 Backup</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Changing the database will reload the app with the selected file. All settings and data are stored in the .db file.
        </p>
      </div>
    </div>
  );
}

// Users Tab
function UsersTab({ onToast, currentRole }: { onToast: (m: string, ok: boolean) => void; currentRole: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: "", mobile: "", role: "operator" });
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setUsers(await invoke<UserRow[]>("list_users")); }
    catch (e) { onToast(String(e), false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name.trim()) { setError("Name required"); return; }
    if (pin1.length !== 6) { setError("PIN must be 6 digits"); return; }
    if (pin1 !== pin2) { setError("PINs do not match"); return; }
    setSaving(true); setError("");
    try {
      await invoke("create_user", { name: form.name, mobile: form.mobile || null, passcode: pin1, role: form.role });
      setAdding(false);
      setForm({ name: "", mobile: "", role: "operator" });
      setPin1(""); setPin2("");
      load(); onToast("User created", true);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!resetting) return;
    if (pin1.length !== 6) { setError("PIN must be 6 digits"); return; }
    if (pin1 !== pin2) { setError("PINs do not match"); return; }
    setSaving(true); setError("");
    try {
      await invoke("reset_passcode", { userId: resetting.id, newPasscode: pin1 });
      setResetting(null); setPin1(""); setPin2("");
      onToast("PIN reset successfully", true);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const canManage = (u: UserRow) => {
    if (currentRole === "super_admin") return true;
    if (currentRole === "admin" && u.role === "operator") return true;
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Users</div>
          {(currentRole === "super_admin" || currentRole === "admin") && (
            <button className="btn btn-primary btn-sm ml-auto" onClick={() => { setAdding(true); setError(""); }}>+ Add User</button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-muted">{u.mobile ?? "—"}</td>
                  <td><span className="badge badge-info">{u.role.replace("_", " ")}</span></td>
                  <td><span className={`badge ${u.status === "active" ? "badge-success" : "badge-neutral"}`}>{u.status}</span></td>
                  <td className="text-muted" style={{ fontSize: 11 }}>{u.status}</td>
                  <td>
                    {canManage(u) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setResetting(u); setPin1(""); setPin2(""); setError(""); }}>
                        Reset PIN
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add user modal */}
      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add User</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAdding(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="label">Mobile</label>
                  <input className="input" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="operator">Operator</option>
                    {currentRole === "super_admin" && <option value="admin">Admin</option>}
                  </select>
                </div>
              </div>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="label">PIN (6 digits)</label>
                  <input className="input" type="password" maxLength={6} value={pin1} onChange={e => setPin1(e.target.value.replace(/\D/g, ""))} />
                </div>
                <div className="form-group">
                  <label className="label">Confirm PIN</label>
                  <input className="input" type="password" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN modal */}
      {resetting && (
        <div className="modal-overlay" onClick={() => setResetting(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Reset PIN — {resetting.name}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setResetting(null)}>✕</button>
            </div>
            <div className="modal-body">

              <div className="form-group mb-4">
                <label className="label">New PIN (6 digits)</label>
                <input className="input" type="password" maxLength={6} value={pin1} onChange={e => setPin1(e.target.value.replace(/\D/g, ""))} autoFocus />
              </div>
              <div className="form-group">
                <label className="label">Confirm PIN</label>
                <input className="input" type="password" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ""))} />
              </div>
        
              {error && <p className="mt-2" style={{ color: "var(--color-danger)", fontSize: 12 }}>{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResetting(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReset} disabled={saving}>{saving ? "Saving…" : "Reset PIN"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Updates Tab
function UpdatesTab() {
  const { state, checkForUpdates, installUpdate, restart } = useUpdater();

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="card-header"><div className="card-title">App Updates</div></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          Nityaseva checks for updates automatically on launch.
          You can also check manually below.
        </div>

        {state.status === "idle" && (
          <button className="btn btn-secondary" onClick={() => checkForUpdates(false)}>
            Check for Updates
          </button>
        )}
        {state.status === "checking" && (
          <button className="btn btn-secondary" disabled>Checking…</button>
        )}
        {state.status === "available" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="badge badge-success" style={{ alignSelf: "flex-start" }}>
              Update Available — v{state.update.version}
            </div>
            {state.update.body && (
              <div style={{
                background: "var(--color-surface-3)", borderRadius: "var(--radius-md)",
                padding: "10px 12px", fontSize: 13, whiteSpace: "pre-wrap",
              }}>{state.update.body}</div>
            )}
            <button className="btn btn-primary" onClick={installUpdate}>
              Download & Install
            </button>
          </div>
        )}
        {state.status === "downloading" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13 }}>Downloading… {state.progress}%</div>
            <div style={{ height: 8, background: "var(--color-surface-4)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${state.progress}%`, background: "var(--color-saffron-500)", borderRadius: 99, transition: "width 300ms" }} />
            </div>
          </div>
        )}
        {state.status === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="badge badge-success" style={{ alignSelf: "flex-start" }}>Ready to install</div>
            <button className="btn btn-primary" onClick={restart}>Restart Now</button>
          </div>
        )}
        {state.status === "error" && (
          <div style={{ color: "var(--color-danger)", fontSize: 13 }}>{state.message}</div>
        )}
      </div>
    </div>
  );
}

// Settings Page
export default function SettingsPage({ currentRole }: { currentRole: string }) {
  const [tab, setTab] = useState<Tab>("Organization");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === "Organization" && <OrgTab onToast={showToast} />}
      {tab === "Membership Types" && <MembershipTypesTab onToast={showToast} />}
      {tab === "Donation Types" && <DonationTypesTab onToast={showToast} />}
      {tab === "Database" && <DatabaseTab onToast={showToast} />}
      {tab === "Users" && <UsersTab onToast={showToast} currentRole={currentRole} />}
      {tab === "Updates" && <UpdatesTab />}
      {tab === "Sync" && <TursoSettingsTab onToast={showToast} />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}