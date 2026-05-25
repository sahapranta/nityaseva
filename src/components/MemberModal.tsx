import { useState } from "react";
import { useLang } from "../contexts/LangContext";
import { invoke } from "@tauri-apps/api/core";
import type { InputMember as Member, MembershipType } from "../types/member";
// Types 
const emptyInput = {
  name: "", mobile: "", address: "", district: "",
  pin_code: "", membership_type: "" as string | number,
  status: "active", skip_until: "", notes: "",
};

export default function MemberModal({
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
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{member ? tr("editMember") : tr("addMember")}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M18.364 5.636a1 1 0 0 0-1.414-1.414L12 9.172 7.05 4.222A1 1 0 1 0 5.636 5.636L10.586 12l-4.95 4.95a1 1 0 1 0 1.414 1.414L12 14.828l4.95 4.95a1 1 0 0 0 1.414-1.414L13.414 12l4.95-4.95z" />
            </svg>
          </button>
        </div>

        <div className="modal-body flex flex-col gap-3">
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="label">{tr("fullName")} <span className="text-danger">*</span></label>
              <input className="input" value={form.name} onChange={e => set("name", e.target.value)} autoFocus required />
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