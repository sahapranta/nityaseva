import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../contexts/LangContext";
import type { PagedResult } from "../hooks/usePagination";

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
  const { tr } = useLang();
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
      const result = await invoke<PagedResult<Member>>("list_members", {
        search: search || null,
        status: statusFilter || null,
        page: 1,
        pageSize: 1000,
      });
      setMembers(result.data);
      // keep only members with mobile
      const withMobile = new Set(result.data.filter(x => x.mobile).map(x => x.id));
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
            👁 {tr("preview")}
          </button>
          <button className="btn btn-primary" onClick={handleExportCSV} disabled={selectedMembers.length === 0}>
            ⬇ {tr("csv")}
          </button>
        </div>
      </div>

      {/* Message composer */}
      <div className="card mb-4">
        <div className="card-header"><div className="card-title">{tr("message")}</div></div>
        <div className="card-body flex flex-col gap-3">
          <div className="form-group">
            <label className="label">{tr("template")}</label>
            <div className="flex gap-2 flex-wrap">
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
            <label className="label">Message text — use <code className="bg-surface-3 px-1 rounded text-xs">{"{name}"}</code> for member name</label>
            <textarea
              className="input"
              rows={3}
              value={message}
              onChange={e => { setMessage(e.target.value); setTemplateIdx(3); }}
              placeholder="Type your message here…"
            />
            <div className="text-xs text-text-muted mt-1">
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
        <select className="input w-[140px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
              <th className="w-10">
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
              <tr><td colSpan={6} className="text-center p-6 text-text-muted">Loading…</td></tr>
            )}
            {!loading && members.length === 0 && (
              <tr><td colSpan={6} className="text-center p-6 text-text-muted">No members found</td></tr>
            )}
            {members.map(m => {
              const hasMobile = !!m.mobile;
              const isSelected = selected.has(m.id);
              return (
                <tr
                  key={m.id}
                  onClick={() => hasMobile && toggleOne(m.id)}
                  className={`${hasMobile ? "cursor-pointer" : "cursor-not-allowed"} transition-opacity ${hasMobile ? (isSelected ? "opacity-100" : "opacity-40") : "opacity-30"}`}
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
                      ? <span className="font-mono">{m.mobile}</span>
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
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Message Preview</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="modal-body flex flex-col gap-3">
              <div className="form-group">
                <label className="label">To</label>
                <div className="text-sm">{preview.name} — <span className="font-mono">{preview.mobile}</span></div>
              </div>
              <div className="form-group">
                <label className="label">Message</label>
                <div className="bg-surface-3 border border-border rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {preview.text}
                </div>
              </div>
              <p className="text-xs text-text-muted">
                {preview.text.length} characters · {selectedMembers.length} total recipients
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>{tr("close")}</button>
              <button className="btn btn-primary" onClick={() => { setPreview(null); handleExportCSV(); }}>
                ⬇ {tr("export_csv")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}