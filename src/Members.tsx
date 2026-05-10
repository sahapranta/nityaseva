import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "./contexts/LangContext";

// Types 
interface Member {
  id: number;
  name: string;
  mobile: string | null;
  address: string | null;
  district: string | null;
  pin_code: string | null;
  membership_type: number | null;
  membership_type_name: string | null;
  status: "active" | "inactive" | "skip";
  skip_until: string | null;
  last_donation: string | null;
  joined_at: string;
  notes: string | null;
}

interface MembershipType {
  id: number;
  name: string;
  amount: number;
}

const emptyInput = {
  name: "", mobile: "", address: "", district: "",
  pin_code: "", membership_type: "" as string | number,
  status: "active", skip_until: "", notes: "",
};

// ── Member Form Modal ─────────────────────────────────────────────────
function MemberModal({
  member, membershipTypes, onSave, onClose,
}: {
  member: Member | null;
  membershipTypes: MembershipType[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    member
      ? {
        name: member.name,
        mobile: member.mobile ?? "",
        address: member.address ?? "",
        district: member.district ?? "",
        pin_code: member.pin_code ?? "",
        membership_type: member.membership_type ?? ("" as string | number),
        status: member.status,
        skip_until: member.skip_until ?? "",
        notes: member.notes ?? "",
      }
      : { ...emptyInput }
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { tr } = useLang();

  const set = (k: string, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const input = {
        ...form,
        mobile: form.mobile || null,
        address: form.address || null,
        district: form.district || null,
        pin_code: form.pin_code || null,
        membership_type: form.membership_type ? Number(form.membership_type) : null,
        skip_until: form.skip_until || null,
        notes: form.notes || null,
      };
      if (member) {
        await invoke("update_member", { id: member.id, input });
      } else {
        await invoke("create_member", { input });
      }
      onSave();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{member ? tr("editMember") : tr("addMember")}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body flex flex-col gap-3">
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="label">{tr("fullName")} <span className="text-danger">*</span></label>
              <input className="input" value={form.name} onChange={e => set("name", e.target.value)} autoFocus required/>
            </div>
            <div className="form-group">
              <label className="label">{tr("mobile")} <span className="text-danger">*</span></label>
              <input className="input" value={form.mobile} onChange={e => set("mobile", e.target.value)} placeholder="01XXXXXXXXX" required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">{tr("address")}</label>
            <input className="input" value={form.address} onChange={e => set("address", e.target.value)} />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="label">{tr("district")}</label>
              <input className="input" value={form.district} onChange={e => set("district", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">{tr("postCode")}</label>
              <input className="input" value={form.pin_code} onChange={e => set("pin_code", e.target.value)} />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="label">{tr("membershipType")}</label>
              <select className="input" value={form.membership_type} onChange={e => set("membership_type", e.target.value)}>
                <option value="">— Select —</option>
                {membershipTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (৳{t.amount})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">{tr("status")}</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="active">{tr("active")}</option>
                <option value="inactive">{tr("inactive")}</option>
                <option value="skip">{tr("skip")}</option>
              </select>
            </div>
          </div>

          {form.status === "skip" && (
            <div className="form-group">
              <label className="label">{tr("skipUntil")}</label>
              <input className="input" type="date" value={form.skip_until} onChange={e => set("skip_until", e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label className="label">{tr("notes")}</label>
            <textarea className="input" value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>

          {error && <p className="text-danger text-xs">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{tr("cancel")}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? tr("saving…") : member ? tr("saveChanges") : tr("addMember")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  const { tr } = useLang();
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-body text-center px-5 py-6">
          <p className="text-sm">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>{tr("cancel")}</button>
          <button className="btn btn-danger" onClick={onConfirm}>{tr("delete")}</button>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls = status === "active" ? "badge-success" : status === "inactive" ? "badge-danger" : "badge-warning";
  return <span className={`badge ${cls}`}>{status}</span>;
}

// ── Members Page ──────────────────────────────────────────────────────
export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const { tr } = useLang();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([
        invoke<Member[]>("list_members", {
          search: search || null,
          status: statusFilter || null,
        }),
        invoke<MembershipType[]>("list_membership_types"),
      ]);
      setMembers(m);
      setMembershipTypes(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async () => {
    if (!deleting) return;
    await invoke("delete_member", { id: deleting.id });
    setDeleting(null);
    load();
  };

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (m: Member) => { setEditing(m); setModalOpen(true); };

  const handleDonate = (m: Member) => {
    window.dispatchEvent(new CustomEvent("navigate-donate", { detail: m }));
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{tr("members")}</div>
          <div className="page-subtitle">{members.length} member{members.length !== 1 ? "s" : ""} found</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ {tr("addMember")}</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            className="input search-input"
            placeholder="Search name or mobile…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="skip">Skip</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>{tr("refresh")}</button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{tr("name")}</th>
              <th>{tr("mobile")}</th>
              <th>{tr("district")}</th>
              <th>{tr("membership")}</th>
              <th>{tr("status")}</th>
              <th>{tr("lastDonation")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center  text-text-muted p-6">{tr("loading")}…</td></tr>
            )}
            {!loading && members.length === 0 && (
              <tr><td colSpan={8} className="text-center text-text-muted p-6">{tr("noMembersFound")}</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id}>
                <td className="text-muted" style={{ fontSize: 11 }}>{m.id}</td>
                <td className="font-medium">{m.name}</td>
                <td className="text-muted">{m.mobile ?? "—"}</td>
                <td className="text-muted">{m.district ?? "—"}</td>
                <td>{m.membership_type_name ?? <span className="text-muted">—</span>}</td>
                <td><StatusBadge status={m.status} /></td>
                <td className="text-muted">{m.last_donation ? m.last_donation.slice(0, 10) : "—"}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-primary btn-sm" onClick={() => handleDonate(m)}>{tr("donate")}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>{tr("edit")}</button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleting(m)}>{tr("delete")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modalOpen && (
        <MemberModal
          member={editing}
          membershipTypes={membershipTypes}
          onSave={() => { setModalOpen(false); load(); }}
          onClose={() => setModalOpen(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`Delete "${deleting.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
