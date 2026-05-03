import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Member {
  id: number;
  name: string;
  mobile: string | null;
  address: string | null;
  district: string | null;
  status: string;
  membership_type_name: string | null;
  last_donation: string | null;
}

const TEMPLATES = [
  { label: "Donation Request", text: "প্রিয় {name}, আপনার মাসিক চাঁদা প্রদান করুন। ধন্যবাদ। - Nityaseva" },
  { label: "Festival Greeting", text: "প্রিয় {name}, আপনাকে আন্তরিক শুভেচ্ছা জানাই। - Nityaseva" },
  { label: "Renewal Reminder", text: "প্রিয় {name}, আপনার সদস্যপদ নবায়ন করুন। - Nityaseva" },
  { label: "Custom", text: "" },
];

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r =>
    r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function SmsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(false);
  const [templateIdx, setTemplateIdx] = useState(0);
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [preview, setPreview] = useState<{ name: string; mobile: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await invoke<Member[]>("list_members", {
        search: search || null,
        status: statusFilter || null,
      });
      setMembers(m);
      // keep only members with mobile
      const withMobile = new Set(m.filter(x => x.mobile).map(x => x.id));
      setSelected(withMobile);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const withMobile = members.filter(m => m.mobile);
    if (selected.size === withMobile.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withMobile.map(m => m.id)));
    }
  };

  const selectedMembers = members.filter(m => selected.has(m.id) && m.mobile);

  const applyTemplate = (idx: number) => {
    setTemplateIdx(idx);
    if (TEMPLATES[idx].label !== "Custom") setMessage(TEMPLATES[idx].text);
  };

  const buildText = (name: string) => message.replace("{name}", name);

  const handleExportCSV = () => {
    if (selectedMembers.length === 0) return;
    downloadCSV(
      `sms-export-${new Date().toISOString().slice(0, 10)}.csv`,
      selectedMembers.map(m => [m.mobile!, m.name, buildText(m.name)]),
      ["Mobile", "Name", "Message"]
    );
  };

  const handlePreview = () => {
    const first = selectedMembers[0];
    if (!first) return;
    setPreview({ name: first.name, mobile: first.mobile!, text: buildText(first.name) });
  };

  const membersWithMobile = members.filter(m => m.mobile).length;
  const membersWithoutMobile = members.filter(m => !m.mobile).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">SMS Export</div>
          <div className="page-subtitle">
            {selectedMembers.length} recipient{selectedMembers.length !== 1 ? "s" : ""} selected
            &nbsp;·&nbsp; {membersWithoutMobile} members have no mobile
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handlePreview} disabled={selectedMembers.length === 0}>
            👁 Preview
          </button>
          <button className="btn btn-primary" onClick={handleExportCSV} disabled={selectedMembers.length === 0}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Message composer */}
      <div className="card mb-4">
        <div className="card-header"><div className="card-title">Message</div></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Template</label>
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {TEMPLATES.map((t, i) => (
                <button
                  key={t.label}
                  className={`btn btn-sm ${templateIdx === i ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => applyTemplate(i)}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="label">Message text — use <code style={{ background: "var(--color-surface-3)", padding: "1px 4px", borderRadius: 3 }}>{"{name}"}</code> for member name</label>
            <textarea
              className="input"
              rows={3}
              value={message}
              onChange={e => { setMessage(e.target.value); setTemplateIdx(3); }}
              placeholder="Type your message here…"
            />
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              {message.length} characters
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            className="input search-input"
            placeholder="Filter members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
          {selected.size === membersWithMobile ? "Deselect All" : "Select All with Mobile"}
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={selected.size === membersWithMobile && membersWithMobile > 0}
                  onChange={toggleAll}
                />
              </th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Status</th>
              <th>Membership</th>
              <th>Last Donation</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>Loading…</td></tr>
            )}
            {!loading && members.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>No members found</td></tr>
            )}
            {members.map(m => {
              const hasMobile = !!m.mobile;
              const isSelected = selected.has(m.id);
              return (
                <tr
                  key={m.id}
                  onClick={() => hasMobile && toggleOne(m.id)}
                  style={{ cursor: hasMobile ? "pointer" : "not-allowed", opacity: hasMobile ? (isSelected ? 1 : 0.4) : 0.3 }}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!hasMobile}
                      onChange={() => toggleOne(m.id)}
                    />
                  </td>
                  <td className="font-medium">{m.name}</td>
                  <td>
                    {m.mobile
                      ? <span style={{ fontFamily: "monospace" }}>{m.mobile}</span>
                      : <span className="badge badge-neutral">No mobile</span>}
                  </td>
                  <td>
                    <span className={`badge ${m.status === "active" ? "badge-success" : "badge-neutral"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="text-muted">{m.membership_type_name ?? "—"}</td>
                  <td className="text-muted">{m.last_donation ? m.last_donation.slice(0, 10) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Message Preview</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="label">To</label>
                <div style={{ fontSize: 13 }}>{preview.name} — <span style={{ fontFamily: "monospace" }}>{preview.mobile}</span></div>
              </div>
              <div className="form-group">
                <label className="label">Message</label>
                <div style={{
                  background: "var(--color-surface-3)", border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)", padding: "10px 12px",
                  fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap",
                }}>{preview.text}</div>
              </div>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {preview.text.length} characters · {selectedMembers.length} total recipients
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setPreview(null); handleExportCSV(); }}>
                ⬇ Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}